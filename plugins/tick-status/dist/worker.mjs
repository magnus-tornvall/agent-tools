// plugins/tick-status/worker.ts
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";

// src/orca/tick.ts
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

// src/shell.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var MAX_BUFFER = 64 * 1024 * 1024;
async function sh(cmd, args, cwd) {
  const { stdout } = await execFileAsync(cmd, args, { cwd, maxBuffer: MAX_BUFFER });
  return stdout.trim();
}
async function succeeds(cmd, args, cwd) {
  return sh(cmd, args, cwd).then(() => true, () => false);
}

// src/orca/orca.ts
class OrcaRefusal extends Error {
  requestId;
  constructor(message, requestId) {
    super(message);
    this.requestId = requestId;
    this.name = "OrcaRefusal";
  }
}
function orcaCli(cwd, run = sh) {
  return async (args) => {
    const output = await run("orca", ["orchestration", ...args, "--json"], cwd).catch((error) => {
      throw orcaRefusal(args, error);
    });
    return orcaResult(args, output);
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function envelope(args, output) {
  const parsed = JSON.parse(output);
  if (!isRecord(parsed))
    throw new Error(`Orca returned a orca ${args[0]} reply that is not an object`);
  return parsed;
}
function orcaResult(args, output) {
  const reply = envelope(args, output);
  if (reply.ok !== true)
    throw orcaError(args, reply.error);
  return reply.result;
}
function orcaRefusal(args, error) {
  if (!isRecord(error) || typeof error.stdout !== "string" || !error.stdout.startsWith("{")) {
    return error;
  }
  return orcaError(args, envelope(args, error.stdout).error);
}
function orcaError(args, error) {
  const detail = isRecord(error) ? `${String(error.code)}: ${String(error.message)}` : "no error given";
  const data = isRecord(error) && isRecord(error.data) ? error.data : {};
  const requestId = typeof data.orchestrationRequestId === "string" ? data.orchestrationRequestId : undefined;
  return new OrcaRefusal(`orca orchestration ${args[0]} refused: ${detail}`, requestId);
}

// src/orca/surprise-check.ts
var SURPRISE_CHECK_KIND = "surprise-check";

// src/orca/tick.ts
var MAIN = "main";
var OPTIONS = {
  use: { run: { type: "string" } },
  status: { run: { type: "string" } },
  reply: { run: { type: "string" }, id: { type: "string" }, answer: { type: "string" } },
  gate: { run: { type: "string" }, id: { type: "string" }, resolution: { type: "string" } },
  advance: {
    run: { type: "string" },
    agent: { type: "string", default: "claude" },
    model: { type: "string", default: "sonnet" },
    cap: { type: "string", default: "1" },
    "base-branch": { type: "string", default: MAIN },
    retry: { type: "string", multiple: true, default: [] },
    cancel: { type: "string", multiple: true, default: [] }
  }
};
var HELP = {
  use: {
    summary: "Binds this terminal to the Run, fencing whichever terminal held it before.",
    values: { run: "<run_id>" }
  },
  status: {
    summary: "Opens a gate on each failed surprise check that has none, then lists the Run's open questions, " + "closed questions, open gates, failed attempts, completed Tasks not merged into main, and the item " + "report: a succeeded surprise check's report.",
    values: { run: "<run_id>" }
  },
  reply: {
    summary: "Answers one open question. Refuses one that already has a reply or whose attempt has ended.",
    values: { run: "<run_id>", id: "<message_id>", answer: "<text>" }
  },
  gate: {
    summary: "Resolves one open gate with the owner's ruling. Refuses a gate that is resolved or not in the Run.",
    values: { run: "<run_id>", id: "<gate_id>", resolution: "<text>" }
  },
  advance: {
    summary: "Cancels each --cancel Task, releases settled workers, then starts attempts up to --cap in flight: " + "--retry Tasks first, only failed or blocked ones, then ready Tasks whose parents have merged into main.",
    values: { run: "<run_id>", retry: "<task_id>", cancel: "<task_id>" }
  }
};
var SETTLED_DISPATCH = new Set(["completed", "failed", "circuit_broken"]);
var INBOX_LIMIT = "10000";
var WORKER_PAGE_SIZE = "100";
var SURPRISE_CHECK_QUESTION = "The surprise check failed. Rule on each surprise its report says needs a decision; " + "after a crash, resolve to run it again.";
async function tick(argv, orca, git) {
  const [command, ...args] = argv;
  switch (command) {
    case "help":
      return help();
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
      throw new Error(help());
  }
}
async function use(options, orca) {
  await orca(["run-use", "--id", options.run]);
  return `This terminal is bound to Run ${options.run}.`;
}
async function status(options, orca, git) {
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
    section("Item report", succeededSurpriseChecks(run).map((t) => describeItemReport(run, t)))
  ].join(`

`);
}
async function gateFailedSurpriseChecks(run, orca) {
  const ungated = run.tasks.filter((task) => task.kind === SURPRISE_CHECK_KIND && task.status === "failed" && !isCancelled(task) && !run.openGates.some((gate) => gate.taskId === task.id));
  const opened = [];
  for (const task of ungated) {
    const result = await orca(["gate-create", "--task", task.id, "--question", SURPRISE_CHECK_QUESTION]);
    opened.push(parseGate(fields(result, "gate-create result").gate));
  }
  return opened;
}
async function reply(options, orca) {
  const run = await readRun(orca, options.run);
  const question = questionById(run, options.id);
  refuseUnlessOpen(run, question);
  await orca(["reply", "--run", run.id, "--id", question.id, "--body", options.answer]);
  return `Replied to ${question.id} for ${taskLabel(run, question.taskId)}.`;
}
async function resolveGate(options, orca) {
  const run = await readRun(orca, options.run);
  const gate = run.openGates.find((g) => g.id === options.id);
  if (gate === undefined) {
    throw new Error(`Run ${run.id} has no open gate ${options.id}: it is resolved or not in this Run. Nothing was sent.`);
  }
  await orca(["gate-resolve", "--id", gate.id, "--resolution", options.resolution]);
  return `Resolved ${gate.id} on ${taskLabel(run, gate.taskId)}.`;
}
async function advance(options, orca, git) {
  const cancelled = await cancelTasks(options, orca);
  const run = await readRun(orca, options.run);
  const released = await releaseSettledWorkers(run, orca);
  const plan = await planAttempts(run, options, git);
  const started = await startAttempts(run, plan.starting, options, orca);
  return [
    section("Cancelled", cancelled),
    section("Released", released),
    section("Started", started),
    section("Held", plan.held)
  ].join(`

`);
}
async function readRun(orca, id) {
  const [tasks, dispatches, messages, openGates] = await Promise.all([
    listTasks(orca, id),
    listDispatches(orca, id),
    listMessages(orca, id),
    listOpenGates(orca, id)
  ]);
  return { id, tasks, dispatches, questions: questionsIn(messages, dispatches), openGates };
}
async function listTasks(orca, run) {
  const result = fields(await orca(["task-list", "--run", run]), "task-list result");
  return list(result, "tasks").map(parseTask);
}
async function listDispatches(orca, run) {
  const dispatches = [];
  let cursor;
  do {
    const paging = cursor === undefined ? [] : ["--cursor", cursor];
    const args = ["worker-list", "--run", run, "--limit", WORKER_PAGE_SIZE, ...paging];
    const result = fields(await orca(args), "worker-list result");
    dispatches.push(...list(result, "workers").map(parseDispatch));
    cursor = optionalText(fields(result.page, "worker-list page"), "nextCursor");
  } while (cursor !== undefined);
  return dispatches;
}
async function listMessages(orca, run) {
  const result = fields(await orca(["inbox", "--full", "--limit", INBOX_LIMIT]), "inbox result");
  return list(result, "messages").map((row) => fields(row, "inbox message")).filter((row) => row.run_id === run).map(parseMessage);
}
async function listOpenGates(orca, run) {
  const result = fields(await orca(["gate-list", "--run", run, "--status", "pending"]), "gate-list result");
  return list(result, "gates").map(parseGate);
}
function parseTask(row) {
  const task = fields(row, "task");
  const id = text(task, "id");
  return {
    id,
    title: text(task, "task_title"),
    status: text(task, "status"),
    deps: parseDeps(text(task, "deps")),
    result: parseTaskResult(optionalText(task, "result")),
    kind: specKind(id, text(task, "spec"))
  };
}
function specKind(taskId, spec) {
  const lines = spec.split(`
`);
  if (lines[0] !== "---")
    return;
  const end = lines.indexOf("---", 1);
  if (end === -1)
    throw new Error(`Task ${taskId} has a spec whose frontmatter is never closed by ---`);
  let frontmatter;
  try {
    frontmatter = Bun.YAML.parse(lines.slice(1, end).join(`
`));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Task ${taskId} has a spec whose frontmatter does not parse: ${reason}`, { cause: error });
  }
  if (!isRecord2(frontmatter))
    throw new Error(`Task ${taskId} has a spec whose frontmatter is not a mapping`);
  const kind = frontmatter.kind;
  if (kind !== undefined && typeof kind !== "string") {
    throw new Error(`Task ${taskId} has a spec whose frontmatter kind is not text`);
  }
  return kind;
}
function parseDeps(raw) {
  const deps = JSON.parse(raw);
  if (!Array.isArray(deps) || !deps.every((dep) => typeof dep === "string")) {
    throw new Error(`Orca returned task deps that are not a list of IDs: ${raw}`);
  }
  return deps;
}
function parseTaskResult(raw) {
  if (raw === undefined)
    return { kind: "none" };
  if (!raw.startsWith("{"))
    return { kind: "note", text: raw };
  const report = fields(JSON.parse(raw), "task result");
  return {
    kind: "report",
    outcome: text(report, "outcome"),
    subject: optionalText(report, "subject") ?? "",
    body: optionalText(report, "body") ?? ""
  };
}
function parseDispatch(row) {
  const worker = fields(row, "worker");
  const projection = fields(worker.projection, "worker projection");
  const nextAction = fields(projection.nextAction, "worker nextAction");
  return {
    id: text(worker, "dispatchId"),
    taskId: text(worker, "taskId"),
    status: text(worker, "dispatchStatus"),
    live: text(fields(projection.liveness, "worker liveness"), "verdict") === "live",
    worktree: worktreePath(worker.resource),
    releasable: list(nextAction, "argv").includes("worker-release")
  };
}
function parseGate(row) {
  const gate = fields(row, "gate");
  return { id: text(gate, "id"), taskId: text(gate, "task_id"), question: text(gate, "question") };
}
function worktreePath(resource) {
  if (resource === null)
    return;
  const worktreeId = optionalText(fields(resource, "worker resource"), "worktreeId");
  return worktreeId?.split("::")[1];
}
function parseMessage(row) {
  return {
    id: text(row, "id"),
    sequence: number(row, "sequence"),
    type: text(row, "type"),
    threadId: optionalText(row, "thread_id"),
    body: optionalText(row, "body") ?? "",
    payload: optionalText(row, "payload")
  };
}
function questionsIn(messages, dispatches) {
  return messages.filter((message) => message.type === "question").map((message) => {
    const payload = fields(JSON.parse(message.payload ?? "null"), "question payload");
    const dispatchId = text(payload, "dispatchId");
    const replies = messages.filter((m) => m.threadId === message.id && m.id !== message.id).sort(bySequence);
    return {
      id: message.id,
      sequence: message.sequence,
      taskId: text(payload, "taskId"),
      dispatchId,
      text: message.body,
      reply: replies.at(-1)?.body,
      attemptEnded: !isActive(dispatches.find((d) => d.id === dispatchId))
    };
  }).sort(bySequence);
}
function isActive(dispatch) {
  return dispatch !== undefined && !SETTLED_DISPATCH.has(dispatch.status);
}
function isCancelled(task) {
  return task.status === "failed" && task.result.kind === "note" && task.result.text === "cancelled";
}
function isOpen(question) {
  return !question.attemptEnded && question.reply === undefined;
}
function openQuestions(run) {
  return run.questions.filter(isOpen);
}
function closedQuestions(run) {
  return run.questions.filter((question) => {
    const task = taskById(run, question.taskId);
    return question.attemptEnded && question.reply === undefined && task.status !== "completed" && !isCancelled(task);
  });
}
function failedTasks(run) {
  return run.tasks.filter((task) => {
    if (isCancelled(task))
      return false;
    if (task.status === "failed" || task.status === "blocked")
      return true;
    return task.status === "ready" && latestDispatch(run, task.id)?.status === "failed";
  });
}
function succeededSurpriseChecks(run) {
  return run.tasks.filter((task) => task.kind === SURPRISE_CHECK_KIND && task.status === "completed");
}
function attemptCount(run, taskId) {
  return run.dispatches.filter((dispatch) => dispatch.taskId === taskId).length;
}
function latestDispatch(run, taskId) {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId);
}
function activeDispatch(run, taskId) {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId && isActive(dispatch));
}
function latestSettledDispatch(run, taskId) {
  return run.dispatches.find((dispatch) => dispatch.taskId === taskId && !isActive(dispatch));
}
function inFlight(run) {
  return run.dispatches.filter(isActive).length;
}
function landedWorktree(run, task) {
  return run.dispatches.find((d) => d.taskId === task.id && d.status === "completed")?.worktree;
}
async function landing(run, task, git) {
  const worktree = landedWorktree(run, task);
  const merged = worktree !== undefined && (!git.worktreeExists(worktree) || await git.headIsOnMain(worktree));
  return { task, worktree, merged };
}
async function completedTasksAwaitingMerge(run, git) {
  const completed = run.tasks.filter((task) => task.status === "completed");
  const landings = await Promise.all(completed.map((task) => landing(run, task, git)));
  return landings.filter((l) => !l.merged);
}
function itemQuestionCount(run) {
  return new Set(run.questions.map((question) => question.text)).size;
}
function taskById(run, taskId) {
  const task = run.tasks.find((t) => t.id === taskId);
  if (task === undefined)
    throw new Error(`Run ${run.id} has no Task ${taskId}`);
  return task;
}
function questionById(run, messageId) {
  const question = run.questions.find((q) => q.id === messageId);
  if (question === undefined)
    throw new Error(`Run ${run.id} has no question ${messageId}`);
  return question;
}
function refuseUnlessOpen(run, question) {
  const task = taskLabel(run, question.taskId);
  if (question.attemptEnded) {
    throw new Error(`Question ${question.id} for ${task} is closed: its attempt ${question.dispatchId} has ended. ` + `Nothing was sent; the retry asks it again.`);
  }
  if (question.reply !== undefined) {
    throw new Error(`Question ${question.id} for ${task} already has a reply. Nothing was sent.`);
  }
}
async function cancelTasks(options, orca) {
  if (options.cancel.length === 0)
    return [];
  const run = await readRun(orca, options.run);
  const cancelled = [];
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
async function releaseSettledWorkers(run, orca) {
  const releasable = run.dispatches.filter((dispatch) => dispatch.releasable);
  for (const dispatch of releasable) {
    await orca(["worker-release", "--dispatch", dispatch.id]);
  }
  return releasable.map((dispatch) => `${dispatch.id} (${taskLabel(run, dispatch.taskId)})`);
}
async function planAttempts(run, options, git) {
  const retries = options.retry.map((taskId) => retryOf(run, taskId));
  const ready = await readyTasks(run, git);
  const candidates = [...retries, ...ready.startable];
  const slots = Math.max(0, options.cap - inFlight(run));
  return {
    starting: candidates.slice(0, slots),
    held: [
      ...candidates.slice(slots).map((a) => `${taskLabel(run, a.task.id)}: cap of ${options.cap} reached`),
      ...ready.waiting
    ]
  };
}
function retryOf(run, taskId) {
  const task = taskById(run, taskId);
  if (task.status !== "failed" && task.status !== "blocked") {
    throw new Error(`${taskLabel(run, taskId)} is ${task.status}; only a failed or blocked Task is retried`);
  }
  const previous = latestSettledDispatch(run, task.id);
  if (previous === undefined)
    throw new Error(`${taskLabel(run, taskId)} has no settled attempt to retry`);
  return { task, retryOf: previous.id };
}
async function readyTasks(run, git) {
  const startable = [];
  const waiting = [];
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
async function unlandedParents(run, task, git) {
  const parents = task.deps.map((id) => taskById(run, id));
  const landings = await Promise.all(parents.map((parent) => landing(run, parent, git)));
  return landings.filter((l) => l.task.status !== "completed" || !l.merged).map((l) => taskLabel(run, l.task.id));
}
async function startAttempts(run, attempts, options, orca) {
  const started = [];
  for (const attempt of attempts) {
    const dispatchId = await startWorker(run, attempt, options, orca);
    await sendStartingMessage(run, attempt.task, dispatchId, orca);
    started.push(`${taskLabel(run, attempt.task.id)} as ${dispatchId}`);
  }
  return started;
}
async function startWorker(run, attempt, options, orca) {
  const retry = attempt.retryOf === undefined ? [] : ["--retry-of", attempt.retryOf];
  const result = await orca([
    "worker-start",
    "--run",
    run.id,
    "--task",
    attempt.task.id,
    "--worktree",
    "new-top-level",
    "--agent",
    options.agent,
    "--model",
    options.model,
    "--base-branch",
    options.baseBranch,
    ...retry
  ]);
  return text(fields(result, "worker-start result"), "dispatchId");
}
async function sendStartingMessage(run, task, dispatchId, orca) {
  const earlier = distinctQuestions(run.questions.filter((q) => q.taskId === task.id));
  await orca([
    "send",
    "--run",
    run.id,
    "--to",
    `dispatch:${dispatchId}`,
    "--subject",
    `Earlier questions: ${task.title}`,
    "--body",
    earlierQuestionsMessage(earlier)
  ]);
}
function distinctQuestions(questions) {
  const byText = new Map;
  for (const question of questions) {
    const seen = byText.get(question.text);
    if (seen === undefined || seen.reply === undefined && question.reply !== undefined) {
      byText.set(question.text, question);
    }
  }
  return [...byText.values()].sort(bySequence);
}
function earlierQuestionsMessage(questions) {
  if (questions.length === 0)
    return "This Task has no earlier questions.";
  const entries = questions.map((question) => [
    `Question ${question.id}:`,
    question.text,
    question.reply === undefined ? "No answer. Ask it again if it still applies." : `Answer:
${question.reply}`
  ].join(`
`));
  return ["Earlier attempts of this Task asked these questions.", ...entries].join(`

`);
}
function section(heading, entries) {
  return entries.length === 0 ? `${heading}: none` : [`${heading}:`, ...entries].join(`
`);
}
function taskLabel(run, taskId) {
  return `${taskId} (${taskById(run, taskId).title})`;
}
function indented(body) {
  return body.split(`
`).map((line) => `    ${line}`).join(`
`);
}
function describeOpenQuestion(run, question) {
  const count = itemQuestionCount(run);
  return [
    `  ${question.id} from ${taskLabel(run, question.taskId)}, ${count} question${count === 1 ? "" : "s"} on this item`,
    indented(question.text)
  ].join(`
`);
}
function describeClosedQuestion(run, question) {
  return [
    `  ${question.id} from ${taskLabel(run, question.taskId)}, attempt ${question.dispatchId} ended: closed, no answer`,
    indented(question.text)
  ].join(`
`);
}
function describeFailure(run, task) {
  const attempts = attemptCount(run, task.id);
  const heading = `  ${taskLabel(run, task.id)}: ${task.status}, ${attempts} attempt${attempts === 1 ? "" : "s"}`;
  if (task.result.kind === "report") {
    return [heading, indented(task.result.subject), indented(task.result.body)].join(`
`);
  }
  if (task.status === "ready")
    return [heading, indented("ended without a report")].join(`
`);
  return heading;
}
function describeItemReport(run, task) {
  const heading = `  ${taskLabel(run, task.id)}`;
  if (task.result.kind !== "report")
    return [heading, indented("completed without a report")].join(`
`);
  return [heading, indented(task.result.subject), indented(task.result.body)].join(`
`);
}
function describeGate(run, gate) {
  return [`  ${gate.id} on ${taskLabel(run, gate.taskId)}`, indented(gate.question)].join(`
`);
}
function describeAwaitingMerge(landing2) {
  const task = `  ${landing2.task.id} (${landing2.task.title})`;
  if (landing2.worktree === undefined) {
    return `${task}: no worktree recorded, so not known to be merged into ${MAIN}`;
  }
  return `${task}: ${landing2.worktree} not merged into ${MAIN}`;
}
function help() {
  const commands = Object.keys(OPTIONS).filter(isCommand).map((command) => [`  ${commandUsage(command)}`, `    ${HELP[command].summary}`].join(`
`));
  return [
    "usage: bun <this script> <command> [flags]",
    "",
    "Commands:",
    ...commands,
    ["  help", "    Prints this."].join(`
`)
  ].join(`
`);
}
function isCommand(name) {
  return Object.hasOwn(OPTIONS, name);
}
function commandUsage(command) {
  const descriptors = OPTIONS[command];
  const values = HELP[command].values;
  const flags = Object.entries(descriptors).map(([name, descriptor]) => {
    if (typeof descriptor.default === "string")
      return `[--${name} ${descriptor.default}]`;
    const value = values[name];
    if (value === undefined)
      throw new Error(`help names no value for ${command} --${name}`);
    return descriptor.multiple === true ? `[--${name} ${value}]...` : `--${name} ${value}`;
  });
  return [command, ...flags].join(" ");
}
function runOptions(args) {
  const { values } = parseArgs({ args: [...args], options: OPTIONS.status });
  return { run: required(values.run, "--run") };
}
function replyOptions(args) {
  const { values } = parseArgs({ args: [...args], options: OPTIONS.reply });
  return {
    run: required(values.run, "--run"),
    id: required(values.id, "--id"),
    answer: required(values.answer, "--answer")
  };
}
function gateOptions(args) {
  const { values } = parseArgs({ args: [...args], options: OPTIONS.gate });
  return {
    run: required(values.run, "--run"),
    id: required(values.id, "--id"),
    resolution: required(values.resolution, "--resolution")
  };
}
function advanceOptions(args) {
  const { values } = parseArgs({ args: [...args], options: OPTIONS.advance });
  const cap = Number(values.cap);
  if (!Number.isInteger(cap) || cap < 0)
    throw new Error(`--cap must be a whole number, got ${values.cap}`);
  const both = values.retry.filter((taskId) => values.cancel.includes(taskId));
  if (both.length > 0)
    throw new Error(`a Task is either retried or cancelled, not both: ${both.join(", ")}`);
  return {
    run: required(values.run, "--run"),
    agent: values.agent,
    model: values.model,
    cap,
    baseBranch: values["base-branch"],
    retry: values.retry,
    cancel: values.cancel
  };
}
function required(value, flag) {
  if (value === undefined || value === "")
    throw new Error(`${flag} is required
${help()}`);
  return value;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function fields(value, what) {
  if (!isRecord2(value))
    throw new Error(`Orca returned a ${what} that is not an object`);
  return value;
}
function list(record, key) {
  const value = record[key];
  if (!Array.isArray(value))
    throw new Error(`Orca returned no list at "${key}"`);
  return value;
}
function text(record, key) {
  const value = record[key];
  if (typeof value !== "string")
    throw new Error(`Orca returned no text at "${key}"`);
  return value;
}
function optionalText(record, key) {
  const value = record[key];
  if (value === null || value === undefined)
    return;
  if (typeof value !== "string")
    throw new Error(`Orca returned "${key}" that is not text`);
  return value;
}
function number(record, key) {
  const value = record[key];
  if (typeof value !== "number")
    throw new Error(`Orca returned no number at "${key}"`);
  return value;
}
function bySequence(a, b) {
  return a.sequence - b.sequence;
}
function gitCli() {
  return {
    worktreeExists: existsSync,
    headIsOnMain: (worktree) => succeeds("git", ["merge-base", "--is-ancestor", "HEAD", MAIN], worktree)
  };
}
if (false) {}

// plugins/tick-status/status.ts
var STATUS_PORT = 47821;
var RUN_ID = /^run_[0-9a-f]{12}$/;
function isRunId(value) {
  return typeof value === "string" && RUN_ID.test(value);
}
function countsOf(statusText) {
  const entries = (heading) => {
    const start = statusText.split(`
`).findIndex((line) => line.startsWith(`${heading}:`));
    if (start === -1)
      throw new Error(`status text has no "${heading}" section`);
    const lines = statusText.split(`
`).slice(start + 1);
    const end = lines.findIndex((line) => line !== "" && !line.startsWith(" "));
    return (end === -1 ? lines : lines.slice(0, end)).filter((line) => /^ {2}\S/.test(line)).length;
  };
  return {
    questions: entries("Open questions"),
    failed: entries("Failed attempts"),
    awaitingMerge: entries("Awaiting merge")
  };
}
function describeCounts(run, counts) {
  return {
    title: `Tick status ${run}`,
    body: `${counts.questions} open questions, ${counts.failed} failed attempts, ${counts.awaitingMerge} awaiting merge`
  };
}
function liveStatus(cwd) {
  return (run) => tick(["status", "--run", run], orcaCli(cwd), gitCli());
}

// plugins/tick-status/worker.ts
var RUN_FILE = join(homedir(), ".orca", "tick-status-run");
function createPlugin(deps) {
  return async (ctx) => {
    ctx.commands.register("tick-status.show", async (args) => {
      const given = typeof args === "object" && args !== null ? args.runId : undefined;
      const run = given ?? (await deps.storedRun()).trim();
      if (!isRunId(run))
        throw new Error(`not a Run ID: ${String(run)}`);
      const { title, body } = describeCounts(run, countsOf(await deps.status(run)));
      await ctx.host.call("notifications.show", { title, body });
      return { title, body };
    });
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const run = url.searchParams.get("run");
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (url.pathname !== "/status" || !isRunId(run)) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("expected /status?run=<run_id>");
        return;
      }
      deps.status(run).then((text2) => res.writeHead(200, { "Content-Type": "text/plain" }).end(text2), (error) => res.writeHead(500, { "Content-Type": "text/plain" }).end(error instanceof Error ? error.message : String(error)));
    });
    server.on("error", (error) => ctx.log(`status server: ${error.message}`));
    server.listen(deps.port, "127.0.0.1");
  };
}
var worker_default = createPlugin({
  status: liveStatus(homedir()),
  storedRun: () => readFile(RUN_FILE, "utf8"),
  port: STATUS_PORT
});
export {
  worker_default as default,
  createPlugin
};
