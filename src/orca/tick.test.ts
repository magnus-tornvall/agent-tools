import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Shape } from "../shape/shape.ts";
import { surpriseCheckSpec } from "./surprise-check.ts";
import { tick, type Git, type Orca } from "./tick.ts";

/**
 * Orca's JSON here is recorded from real Runs (src/orca/fixtures/tick). No recorded Run had a worker
 * still in flight, live, or named for release, so those states are patched onto recorded rows
 * with `patchWorker`, and each test shows what it changed.
 */

const QUESTION_RUN = "run_cb7933432d5b"; // one Task; Q1 answered "alpha", Q2 never answered
const RETRIED_RUN = "run_b2242de9baef"; // one Task asked the same question in two failed attempts
const STATES_RUN = "run_d8de2b7afb55"; // parent, child of parent, two failures, one crash
const BLOCKED_RUN = "run_e50de7df8312"; // a Task left blocked by worker-stop
const CHECK_RUN = "run_c2dd1ed388a4"; // a failed surprise check, a failed plain Task, a broken spec

const CHECKER = "task_32e42474b2aa";
const PLAIN_FAILURE = "task_924675def058";
const BROKEN_SPEC = "task_da4463be28a0";

const OPEN_Q2 = "msg_4e6aeca7e929";
const ANSWERED_Q1 = "msg_c5cb2c2019c4";

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recorded(name: string): Fields {
  const envelope: unknown = JSON.parse(
    readFileSync(new URL(`./fixtures/tick/${name}.json`, import.meta.url), "utf8"),
  );
  if (!isFields(envelope) || !isFields(envelope.result)) throw new Error(`${name} has no result`);
  return envelope.result;
}

function rows(result: Fields, key: string): Fields[] {
  const value = result[key];
  if (!Array.isArray(value) || !value.every(isFields)) throw new Error(`no rows at ${key}`);
  return value;
}

function merge(target: Fields, patch: Fields): Fields {
  const merged: Fields = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    const current = target[key];
    merged[key] = isFields(current) && isFields(value) ? merge(current, value) : value;
  }
  return merged;
}

function patchRows(result: Fields, key: string, idKey: string, id: string, patch: Fields): Fields {
  const patched = rows(result, key).map((row) => (row[idKey] === id ? merge(row, patch) : row));
  return { ...result, [key]: patched };
}

type RunFixture = { tasks: Fields; workers: Fields; inbox: Fields; gates: Fields };

function recordedRun(run: string): RunFixture {
  return {
    tasks: recorded(`tasks-${run}`),
    workers: recorded(`workers-${run}`),
    inbox: recorded("inbox"),
    gates: recorded(`gates-${run}`),
  };
}

/** The recorded broken spec fails every read of its Run, so all but its own test fix it. */
function checkRun(): RunFixture {
  return patchTask(recordedRun(CHECK_RUN), BROKEN_SPEC, { spec: "A Task whose spec has no frontmatter." });
}

function patchTask(fixture: RunFixture, taskId: string, patch: Fields): RunFixture {
  return { ...fixture, tasks: patchRows(fixture.tasks, "tasks", "id", taskId, patch) };
}

function patchWorker(fixture: RunFixture, dispatchId: string, patch: Fields): RunFixture {
  return { ...fixture, workers: patchRows(fixture.workers, "workers", "dispatchId", dispatchId, patch) };
}

const IN_FLIGHT = { dispatchStatus: "dispatched", projection: { liveness: { verdict: "live" } } };

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

/** Serves the recorded reads, `pageSize` workers per worker-list page, and logs every write. */
function fakeOrca(fixture: RunFixture, pageSize = 100) {
  const writes: string[][] = [];
  let started = 0;
  const orca: Orca = async (args) => {
    const command = args[0] ?? "";
    if (command === "task-list") return fixture.tasks;
    if (command === "inbox") return fixture.inbox;
    if (command === "gate-list") return fixture.gates;
    if (command === "worker-list") {
      const all = rows(fixture.workers, "workers");
      const from = Number(flag(args, "--cursor") ?? "0");
      const next = from + pageSize < all.length ? String(from + pageSize) : null;
      return { ...fixture.workers, workers: all.slice(from, from + pageSize), page: { nextCursor: next } };
    }
    writes.push([...args]);
    if (command === "gate-create") return recorded(`gate-create-${CHECK_RUN}`);
    if (command === "worker-start") {
      started += 1;
      return { dispatchId: `ctx_new${started}`, state: "ready", taskId: flag(args, "--task") };
    }
    return {};
  };
  return { orca, writes };
}

