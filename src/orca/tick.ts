/**
 * The tick: the Run's coordinator, run by hand from the terminal bound to the Run.
 *
 *   bun src/orca/tick.ts use     --run <run_id>
 *   bun src/orca/tick.ts status  --run <run_id>
 *   bun src/orca/tick.ts reply   --run <run_id> --id <message_id> --answer <text>
 *   bun src/orca/tick.ts gate    --run <run_id> --id <gate_id> --resolution <text>
 *   bun src/orca/tick.ts advance --run <run_id> [--agent claude] [--model sonnet] [--cap 1]
 *                                [--base-branch main] [--retry <task_id>]... [--cancel <task_id>]...
 *
 * Orca is the only state: every call reads the Run afresh and nothing is kept between calls.
 * It never pushes and never touches code.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { succeeds } from "../shell.ts";
import { orcaCli, type Orca } from "./orca.ts";
import { SURPRISE_CHECK_KIND } from "./surprise-check.ts";

export type Git = {
  readonly worktreeExists: (worktree: string) => boolean;
  /** Whether the HEAD of the worktree at this path is an ancestor of main. */
  readonly headIsOnMain: (worktree: string) => Promise<boolean>;
};

const USAGE = [
  "usage: bun src/orca/tick.ts use     --run <run_id>",
  "       bun src/orca/tick.ts status  --run <run_id>",
  "       bun src/orca/tick.ts reply   --run <run_id> --id <message_id> --answer <text>",
  "       bun src/orca/tick.ts gate    --run <run_id> --id <gate_id> --resolution <text>",
  "       bun src/orca/tick.ts advance --run <run_id> [--agent claude] [--model sonnet] [--cap 1]",
  "                                    [--base-branch main] [--retry <task_id>]... [--cancel <task_id>]...",
].join("\n");

const MAIN = "main";

const ADVANCE_DEFAULTS = { agent: "claude", model: "sonnet", cap: "1", baseBranch: MAIN };

/** A Dispatch in any other status still has a worker attached. */
const SETTLED_DISPATCH = new Set(["completed", "failed", "circuit_broken"]);

/** `inbox` reads the newest rows across every Run, so this is set well past any one Run's mail. */
const INBOX_LIMIT = "10000";

/** worker-list's own maximum page size. */
const WORKER_PAGE_SIZE = "100";

const SURPRISE_CHECK_QUESTION =
  "The surprise check failed. Rule on each surprise its report says needs a decision; " +
  "after a crash, resolve to run it again.";