function fakeGit(merged: readonly string[] = [], gone: readonly string[] = []): Git {
  return {
    worktreeExists: (worktree) => !gone.includes(worktree),
    headIsOnMain: async (worktree) => merged.includes(worktree),
  };
}

const PARENT_WORKTREE = "/Users/magnustornvall/orca/workspaces/vscode/parent";

/** The recorded parent completed through a context-only Dispatch, which has no worktree. */
function statesWithParentWorktree(): RunFixture {
  return patchWorker(recordedRun(STATES_RUN), "ctx_b6aa0c93ccc6", {
    resource: { worktreeId: `6bc3ed7d-7144-4def-988d-bfd072efe515::${PARENT_WORKTREE}` },
  });
}

function startsIn(writes: readonly string[][]): string[][] {
  return writes.filter((args) => args[0] === "worker-start");
}

describe("status", () => {
  test("lists a question with no reply on an active Dispatch, with its Task, ID and the item's count", async () => {
    const fixture = patchWorker(recordedRun(QUESTION_RUN), "ctx_feb1a69dcedd", IN_FLIGHT);
    const { orca } = fakeOrca(fixture);

    const output = await tick(["status", "--run", QUESTION_RUN], orca, fakeGit());

    expect(output).toContain(
      `Open questions:\n  ${OPEN_Q2} from task_7479c953ab51 (OO-23 ask/reply smoke), 2 questions on this item\n` +
        "    OO-23 Q2: unanswered on purpose, see smoke/oo23-report.md",
    );
    expect(output).not.toContain(ANSWERED_Q1);
  });

  test("counts a question asked again by a retry once", async () => {
    const fixture = patchWorker(recordedRun(RETRIED_RUN), "ctx_6ffdb33ed03c", IN_FLIGHT);
    const { orca } = fakeOrca(fixture);

    const output = await tick(["status", "--run", RETRIED_RUN], orca, fakeGit());

    expect(output).toContain("msg_6dbbe9c63b64 from task_d520a7fed9f5 (OO-24 smoke), 1 question on this item");
  });

  test("shows a question whose attempt ended as closed under that attempt, not as open", async () => {
    const fixture = patchTask(recordedRun(QUESTION_RUN), "task_7479c953ab51", { status: "failed" });
    const { orca } = fakeOrca(fixture);

    const output = await tick(["status", "--run", QUESTION_RUN], orca, fakeGit());

    expect(output).toContain("Open questions: none");
    expect(output).toContain(
      `Closed questions:\n  ${OPEN_Q2} from task_7479c953ab51 (OO-23 ask/reply smoke), ` +
        "attempt ctx_feb1a69dcedd ended: closed, no answer",
    );
  });

  test("lists failed, blocked and crashed Tasks with their attempt counts", async () => {
    const { orca } = fakeOrca(recordedRun(STATES_RUN));

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit());

    expect(output).toContain(
      "Failed attempts:\n" +
        "  task_b05e5b850779 (question): failed, 1 attempt\n" +
        "    Question: Which store holds rulings?\n" +
        "    Stopped at a one-way door.\n" +
        "  task_b221e4b2baaa (reported-failure): failed, 1 attempt\n" +
        "    Tests fail on main\n" +
        "    fixture\n" +
        "  task_0e09a0b5482c (inflight): ready, 1 attempt\n" +
        "    ended without a report",
    );
    expect(output).not.toContain("task_f5b2e9d3543b (child): ready");
  });

  test("counts every attempt worker-list names, across pages", async () => {
    const fixture = patchTask(recordedRun(RETRIED_RUN), "task_d520a7fed9f5", { status: "failed" });
    const { orca } = fakeOrca(fixture, 1);

    const output = await tick(["status", "--run", RETRIED_RUN], orca, fakeGit());

    expect(output).toContain("task_d520a7fed9f5 (OO-24 smoke): failed, 3 attempts");
  });

  test("lists a blocked Task as failed", async () => {
    const { orca } = fakeOrca(recordedRun(BLOCKED_RUN));

    const output = await tick(["status", "--run", BLOCKED_RUN], orca, fakeGit());

    expect(output).toContain("task_3f7cc52640da (A): blocked, 2 attempts");
  });

  test("leaves a cancelled Task out of the failed attempts", async () => {
    const fixture = patchTask(recordedRun(STATES_RUN), "task_b221e4b2baaa", { result: "cancelled" });
    const { orca } = fakeOrca(fixture);

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit());

    expect(output).not.toContain("task_b221e4b2baaa");
  });

  test("lists a completed Task whose worktree HEAD is not on main as awaiting merge", async () => {
    const { orca } = fakeOrca(statesWithParentWorktree());

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit());

    expect(output).toContain(
      `Awaiting merge:\n  task_98bf6fe80945 (parent): ${PARENT_WORKTREE} not merged into main`,
    );
  });

  test("counts a completed Task whose worktree was removed as merged", async () => {
    const { orca } = fakeOrca(statesWithParentWorktree());

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit([], [PARENT_WORKTREE]));

    expect(output).toContain("Awaiting merge: none");
  });

  test("says when a completed Task has no worktree recorded", async () => {
    const { orca } = fakeOrca(recordedRun(STATES_RUN));

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit());

    expect(output).toContain("task_98bf6fe80945 (parent): no worktree recorded, so not known to be merged");
  });

  test("leaves out a completed Task whose worktree HEAD is on main", async () => {
    const { orca } = fakeOrca(statesWithParentWorktree());

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit([PARENT_WORKTREE]));

    expect(output).toContain("Awaiting merge: none");
  });

  test("reads only messages of its own Run", async () => {
    const { orca } = fakeOrca(recordedRun(STATES_RUN));

    const output = await tick(["status", "--run", STATES_RUN], orca, fakeGit());

    expect(output).toContain("Open questions: none\n\nClosed questions: none");
  });

  test("writes nothing when no surprise check has failed", async () => {
    const fixture = patchWorker(recordedRun(QUESTION_RUN), "ctx_feb1a69dcedd", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    await tick(["status", "--run", QUESTION_RUN], orca, fakeGit());

    expect(writes).toEqual([]);
  });
});

describe("status on a surprise check", () => {
  const OPENED_GATE = "gate_9dc75bd5b9b2";

  function gateCreates(writes: readonly string[][]): (string | undefined)[] {
    return writes.filter((args) => args[0] === "gate-create").map((args) => flag(args, "--task"));
  }

  test("opens one gate on a failed surprise check with no open gate, and lists it", async () => {
    const { orca, writes } = fakeOrca(checkRun());

    const output = await tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    expect(gateCreates(writes)).toEqual([CHECKER]);
    expect(output).toContain(
      `Open gates:\n  ${OPENED_GATE} on ${CHECKER} (surprise check)\n` +
        "    The surprise check failed. Rule on each surprise its report says needs a decision; " +
        "after a crash, resolve to run it again.",
    );
  });

  test("opens no second gate on a surprise check that already has an open gate", async () => {
    const { orca, writes } = fakeOrca({ ...checkRun(), gates: recorded(`gates-gated-${CHECK_RUN}`) });

    const output = await tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    expect(writes).toEqual([]);
    expect(output).toContain(`Open gates:\n  ${OPENED_GATE} on ${CHECKER} (surprise check)`);
  });

  test("opens no gate on a failed Task whose spec has no surprise-check frontmatter", async () => {
    const fixture = patchTask(checkRun(), CHECKER, { status: "completed" });
    const { orca, writes } = fakeOrca(fixture);

    const output = await tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    expect(writes).toEqual([]);
    expect(output).toContain(`Failed attempts:\n  ${PLAIN_FAILURE} (plain failure): failed, 0 attempts`);
  });

  test("opens no gate on a cancelled surprise check", async () => {
    const fixture = patchTask(checkRun(), CHECKER, { result: "cancelled" });
    const { orca, writes } = fakeOrca(fixture);

    await tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    expect(writes).toEqual([]);
  });

  test("recognises a spec built from a shape", async () => {
    const shape: Shape = {
      outcome: "a gate opens",
      requirements: { R1: { text: "a gate opens", reason: "nothing to observe in a fixture" } },
      non_goals: {},
      approach: [],
      constraints: [],
      touchpoints: [],
      decisions: {},
    };
    const spec = surpriseCheckSpec({ shape, run: CHECK_RUN, checks: ["task_018b55e34b8b"] });
    const { orca, writes } = fakeOrca(patchTask(checkRun(), CHECKER, { spec }));

    await tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    expect(gateCreates(writes)).toEqual([CHECKER]);
  });

  test("reports a spec whose frontmatter does not parse, naming its Task, and writes nothing", async () => {
    const { orca, writes } = fakeOrca(recordedRun(CHECK_RUN));

    const reading = tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    await expect(reading).rejects.toThrow(`Task ${BROKEN_SPEC} has a spec whose frontmatter does not parse`);
    expect(writes).toEqual([]);
  });

  test("reports a spec whose frontmatter is never closed, naming its Task", async () => {
    const fixture = patchTask(checkRun(), PLAIN_FAILURE, { spec: "---\nkind: surprise-check\n" });
    const { orca } = fakeOrca(fixture);

    const reading = tick(["status", "--run", CHECK_RUN], orca, fakeGit());

    await expect(reading).rejects.toThrow(`Task ${PLAIN_FAILURE} has a spec whose frontmatter is never closed`);
  });
});