export async function tick(argv: readonly string[], orca: Orca, git: Git): Promise<string> {
  const [command, ...args] = argv;
  switch (command) {
    case "use":
      return use(runOptions(args), orca);
    case "status":
      return status(runOptions(args), orca, git);
    case "reply":
      return reply(replyOptions(args), orca);
    case "gate":
      return resolveGate(gateOptions(args), orca);
    case "advance":
      return advance(advanceOptions(args), orca, git);
    default:
      throw new Error(USAGE);
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/** Binds the calling terminal to the Run, which fences whichever terminal held it before. */
async function use(options: { run: string }, orca: Orca): Promise<string> {
  await orca(["run-use", "--id", options.run]);
  return `This terminal is bound to Run ${options.run}.`;
}

async function status(options: { run: string }, orca: Orca, git: Git): Promise<string> {
  const run = await readRun(orca, options.run);
  const opened = await gateFailedSurpriseChecks(run, orca);
  const unmerged = await completedTasksAwaitingMerge(run, git);

  return [
    `Run ${run.id}`,
    section("Open questions", openQuestions(run).map((q) => describeOpenQuestion(run, q))),
    section("Closed questions", closedQuestions(run).map((q) => describeClosedQuestion(run, q))),
    section("Open gates", [...run.openGates, ...opened].map((g) => describeGate(run, g))),
    section("Failed attempts", failedTasks(run).map((t) => describeFailure(run, t))),
    section("Awaiting merge", unmerged.map(describeAwaitingMerge)),
    section("Item report", succeededSurpriseChecks(run).map((t) => describeItemReport(run, t))),
  ].join("\n\n");
}

/** Opens a gate whatever made the check fail: telling a crash from a decision is the owner's call.
 *  Orca opens a gate only from the terminal bound to the Run. */
async function gateFailedSurpriseChecks(run: Run, orca: Orca): Promise<Gate[]> {
  const ungated = run.tasks.filter(
    (task) =>
      task.kind === SURPRISE_CHECK_KIND &&
      task.status === "failed" &&
      !isCancelled(task) &&
      !run.openGates.some((gate) => gate.taskId === task.id),
  );
  const opened: Gate[] = [];
  for (const task of ungated) {
    const result = await orca(["gate-create", "--task", task.id, "--question", SURPRISE_CHECK_QUESTION]);
    opened.push(parseGate(fields(result, "gate-create result").gate));
  }
  return opened;
}

async function reply(
  options: { run: string; id: string; answer: string },
  orca: Orca,
): Promise<string> {
  const run = await readRun(orca, options.run);
  const question = questionById(run, options.id);
  refuseUnlessOpen(run, question);

  await orca(["reply", "--run", run.id, "--id", question.id, "--body", options.answer]);
  return `Replied to ${question.id} for ${taskLabel(run, question.taskId)}.`;
}

async function resolveGate(
  options: { run: string; id: string; resolution: string },
  orca: Orca,
): Promise<string> {
  const run = await readRun(orca, options.run);
  const gate = run.openGates.find((g) => g.id === options.id);
  if (gate === undefined) {
    throw new Error(
      `Run ${run.id} has no open gate ${options.id}: it is resolved or not in this Run. Nothing was sent.`,
    );
  }

  await orca(["gate-resolve", "--id", gate.id, "--resolution", options.resolution]);
  return `Resolved ${gate.id} on ${taskLabel(run, gate.taskId)}.`;
}

async function advance(options: AdvanceOptions, orca: Orca, git: Git): Promise<string> {
  const cancelled = await cancelTasks(options, orca);
  const run = await readRun(orca, options.run);
  const released = await releaseSettledWorkers(run, orca);
  const plan = await planAttempts(run, options, git);
  const started = await startAttempts(run, plan.starting, options, orca);

  return [
    section("Cancelled", cancelled),
    section("Released", released),
    section("Started", started),
    section("Held", plan.held),
  ].join("\n\n");
}

// ── Reading the Run ──────────────────────────────────────────────────────────

type Task = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly deps: readonly string[];
  readonly result: TaskResult;
  /** From the spec's frontmatter. */
  readonly kind: string | undefined;
};

type TaskResult =
  | { readonly kind: "none" }
  | { readonly kind: "report"; readonly outcome: string; readonly subject: string; readonly body: string }
  | { readonly kind: "note"; readonly text: string };

type Dispatch = {
  readonly id: string;
  readonly taskId: string;
  readonly status: string;
  readonly live: boolean;
  readonly worktree: string | undefined;
  readonly releasable: boolean;
};

type Question = {
  readonly id: string;
  readonly sequence: number;
  readonly taskId: string;
  readonly dispatchId: string;
  readonly text: string;
  readonly reply: string | undefined;
  readonly attemptEnded: boolean;
};

type Gate = {
  readonly id: string;
  readonly taskId: string;
  readonly question: string;
};

type Run = {
  readonly id: string;
  readonly tasks: readonly Task[];
  /** Newest first, as worker-list returns them. */
  readonly dispatches: readonly Dispatch[];
  readonly questions: readonly Question[];
  readonly openGates: readonly Gate[];
};

async function readRun(orca: Orca, id: string): Promise<Run> {
  const [tasks, dispatches, messages, openGates] = await Promise.all([
    listTasks(orca, id),
    listDispatches(orca, id),
    listMessages(orca, id),
    listOpenGates(orca, id),
  ]);
  return { id, tasks, dispatches, questions: questionsIn(messages, dispatches), openGates };
}

async function listTasks(orca: Orca, run: string): Promise<Task[]> {
  const result = fields(await orca(["task-list", "--run", run]), "task-list result");
  return list(result, "tasks").map(parseTask);
}

async function listDispatches(orca: Orca, run: string): Promise<Dispatch[]> {
  const dispatches: Dispatch[] = [];
  let cursor: string | undefined;
  do {
    const paging = cursor === undefined ? [] : ["--cursor", cursor];
    const args = ["worker-list", "--run", run, "--limit", WORKER_PAGE_SIZE, ...paging];
    const result = fields(await orca(args), "worker-list result");
    dispatches.push(...list(result, "workers").map(parseDispatch));
    cursor = optionalText(fields(result.page, "worker-list page"), "nextCursor");
  } while (cursor !== undefined);
  return dispatches;
}

type Message = {
  readonly id: string;
  readonly sequence: number;
  readonly type: string;
  readonly threadId: string | undefined;
  readonly body: string;
  readonly payload: string | undefined;
};

/** `inbox` takes no `--run`; it is read-only and never consumes the coordinator's mail. */
async function listMessages(orca: Orca, run: string): Promise<Message[]> {
  const result = fields(await orca(["inbox", "--full", "--limit", INBOX_LIMIT]), "inbox result");
  return list(result, "messages")
    .map((row) => fields(row, "inbox message"))
    .filter((row) => row.run_id === run)
    .map(parseMessage);
}

async function listOpenGates(orca: Orca, run: string): Promise<Gate[]> {
  const result = fields(await orca(["gate-list", "--run", run, "--status", "pending"]), "gate-list result");
  return list(result, "gates").map(parseGate);
}

function parseTask(row: unknown): Task {
  const task = fields(row, "task");
  const id = text(task, "id");
  return {
    id,
    title: text(task, "task_title"),
    status: text(task, "status"),
    deps: parseDeps(text(task, "deps")),
    result: parseTaskResult(optionalText(task, "result")),
    kind: specKind(id, text(task, "spec")),
  };
}

/** A spec may open with YAML frontmatter between `---` lines. */
function specKind(taskId: string, spec: string): string | undefined {
  const lines = spec.split("\n");
  if (lines[0] !== "---") return undefined;
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new Error(`Task ${taskId} has a spec whose frontmatter is never closed by ---`);
  let frontmatter: unknown;
  try {
    frontmatter = Bun.YAML.parse(lines.slice(1, end).join("\n"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Task ${taskId} has a spec whose frontmatter does not parse: ${reason}`, { cause: error });
  }
  if (!isRecord(frontmatter)) throw new Error(`Task ${taskId} has a spec whose frontmatter is not a mapping`);
  const kind = frontmatter.kind;
  if (kind !== undefined && typeof kind !== "string") {
    throw new Error(`Task ${taskId} has a spec whose frontmatter kind is not text`);
  }
  return kind;
}

function parseDeps(raw: string): string[] {
  const deps: unknown = JSON.parse(raw);
  if (!Array.isArray(deps) || !deps.every((dep) => typeof dep === "string")) {
    throw new Error(`Orca returned task deps that are not a list of IDs: ${raw}`);
  }
  return deps;
}

/** A worker's report is stored as JSON; a result set with `task-update --result` is plain text. */
function parseTaskResult(raw: string | undefined): TaskResult {
  if (raw === undefined) return { kind: "none" };
  if (!raw.startsWith("{")) return { kind: "note", text: raw };
  const report = fields(JSON.parse(raw), "task result");
  return {
    kind: "report",
    outcome: text(report, "outcome"),
    subject: optionalText(report, "subject") ?? "",
    body: optionalText(report, "body") ?? "",
  };
}

function parseDispatch(row: unknown): Dispatch {
  const worker = fields(row, "worker");
  const projection = fields(worker.projection, "worker projection");
  const nextAction = fields(projection.nextAction, "worker nextAction");
  return {
    id: text(worker, "dispatchId"),
    taskId: text(worker, "taskId"),
    status: text(worker, "dispatchStatus"),
    live: text(fields(projection.liveness, "worker liveness"), "verdict") === "live",
    worktree: worktreePath(worker.resource),
    releasable: list(nextAction, "argv").includes("worker-release"),
  };
}

function parseGate(row: unknown): Gate {
  const gate = fields(row, "gate");
  return { id: text(gate, "id"), taskId: text(gate, "task_id"), question: text(gate, "question") };
}

/** A worktree ID reads `<repo id>::<absolute path>`. */
function worktreePath(resource: unknown): string | undefined {
  if (resource === null) return undefined;
  const worktreeId = optionalText(fields(resource, "worker resource"), "worktreeId");
  return worktreeId?.split("::")[1];
}

function parseMessage(row: Record<string, unknown>): Message {
  return {
    id: text(row, "id"),
    sequence: number(row, "sequence"),
    type: text(row, "type"),
    threadId: optionalText(row, "thread_id"),
    body: optionalText(row, "body") ?? "",
    payload: optionalText(row, "payload"),
  };
}

/** A reply is any other message in the question's thread; no row carries a question's state. */
function questionsIn(messages: readonly Message[], dispatches: readonly Dispatch[]): Question[] {
  return messages
    .filter((message) => message.type === "question")
    .map((message) => {
      const payload = fields(JSON.parse(message.payload ?? "null"), "question payload");
      const dispatchId = text(payload, "dispatchId");
      const replies = messages
        .filter((m) => m.threadId === message.id && m.id !== message.id)
        .sort(bySequence);
      return {
        id: message.id,
        sequence: message.sequence,
        taskId: text(payload, "taskId"),
        dispatchId,
        text: message.body,
        reply: replies.at(-1)?.body,
        attemptEnded: !isActive(dispatches.find((d) => d.id === dispatchId)),
      };
    })
    .sort(bySequence);
}

// ── What the Run's state means ───────────────────────────────────────────────

function isActive(dispatch: Dispatch | undefined): boolean {
  return dispatch !== undefined && !SETTLED_DISPATCH.has(dispatch.status);
}

function isCancelled(task: Task): boolean {
  return task.status === "failed" && task.result.kind === "note" && task.result.text === "cancelled";
}

function isOpen(question: Question): boolean {
  return !question.attemptEnded && question.reply === undefined;
}

function openQuestions(run: Run): Question[] {
  return run.questions.filter(isOpen);
}

/** Unanswered questions of attempts that ended, on Tasks still to finish: the retry asks again. */
function closedQuestions(run: Run): Question[] {
  return run.questions.filter((question) => {
    const task = taskById(run, question.taskId);
    return (
      question.attemptEnded &&
      question.reply === undefined &&
      task.status !== "completed" &&
      !isCancelled(task)
    );
  });
}

/** A crash leaves the Task `ready` with its latest Dispatch settled `failed`. */
function failedTasks(run: Run): Task[] {
  return run.tasks.filter((task) => {
    if (isCancelled(task)) return false;
    if (task.status === "failed" || task.status === "blocked") return true;
    return task.status === "ready" && latestDispatch(run, task.id)?.status === "failed";
  });
}

/** The check reads every Task against the whole shape, so its report is the item's report. */
function succeededSurpriseChecks(run: Run): Task[] {
  return run.tasks.filter((task) => task.kind === SURPRISE_CHECK_KIND && task.status === "completed");
}

function attemptCount(run: Run, taskId: string): number {
  return run.dispatches.filter((dispatch) => dispatch.taskId === taskId).length;
}

function latestDispatch(run: Run, taskId: string): Dispatch | undefined {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId);
}

function activeDispatch(run: Run, taskId: string): Dispatch | undefined {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId && isActive(dispatch));
}

function latestSettledDispatch(run: Run, taskId: string): Dispatch | undefined {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId && !isActive(dispatch));
}

function inFlight(run: Run): number {
  return run.dispatches.filter(isActive).length;
}

/** The attempt that completed the Task is the one whose branch has to land. */
function landedWorktree(run: Run, task: Task): string | undefined {
  return run.dispatches.find((d) => d.taskId === task.id && d.status === "completed")?.worktree;
}

type Landing = { readonly task: Task; readonly worktree: string | undefined; readonly merged: boolean };

/** The owner removes a worktree once its branch has landed, which also covers squash and rebase
 *  merges that leave HEAD off main's history. */
async function landing(run: Run, task: Task, git: Git): Promise<Landing> {
  const worktree = landedWorktree(run, task);
  const merged =
    worktree !== undefined && (!git.worktreeExists(worktree) || (await git.headIsOnMain(worktree)));
  return { task, worktree, merged };
}

async function completedTasksAwaitingMerge(run: Run, git: Git): Promise<Landing[]> {
  const completed = run.tasks.filter((task) => task.status === "completed");
  const landings = await Promise.all(completed.map((task) => landing(run, task, git)));
  return landings.filter((l) => !l.merged);
}

/** Distinct asks; a retry asking again is the same one-way door. */
function itemQuestionCount(run: Run): number {
  return new Set(run.questions.map((question) => question.text)).size;
}

function taskById(run: Run, taskId: string): Task {
  const task = run.tasks.find((t) => t.id === taskId);
  if (task === undefined) throw new Error(`Run ${run.id} has no Task ${taskId}`);
  return task;
}

function questionById(run: Run, messageId: string): Question {
  const question = run.questions.find((q) => q.id === messageId);
  if (question === undefined) throw new Error(`Run ${run.id} has no question ${messageId}`);
  return question;
}

function refuseUnlessOpen(run: Run, question: Question): void {
  const task = taskLabel(run, question.taskId);
  if (question.attemptEnded) {
    throw new Error(
      `Question ${question.id} for ${task} is closed: its attempt ${question.dispatchId} has ended. ` +
        `Nothing was sent; the retry asks it again.`,
    );
  }
  if (question.reply !== undefined) {
    throw new Error(`Question ${question.id} for ${task} already has a reply. Nothing was sent.`);
  }
}

// ── Advancing the Run ────────────────────────────────────────────────────────

type AdvanceOptions = {
  readonly run: string;
  readonly agent: string;
  readonly model: string;
  readonly cap: number;
  readonly baseBranch: string;
  readonly retry: readonly string[];
  readonly cancel: readonly string[];
};

/** Settles a live worker with `worker-stop`; anything else is only fenced, as Orca's recovery
 *  rules allow no stop on a worker not proven live. */
async function cancelTasks(options: AdvanceOptions, orca: Orca): Promise<string[]> {
  if (options.cancel.length === 0) return [];
  const run = await readRun(orca, options.run);
  const cancelled: string[] = [];
  for (const taskId of options.cancel) {
    const task = taskById(run, taskId);
    const worker = activeDispatch(run, task.id);
    if (worker !== undefined) {
      await orca([worker.live ? "worker-stop" : "worker-abandon", "--dispatch", worker.id]);
    }
    await orca(["task-update", "--run", run.id, "--id", task.id, "--status", "failed", "--result", "cancelled"]);
    cancelled.push(taskLabel(run, task.id));
  }
  return cancelled;
}

async function releaseSettledWorkers(run: Run, orca: Orca): Promise<string[]> {
  const releasable = run.dispatches.filter((dispatch) => dispatch.releasable);
  for (const dispatch of releasable) {
    await orca(["worker-release", "--dispatch", dispatch.id]);
  }
  return releasable.map((dispatch) => `${dispatch.id} (${taskLabel(run, dispatch.taskId)})`);
}

type Attempt = { readonly task: Task; readonly retryOf: string | undefined };

async function planAttempts(
  run: Run,
  options: AdvanceOptions,
  git: Git,
): Promise<{ starting: Attempt[]; held: string[] }> {
  const retries = options.retry.map((taskId) => retryOf(run, taskId));
  const ready = await readyTasks(run, git);
  const candidates = [...retries, ...ready.startable];
  const slots = Math.max(0, options.cap - inFlight(run));

  return {
    starting: candidates.slice(0, slots),
    held: [
      ...candidates.slice(slots).map((a) => `${taskLabel(run, a.task.id)}: cap of ${options.cap} reached`),
      ...ready.waiting,
    ],
  };
}

function retryOf(run: Run, taskId: string): Attempt {
  const task = taskById(run, taskId);
  if (task.status !== "failed" && task.status !== "blocked") {
    throw new Error(`${taskLabel(run, taskId)} is ${task.status}; only a failed or blocked Task is retried`);
  }
  const previous = latestSettledDispatch(run, task.id);
  if (previous === undefined) throw new Error(`${taskLabel(run, taskId)} has no settled attempt to retry`);
  return { task, retryOf: previous.id };
}

/** Orca lists a Task `ready` before its parents complete, so each parent is checked here. */
async function readyTasks(run: Run, git: Git): Promise<{ startable: Attempt[]; waiting: string[] }> {
  const startable: Attempt[] = [];
  const waiting: string[] = [];
  for (const task of run.tasks.filter((t) => t.status === "ready")) {
    const unlanded = await unlandedParents(run, task, git);
    if (unlanded.length === 0) {
      startable.push({ task, retryOf: undefined });
    } else {
      waiting.push(`${taskLabel(run, task.id)}: waits for ${unlanded.join(", ")} to merge into ${MAIN}`);
    }
  }
  return { startable, waiting };
}

async function unlandedParents(run: Run, task: Task, git: Git): Promise<string[]> {
  const parents = task.deps.map((id) => taskById(run, id));
  const landings = await Promise.all(parents.map((parent) => landing(run, parent, git)));
  return landings
    .filter((l) => l.task.status !== "completed" || !l.merged)
    .map((l) => taskLabel(run, l.task.id));
}

async function startAttempts(
  run: Run,
  attempts: readonly Attempt[],
  options: AdvanceOptions,
  orca: Orca,
): Promise<string[]> {
  const started: string[] = [];
  for (const attempt of attempts) {
    const dispatchId = await startWorker(run, attempt, options, orca);
    await sendStartingMessage(run, attempt.task, dispatchId, orca);
    started.push(`${taskLabel(run, attempt.task.id)} as ${dispatchId}`);
  }
  return started;
}

async function startWorker(
  run: Run,
  attempt: Attempt,
  options: AdvanceOptions,
  orca: Orca,
): Promise<string> {
  const retry = attempt.retryOf === undefined ? [] : ["--retry-of", attempt.retryOf];
  const result = await orca([
    "worker-start",
    "--run", run.id,
    "--task", attempt.task.id,
    "--worktree", "new-top-level",
    "--agent", options.agent,
    "--model", options.model,
    "--base-branch", options.baseBranch,
    ...retry,
  ]);
  return text(fields(result, "worker-start result"), "dispatchId");
}

/** Every attempt waits for this before any work, so it is sent even when there is nothing to
 *  hand over: a new attempt cannot read its predecessors' asks itself. */
async function sendStartingMessage(
  run: Run,
  task: Task,
  dispatchId: string,
  orca: Orca,
): Promise<void> {
  const earlier = distinctQuestions(run.questions.filter((q) => q.taskId === task.id));
  await orca([
    "send",
    "--run", run.id,
    "--to", `dispatch:${dispatchId}`,
    "--subject", `Earlier questions: ${task.title}`,
    "--body", earlierQuestionsMessage(earlier),
  ]);
}

/** When an ask was repeated, the copy that got an answer wins. */
function distinctQuestions(questions: readonly Question[]): Question[] {
  const byText = new Map<string, Question>();
  for (const question of questions) {
    const seen = byText.get(question.text);
    if (seen === undefined || (seen.reply === undefined && question.reply !== undefined)) {
      byText.set(question.text, question);
    }
  }
  return [...byText.values()].sort(bySequence);
}

function earlierQuestionsMessage(questions: readonly Question[]): string {
  if (questions.length === 0) return "This Task has no earlier questions.";
  const entries = questions.map((question) =>
    [
      `Question ${question.id}:`,
      question.text,
      question.reply === undefined ? "No answer. Ask it again if it still applies." : `Answer:\n${question.reply}`,
    ].join("\n"),
  );
  return ["Earlier attempts of this Task asked these questions.", ...entries].join("\n\n");
}

// ── Describing ───────────────────────────────────────────────────────────────

function section(heading: string, entries: readonly string[]): string {
  return entries.length === 0 ? `${heading}: none` : [`${heading}:`, ...entries].join("\n");
}

function taskLabel(run: Run, taskId: string): string {
  return `${taskId} (${taskById(run, taskId).title})`;
}

function indented(body: string): string {
  return body
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

function describeOpenQuestion(run: Run, question: Question): string {
  const count = itemQuestionCount(run);
  return [
    `  ${question.id} from ${taskLabel(run, question.taskId)}, ${count} question${count === 1 ? "" : "s"} on this item`,
    indented(question.text),
  ].join("\n");
}

function describeClosedQuestion(run: Run, question: Question): string {
  return [
    `  ${question.id} from ${taskLabel(run, question.taskId)}, attempt ${question.dispatchId} ended: closed, no answer`,
    indented(question.text),
  ].join("\n");
}

function describeFailure(run: Run, task: Task): string {
  const attempts = attemptCount(run, task.id);
  const heading = `  ${taskLabel(run, task.id)}: ${task.status}, ${attempts} attempt${attempts === 1 ? "" : "s"}`;
  if (task.result.kind === "report") {
    return [heading, indented(task.result.subject), indented(task.result.body)].join("\n");
  }
  if (task.status === "ready") return [heading, indented("ended without a report")].join("\n");
  return heading;
}

function describeItemReport(run: Run, task: Task): string {
  const heading = `  ${taskLabel(run, task.id)}`;
  if (task.result.kind !== "report") return [heading, indented("completed without a report")].join("\n");
  return [heading, indented(task.result.subject), indented(task.result.body)].join("\n");
}

function describeGate(run: Run, gate: Gate): string {
  return [`  ${gate.id} on ${taskLabel(run, gate.taskId)}`, indented(gate.question)].join("\n");
}

function describeAwaitingMerge(landing: Landing): string {
  const task = `  ${landing.task.id} (${landing.task.title})`;
  if (landing.worktree === undefined) {
    return `${task}: no worktree recorded, so not known to be merged into ${MAIN}`;
  }
  return `${task}: ${landing.worktree} not merged into ${MAIN}`;
}

// ── Options ──────────────────────────────────────────────────────────────────

function runOptions(args: readonly string[]): { run: string } {
  const { values } = parseArgs({ args: [...args], options: { run: { type: "string" } } });
  return { run: required(values.run, "--run") };
}

function replyOptions(args: readonly string[]): { run: string; id: string; answer: string } {
  const { values } = parseArgs({
    args: [...args],
    options: { run: { type: "string" }, id: { type: "string" }, answer: { type: "string" } },
  });
  return {
    run: required(values.run, "--run"),
    id: required(values.id, "--id"),
    answer: required(values.answer, "--answer"),
  };
}

function gateOptions(args: readonly string[]): { run: string; id: string; resolution: string } {
  const { values } = parseArgs({
    args: [...args],
    options: { run: { type: "string" }, id: { type: "string" }, resolution: { type: "string" } },
  });
  return {
    run: required(values.run, "--run"),
    id: required(values.id, "--id"),
    resolution: required(values.resolution, "--resolution"),
  };
}

function advanceOptions(args: readonly string[]): AdvanceOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      run: { type: "string" },
      agent: { type: "string", default: ADVANCE_DEFAULTS.agent },
      model: { type: "string", default: ADVANCE_DEFAULTS.model },
      cap: { type: "string", default: ADVANCE_DEFAULTS.cap },
      "base-branch": { type: "string", default: ADVANCE_DEFAULTS.baseBranch },
      retry: { type: "string", multiple: true, default: [] },
      cancel: { type: "string", multiple: true, default: [] },
    },
  });
  const cap = Number(values.cap);
  if (!Number.isInteger(cap) || cap < 0) throw new Error(`--cap must be a whole number, got ${values.cap}`);
  const both = values.retry.filter((taskId) => values.cancel.includes(taskId));
  if (both.length > 0) throw new Error(`a Task is either retried or cancelled, not both: ${both.join(", ")}`);
  return {
    run: required(values.run, "--run"),
    agent: values.agent,
    model: values.model,
    cap,
    baseBranch: values["base-branch"],
    retry: values.retry,
    cancel: values.cancel,
  };
}

function required(value: string | undefined, flag: string): string {
  if (value === undefined || value === "") throw new Error(`${flag} is required\n${USAGE}`);
  return value;
}

// ── Orca JSON ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Orca returned a ${what} that is not an object`);
  return value;
}

function list(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`Orca returned no list at "${key}"`);
  return value;
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Orca returned no text at "${key}"`);
  return value;
}

function optionalText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Orca returned "${key}" that is not text`);
  return value;
}

function number(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number") throw new Error(`Orca returned no number at "${key}"`);
  return value;
}

function bySequence(a: { sequence: number }, b: { sequence: number }): number {
  return a.sequence - b.sequence;
}

// ── The real git ─────────────────────────────────────────────────────────────

export function gitCli(): Git {
  return {
    worktreeExists: existsSync,
    headIsOnMain: (worktree) => succeeds("git", ["merge-base", "--is-ancestor", "HEAD", MAIN], worktree),
  };
}

if (import.meta.main) {
  tick(process.argv.slice(2), orcaCli(process.cwd()), gitCli()).then(
    (output) => console.log(output),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