describe("reply", () => {
  test("replies in an open question's thread and writes nothing else", async () => {
    const fixture = patchWorker(recordedRun(QUESTION_RUN), "ctx_feb1a69dcedd", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    await tick(["reply", "--run", QUESTION_RUN, "--id", OPEN_Q2, "--answer", "beta"], orca, fakeGit());

    expect(writes).toEqual([["reply", "--run", QUESTION_RUN, "--id", OPEN_Q2, "--body", "beta"]]);
  });

  test("refuses a closed question, naming its Task, and sends nothing", async () => {
    const { orca, writes } = fakeOrca(recordedRun(QUESTION_RUN));

    const replying = tick(["reply", "--run", QUESTION_RUN, "--id", OPEN_Q2, "--answer", "beta"], orca, fakeGit());

    await expect(replying).rejects.toThrow(/task_7479c953ab51.*is closed/);
    expect(writes).toEqual([]);
  });

  test("refuses a question that already has a reply", async () => {
    const fixture = patchWorker(recordedRun(QUESTION_RUN), "ctx_feb1a69dcedd", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    const replying = tick(["reply", "--run", QUESTION_RUN, "--id", ANSWERED_Q1, "--answer", "beta"], orca, fakeGit());

    await expect(replying).rejects.toThrow(/already has a reply/);
    expect(writes).toEqual([]);
  });

  test("refuses a message that is not a question in the Run", async () => {
    const { orca, writes } = fakeOrca(recordedRun(QUESTION_RUN));

    const replying = tick(["reply", "--run", QUESTION_RUN, "--id", "msg_82fdcd723712", "--answer", "x"], orca, fakeGit());

    await expect(replying).rejects.toThrow(/has no question msg_82fdcd723712/);
    expect(writes).toEqual([]);
  });
});

describe("advance", () => {
  test("starts a ready Task with the default agent, model and base branch, and tells it there are no earlier questions", async () => {
    const { orca, writes } = fakeOrca(recordedRun(STATES_RUN));

    await tick(["advance", "--run", STATES_RUN], orca, fakeGit());

    expect(writes).toEqual([
      [
        "worker-start", "--run", STATES_RUN, "--task", "task_0e09a0b5482c", "--worktree", "new-top-level",
        "--agent", "claude", "--model", "sonnet", "--base-branch", "main",
      ],
      [
        "send", "--run", STATES_RUN, "--to", "dispatch:ctx_new1",
        "--subject", "Earlier questions: inflight",
        "--body", "This Task has no earlier questions.",
      ],
    ]);
  });

  test("passes the agent, model and base-branch flags through", async () => {
    const { orca, writes } = fakeOrca(recordedRun(STATES_RUN));

    await tick(
      ["advance", "--run", STATES_RUN, "--agent", "codex", "--model", "gpt-5", "--base-branch", "develop"],
      orca,
      fakeGit(),
    );

    const [start] = startsIn(writes);
    expect(start && [flag(start, "--agent"), flag(start, "--model"), flag(start, "--base-branch")]).toEqual([
      "codex",
      "gpt-5",
      "develop",
    ]);
  });

  test("starts at most the cap minus the workers in flight", async () => {
    const fixture = patchWorker(statesWithParentWorktree(), "ctx_ad4378142dbf", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    const output = await tick(["advance", "--run", STATES_RUN, "--cap", "2"], orca, fakeGit([PARENT_WORKTREE]));

    expect(startsIn(writes).map((args) => flag(args, "--task"))).toEqual(["task_f5b2e9d3543b"]);
    expect(output).toContain("task_0e09a0b5482c (inflight): cap of 2 reached");
  });

  test("starts nothing when the workers in flight fill the cap", async () => {
    const fixture = patchWorker(recordedRun(STATES_RUN), "ctx_ad4378142dbf", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", STATES_RUN], orca, fakeGit());

    expect(startsIn(writes)).toEqual([]);
  });

  test("holds a Task whose parent's worktree HEAD is not on main", async () => {
    const { orca, writes } = fakeOrca(statesWithParentWorktree());

    const output = await tick(["advance", "--run", STATES_RUN, "--cap", "5"], orca, fakeGit());

    expect(startsIn(writes).map((args) => flag(args, "--task"))).toEqual(["task_0e09a0b5482c"]);
    expect(output).toContain("task_f5b2e9d3543b (child): waits for task_98bf6fe80945 (parent) to merge into main");
  });

  test("starts a Task once its parent's worktree HEAD is on main", async () => {
    const { orca, writes } = fakeOrca(statesWithParentWorktree());

    await tick(["advance", "--run", STATES_RUN, "--cap", "5"], orca, fakeGit([PARENT_WORKTREE]));

    expect(startsIn(writes).map((args) => flag(args, "--task"))).toEqual(["task_f5b2e9d3543b", "task_0e09a0b5482c"]);
  });

  test("starts a Task once its parent's worktree was removed", async () => {
    const { orca, writes } = fakeOrca(statesWithParentWorktree());

    await tick(["advance", "--run", STATES_RUN, "--cap", "5"], orca, fakeGit([], [PARENT_WORKTREE]));

    expect(startsIn(writes).map((args) => flag(args, "--task"))).toContain("task_f5b2e9d3543b");
  });

  test("retries a failed Task from its latest settled Dispatch and sends its earlier questions as one message", async () => {
    const fixture = patchTask(recordedRun(QUESTION_RUN), "task_7479c953ab51", { status: "failed" });
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", QUESTION_RUN, "--retry", "task_7479c953ab51"], orca, fakeGit());

    expect(writes).toEqual([
      [
        "worker-start", "--run", QUESTION_RUN, "--task", "task_7479c953ab51", "--worktree", "new-top-level",
        "--agent", "claude", "--model", "sonnet", "--base-branch", "main", "--retry-of", "ctx_feb1a69dcedd",
      ],
      [
        "send", "--run", QUESTION_RUN, "--to", "dispatch:ctx_new1",
        "--subject", "Earlier questions: OO-23 ask/reply smoke",
        "--body",
        "Earlier attempts of this Task asked these questions.\n\n" +
          `Question ${ANSWERED_Q1}:\nOO-23 Q1: should step 3 write alpha or beta? see smoke/oo23-report.md\nAnswer:\nalpha\n\n` +
          `Question ${OPEN_Q2}:\nOO-23 Q2: unanswered on purpose, see smoke/oo23-report.md\n` +
          "No answer. Ask it again if it still applies.",
      ],
    ]);
  });

  test("sends a question asked in several attempts once", async () => {
    const fixture = patchTask(recordedRun(RETRIED_RUN), "task_d520a7fed9f5", { status: "failed" });
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", RETRIED_RUN, "--retry", "task_d520a7fed9f5"], orca, fakeGit());

    const body = flag(writes.find((args) => args[0] === "send") ?? [], "--body") ?? "";
    expect(body.match(/OO-24 Q1/g)).toHaveLength(1);
  });

  test("retries a blocked Task with no earlier questions and tells it there are none", async () => {
    const { orca, writes } = fakeOrca(recordedRun(BLOCKED_RUN));

    await tick(["advance", "--run", BLOCKED_RUN, "--retry", "task_3f7cc52640da"], orca, fakeGit());

    expect(writes.map((args) => [args[0], flag(args, "--retry-of") ?? flag(args, "--body")])).toEqual([
      ["worker-start", "ctx_dd69b245269b"],
      ["send", "This Task has no earlier questions."],
    ]);
  });

  test("refuses to retry a Task that is neither failed nor blocked", async () => {
    const { orca, writes } = fakeOrca(recordedRun(STATES_RUN));

    const advancing = tick(["advance", "--run", STATES_RUN, "--retry", "task_0e09a0b5482c"], orca, fakeGit());

    await expect(advancing).rejects.toThrow(/task_0e09a0b5482c \(inflight\) is ready/);
    expect(writes).toEqual([]);
  });

  test("cancels a Task with a live worker by stopping it", async () => {
    const fixture = patchWorker(recordedRun(STATES_RUN), "ctx_ad4378142dbf", IN_FLIGHT);
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", STATES_RUN, "--cap", "0", "--cancel", "task_b221e4b2baaa"], orca, fakeGit());

    expect(writes).toEqual([
      ["worker-stop", "--dispatch", "ctx_ad4378142dbf"],
      ["task-update", "--run", STATES_RUN, "--id", "task_b221e4b2baaa", "--status", "failed", "--result", "cancelled"],
    ]);
  });

  test("cancels a Task whose worker is not proven live by abandoning it", async () => {
    const fixture = patchWorker(recordedRun(STATES_RUN), "ctx_ad4378142dbf", { dispatchStatus: "dispatched" });
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", STATES_RUN, "--cap", "0", "--cancel", "task_b221e4b2baaa"], orca, fakeGit());

    expect(writes).toEqual([
      ["worker-abandon", "--dispatch", "ctx_ad4378142dbf"],
      ["task-update", "--run", STATES_RUN, "--id", "task_b221e4b2baaa", "--status", "failed", "--result", "cancelled"],
    ]);
  });

  test("cancels a Task with no worker attached by marking it cancelled", async () => {
    const { orca, writes } = fakeOrca(recordedRun(STATES_RUN));

    await tick(["advance", "--run", STATES_RUN, "--cap", "0", "--cancel", "task_b221e4b2baaa"], orca, fakeGit());

    expect(writes).toEqual([
      ["task-update", "--run", STATES_RUN, "--id", "task_b221e4b2baaa", "--status", "failed", "--result", "cancelled"],
    ]);
  });

  test("refuses to both retry and cancel a Task", async () => {
    const { orca, writes } = fakeOrca(recordedRun(STATES_RUN));

    const advancing = tick(
      ["advance", "--run", STATES_RUN, "--retry", "task_b221e4b2baaa", "--cancel", "task_b221e4b2baaa"],
      orca,
      fakeGit(),
    );

    await expect(advancing).rejects.toThrow(/either retried or cancelled/);
    expect(writes).toEqual([]);
  });

  test("releases the workers Orca names for release", async () => {
    const fixture = patchWorker(recordedRun(RETRIED_RUN), "ctx_986a5a35f0e6", {
      terminalState: "reclaimable",
      projection: {
        nextAction: { kind: "cleanup", argv: ["orchestration", "worker-release", "--dispatch", "ctx_986a5a35f0e6"] },
      },
    });
    const { orca, writes } = fakeOrca(fixture);

    await tick(["advance", "--run", RETRIED_RUN], orca, fakeGit());

    expect(writes).toEqual([["worker-release", "--dispatch", "ctx_986a5a35f0e6"]]);
  });

});
