#!/usr/bin/env bun
// Validates a change directory: proposal.md and tasks/*.md
//
//   bun validate.ts docs/changes/2026-08-08-csp-header
//   bun validate.ts --selftest
//
// The bar is keyed on the document's own `state` field:
//
//   drafted   nothing is checked yet
//   proposed  the problem block only - change-propose's half
//   planned   everything, including task traceability - change-plan's half
//   done      same bar as planned
//
// ...with one override: a non-empty tasks/ raises the bar to planned whatever the
// state says. change-plan validates before the user approves, so the state still
// reads proposed at the moment the tasks most need checking.
//
// Exit 0 = valid (warnings allowed), 1 = errors, 2 = usage/parse failure.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const GOAL_MAX = 100;
const SCOPE_MAX = 3;
const REQUIREMENTS_MAX = 7;

const STATES = ["drafted", "proposed", "planned", "done"];

const BANNED = [
  "properly", "gracefully", "correctly", "efficiently", "robustly",
  "appropriately", "seamlessly", "as needed", "if necessary",
  "where appropriate", "and so on", "etc.",
];

const PLACEHOLDERS = ["<", "your ", "TODO", "FIXME", "..."];

/** path, path:12, path:12-15, path::symbol - and nothing else. */
const ANCHORED_PATH = /^[^:*]+(:\d+(-\d+)?|::.+)?$/;

type Doc = Record<string, any>;
type Task = Doc & { __file: string };

type Report = { errors: string[]; warnings: string[]; notes: string[] };

/** The file part of an anchored path: src/a.ts:12-15 -> src/a.ts */
export function bare(path: string): string {
  return path.split(":")[0];
}

// ---------------------------------------------------------------- pure checks

/** Every rule that needs nothing but the parsed documents. */
export function check(doc: Doc, tasks: Task[]): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const stage = STATES.indexOf(doc.state);
  if (stage < 0) {
    errors.push(`proposal.md: state is "${doc.state}", must be one of ${STATES.join(" | ")}`);
    return { errors, warnings, notes };
  }
  const atLeast = (s: string) => stage >= STATES.indexOf(s);
  const planning = atLeast("planned") || tasks.length > 0;

  if (!atLeast("proposed") && !planning) {
    notes.push("proposal.md: state is drafted - nothing validated yet");
    return { errors, warnings, notes };
  }

  const bad = (where: string, text: unknown) => {
    if (typeof text !== "string") return;
    const lower = text.toLowerCase();
    for (const word of BANNED) {
      if (lower.includes(word)) errors.push(`${where}: banned vague word "${word}"`);
    }
  };

  // --- problem block (proposed and up)

  if ((doc.unresolved ?? []).length > 0) {
    errors.push(`proposal.md: unresolved is non-empty (${doc.unresolved.length} items)`);
  }
  for (const inf of doc.inferences ?? []) {
    if (!inf.signed_off) errors.push(`proposal.md: inference not signed off: "${inf.claim}"`);
  }
  if (!doc.outcome) errors.push("proposal.md: outcome missing");
  if (!doc.kill_criterion) errors.push("proposal.md: kill_criterion missing");
  bad("proposal.md outcome", doc.outcome);

  // Shape first. A string here iterates as characters and every downstream error
  // then describes the wrong problem.
  const raw = doc.requirements ?? [];
  const requirements: Doc[] = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) errors.push("proposal.md: requirements must be a list");
  if (requirements.length === 0) errors.push("proposal.md: no requirements");
  if (requirements.length > REQUIREMENTS_MAX) {
    errors.push(
      `proposal.md: ${requirements.length} requirements, max ${REQUIREMENTS_MAX} - split the change`,
    );
  }
  const requirementIds = new Set<string>();
  for (const [i, r] of requirements.entries()) {
    if (typeof r !== "object" || r === null) {
      errors.push(`proposal.md: requirement ${i} is not a mapping with id and text`);
      continue;
    }
    if (typeof r.id !== "string" || !/^R\d+$/.test(r.id)) {
      errors.push(`proposal.md: requirement ${i} has id "${r.id}", must be R followed by digits`);
      continue;
    }
    if (typeof r.text !== "string" || !r.text) errors.push(`proposal.md ${r.id}: text missing`);
    if (requirementIds.has(r.id)) errors.push(`proposal.md: duplicate requirement id ${r.id}`);
    requirementIds.add(r.id);
    bad(`proposal.md ${r.id}`, r.text);
  }

  if (!planning) return { errors, warnings, notes };

  // --- approach block (planned and up)

  if (doc.tasks !== undefined) {
    errors.push("proposal.md: lists tasks - the tasks/ directory is the list");
  }
  const baseline = doc.baseline ?? {};
  for (const field of ["command", "result", "commit"]) {
    if (!baseline[field]) errors.push(`proposal.md: baseline.${field} missing - run it, don't describe it`);
  }
  // Duration is the field a described baseline forgets and a run one cannot.
  if (typeof baseline.duration_s !== "number") {
    errors.push("proposal.md: baseline.duration_s missing - run it, don't describe it");
  }
  if (baseline.result && baseline.result !== "pass") {
    warnings.push(`proposal.md: baseline is "${baseline.result}" - pre-existing failures will mask new ones`);
  }
  if (baseline.clean_tree === undefined) {
    warnings.push("proposal.md: baseline.clean_tree not recorded - unlabelled baselines read as clean");
  } else if (baseline.clean_tree === false) {
    warnings.push("proposal.md: baseline recorded on a dirty tree");
  }
  if ((doc.escalate_if ?? []).length === 0) {
    warnings.push("proposal.md: escalate_if is empty - nothing stops an agent going off a cliff");
  }
  if ((doc.alternatives_rejected ?? []).length === 0) {
    errors.push("proposal.md: alternatives_rejected is empty - the rejection reasons are the durable artifact");
  }
  for (const alt of doc.alternatives_rejected ?? []) {
    if (!alt.approach || !alt.reason) {
      errors.push("proposal.md: alternatives_rejected entries need approach and reason");
    }
  }
  for (const pin of doc.pinned_decisions ?? []) bad("proposal.md pinned_decisions", pin);

  // --- tasks

  if (tasks.length === 0) errors.push("tasks/: empty");

  const taskIds = new Set(tasks.map((t) => t.id));
  const satisfied = new Set<string>();
  let unrun = 0;

  for (const t of tasks) {
    const at = `tasks/${t.__file}`;

    // A size failure is a reality check, not a gate - but it takes a written
    // reason to pass it, so it cannot be skimmed past like an ordinary warning.
    const oversize = (message: string) => {
      if (t.oversize_ack) warnings.push(`${at}: ${message} - acknowledged: ${t.oversize_ack}`);
      else errors.push(`${at}: ${message}`);
    };

    if (t.id !== basename(t.__file, ".md")) {
      errors.push(`${at}: id "${t.id}" does not match filename`);
    }

    // goal
    const goal: string = t.goal ?? "";
    if (!goal) errors.push(`${at}: goal missing`);
    if (goal.length > GOAL_MAX) {
      oversize(`goal is ${goal.length} chars, max ${GOAL_MAX}`);
    }
    if (goal.replace(/\.\s*$/, "").includes(". ")) {
      errors.push(`${at}: goal is more than one sentence`);
    }
    if (/\band\b/i.test(goal)) {
      warnings.push(`${at}: goal contains "and" - is this two tasks?`);
    }
    bad(`${at} goal`, goal);

    // satisfies - exactly one, and it exists
    if (typeof t.satisfies !== "string") {
      errors.push(`${at}: satisfies must be exactly one requirement id`);
    } else if (!requirementIds.has(t.satisfies)) {
      errors.push(`${at}: satisfies "${t.satisfies}", not a requirement in proposal.md`);
    } else {
      satisfied.add(t.satisfies);
    }

    // verify
    const verify: string = t.verify ?? "";
    if (!verify) errors.push(`${at}: verify missing`);
    for (const p of PLACEHOLDERS) {
      if (verify.includes(p)) errors.push(`${at}: verify contains placeholder "${p}"`);
    }
    if (t.verify_unrun) {
      unrun++;
      notes.push(`${at}: verify not run - ${t.verify_unrun}`);
    } else {
      // A behavior-change command that already passes proves nothing, and a
      // behavior-preserving one that already fails means the baseline is not what
      // the plan thinks it is. Both are the forgery this step exists to catch.
      const want = t.type === "behavior-change" ? "fail" : "pass";
      if (t.verify_result === undefined) {
        errors.push(`${at}: verify_result missing - run verify at plan time, or set verify_unrun`);
      } else if (t.verify_result !== want) {
        errors.push(`${at}: verify_result is "${t.verify_result}", expected "${want}" for ${t.type}`);
      }
    }
    if (t.expect !== undefined) {
      errors.push(`${at}: expect is not a field - the command must decide by exit status`);
    }

    // type and its proof obligation
    if (t.type === "behavior-change") {
      if (!t.test) errors.push(`${at}: behavior-change needs test: naming a test that does not exist yet`);
    } else if (t.type === "behavior-preserving") {
      if ((t.existing_tests ?? []).length === 0) {
        errors.push(`${at}: behavior-preserving needs existing_tests`);
      }
    } else {
      errors.push(`${at}: type must be behavior-change or behavior-preserving`);
    }

    // scope - anchored paths allowed, globs are not
    const scope: Doc[] = t.scope ?? [];
    if (scope.length === 0) errors.push(`${at}: scope is empty`);
    if (scope.length > SCOPE_MAX) {
      oversize(`scope has ${scope.length} paths, max ${SCOPE_MAX} - split the task`);
    }
    for (const s of scope) {
      if (typeof s !== "object" || !s.path) {
        errors.push(`${at}: scope entries must be objects with a path`);
      } else if (s.path.includes("*")) {
        errors.push(`${at}: scope path "${s.path}" is a glob - scope is a list, forbidden is a boundary`);
      } else if (!ANCHORED_PATH.test(s.path)) {
        errors.push(`${at}: scope path "${s.path}" - anchor must be :line, :line-line or ::symbol`);
      }
    }

    // forbidden - whole paths and globs, never anchors
    for (const f of t.forbidden ?? []) {
      if (!f.path || !f.reason) errors.push(`${at}: forbidden entries need path and reason`);
      else if (f.path.includes(":")) {
        errors.push(`${at}: forbidden path "${f.path}" is anchored - forbidden takes whole paths`);
      }
    }

    // depends_on
    for (const d of t.depends_on ?? []) {
      if (!taskIds.has(d)) errors.push(`${at}: depends_on "${d}", no such task`);
    }
  }

  for (const cycle of findCycles(tasks)) {
    errors.push(`tasks/: dependency cycle ${cycle.join(" -> ")}`);
  }

  for (const id of requirementIds) {
    if (!satisfied.has(id)) errors.push(`proposal.md ${id}: no task satisfies it`);
  }

  if (unrun > 0) notes.push(`${unrun} of ${tasks.length} verify commands were not run at plan time`);

  return { errors, warnings, notes };
}

function findCycles(tasks: Task[]): string[][] {
  const edges = new Map(tasks.map((t) => [t.id, t.depends_on ?? []]));
  const cycles: string[][] = [];
  const state = new Map<string, "open" | "done">();

  const walk = (id: string, path: string[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "open") {
      cycles.push([...path.slice(path.indexOf(id)), id]);
      return;
    }
    state.set(id, "open");
    for (const next of edges.get(id) ?? []) {
      if (edges.has(next)) walk(next, [...path, id]);
    }
    state.set(id, "done");
  };

  for (const t of tasks) walk(t.id, []);
  return cycles;
}

// ------------------------------------------------------------------ file side

function frontmatter(path: string): Doc {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) fail(`${path}: no YAML frontmatter`);
  try {
    return (Bun.YAML.parse(match![1]) ?? {}) as Doc;
  } catch (e) {
    return fail(`${path}: frontmatter is not valid YAML - ${e}`);
  }
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(2);
}

/** Checks that need the repository, not just the documents. */
function checkAgainstRepo(tasks: Task[], report: Report) {
  for (const t of tasks) {
    const at = `tasks/${t.__file}`;

    for (const s of t.scope ?? []) {
      if (typeof s !== "object" || !s.path || s.path.includes("*")) continue;
      const file = bare(s.path);
      const there = existsSync(file);
      if (there && s.new) report.errors.push(`${at}: scope path "${file}" is marked new but exists`);
      if (!there && !s.new) report.errors.push(`${at}: scope path "${file}" does not resolve`);
    }

    // behavior-change must name a test that does not exist yet, or the task is
    // satisfiable by pointing at something already green. Look only in the file the
    // anchor names - a repo-wide sweep for a name like "adds header" hits prose.
    if (t.type === "behavior-change" && typeof t.test === "string") {
      const [file, name] = [bare(t.test), t.test.split("::").pop()!.trim()];
      if (name && name !== file && existsSync(file) && readFileSync(file, "utf8").includes(name)) {
        report.errors.push(`${at}: test "${name}" already exists in ${file} - behavior-change must add a new one`);
      }
    }
  }
}

// ----------------------------------------------------------------------- main

function selftest() {
  const problem: Doc = {
    state: "proposed",
    outcome: "Every HTML response carries a Content-Security-Policy header.",
    kill_criterion: "If the policy needs unsafe-inline, stop.",
    non_goals: ["Not adding CSP reporting."],
    unresolved: [],
    requirements: [{ id: "R1", text: "An HTML response carries the header." }],
  };
  const planned: Doc = {
    ...problem,
    state: "planned",
    escalate_if: ["An existing test must change to pass."],
    baseline: { command: "npm test", result: "pass", duration_s: 34, commit: "a1b2c3d", clean_tree: true },
    alternatives_rejected: [{ approach: "Set the header at the CDN edge.", reason: "Policy would drift." }],
  };
  const task = (over: Doc = {}): Task => ({
    __file: "T1.md",
    id: "T1",
    type: "behavior-change",
    goal: "An HTML response carries a content-security-policy header.",
    satisfies: "R1",
    verify: "npm test -- security.test.ts",
    verify_result: "fail",
    test: "test/security.test.ts::sets CSP header",
    scope: [{ path: "src/middleware/security.ts" }],
    depends_on: [],
    ...over,
  });

  const ok = (label: string, cond: boolean) => {
    if (!cond) { console.error(`selftest FAILED: ${label}`); process.exit(1); }
  };
  const errorsOf = (t: Doc) => check(planned, [task(t)]).errors.join("\n");

  ok("clean input passes", check(planned, [task()]).errors.length === 0);

  // staged bar
  ok("proposed needs no tasks", check(problem, []).errors.length === 0);
  ok("drafted checks nothing", check({ state: "drafted" }, []).errors.length === 0);
  ok("unknown state", check({ ...problem, state: "wat" }, []).errors.join("\n").includes("must be one of"));
  ok("planned needs tasks", check(planned, []).errors.join("\n").includes("tasks/: empty"));
  ok(
    "no tasks, no task bar",
    check({ ...problem, requirements: [...problem.requirements, { id: "R2", text: "Configurable." }] }, [])
      .errors.length === 0,
  );
  ok(
    "planned bar does not wait for the state - tasks are checked before approval",
    check({ ...planned, state: "proposed", requirements: [...planned.requirements, { id: "R2", text: "Configurable." }] }, [task()])
      .errors.join("\n").includes("R2: no task satisfies it"),
  );
  ok(
    "a drafted proposal with tasks is still checked",
    check({ state: "drafted" }, [task()]).errors.join("\n").includes("outcome missing"),
  );
  ok("problem bar applies at proposed", check({ ...problem, outcome: undefined }, []).errors.join("\n").includes("outcome missing"));
  ok("unsigned inference", check({ ...problem, inferences: [{ claim: "no inline scripts", signed_off: false }] }, [])
    .errors.join("\n").includes("not signed off"));

  // task rules
  ok("goal length", errorsOf({ goal: "x".repeat(GOAL_MAX + 1) }).includes("max 100"));
  ok("two sentences", errorsOf({ goal: "Does one thing. Does another." }).includes("one sentence"));
  ok("and warns only", check(planned, [task({ goal: "Adds a header and logs it." })]).warnings.length === 1);
  ok("satisfies must be scalar", errorsOf({ satisfies: ["R1"] }).includes("exactly one"));
  ok("unknown requirement", errorsOf({ satisfies: "R9" }).includes("not a requirement"));
  ok("scope cap", errorsOf({ scope: [{ path: "a" }, { path: "b" }, { path: "c" }, { path: "d" }] }).includes("max 3"));
  ok("scope glob", errorsOf({ scope: [{ path: "src/**" }] }).includes("is a glob"));
  ok("expect removed", errorsOf({ expect: "200" }).includes("expect is not a field"));
  ok("behavior-change needs test", errorsOf({ test: undefined }).includes("needs test"));
  ok("placeholder in verify", errorsOf({ verify: "run <your test>" }).includes("placeholder"));
  ok("banned word", errorsOf({ goal: "Handles headers properly." }).includes("properly"));

  // verify was run at plan time, and the result is the one that proves anything
  ok("verify_result required", errorsOf({ verify_result: undefined }).includes("verify_result missing"));
  ok("behavior-change that already passes", errorsOf({ verify_result: "pass" }).includes('expected "fail"'));
  ok(
    "behavior-preserving that already fails",
    check(planned, [task({
      type: "behavior-preserving", test: undefined, existing_tests: ["security.test.ts"], verify_result: "fail",
    })]).errors.join("\n").includes('expected "pass"'),
  );
  ok(
    "verify_unrun excuses the result",
    check(planned, [task({ verify_result: undefined, verify_unrun: "needs a booted service" })]).errors.length === 0,
  );

  // baseline and alternatives
  const without = (field: string) => {
    const { [field]: _, ...rest } = planned.baseline;
    return check({ ...planned, baseline: rest }, [task()]).errors.join("\n");
  };
  ok("baseline duration required", without("duration_s").includes("duration_s missing"));
  ok(
    "clean_tree unrecorded warns",
    check({ ...planned, baseline: { ...planned.baseline, clean_tree: undefined } }, [task()])
      .warnings.join("\n").includes("clean_tree not recorded"),
  );
  ok(
    "alternatives required",
    check({ ...planned, alternatives_rejected: [] }, [task()]).errors.join("\n").includes("alternatives_rejected is empty"),
  );
  ok(
    "alternatives need a reason",
    check({ ...planned, alternatives_rejected: [{ approach: "Do it at the edge." }] }, [task()])
      .errors.join("\n").includes("approach and reason"),
  );

  // requirement shape - a string here used to iterate as characters
  const req = (r: unknown) => check({ ...problem, requirements: r }, []).errors.join("\n");
  ok("requirements must be a list", req("R1: carries the header.").includes("must be a list"));
  ok("requirement needs a mapping", req(["carries the header."]).includes("not a mapping"));
  ok("requirement id format", req([{ id: "one", text: "Carries it." }]).includes("must be R followed by digits"));
  ok("requirement needs text", req([{ id: "R1" }]).includes("R1: text missing"));

  // oversize_ack downgrades size failures, and only size failures
  ok(
    "ack downgrades goal length",
    check(planned, [task({ goal: "x".repeat(GOAL_MAX + 1), oversize_ack: "one indivisible migration" })])
      .errors.length === 0,
  );
  ok(
    "ack downgrades scope cap",
    check(planned, [task({
      scope: [{ path: "a" }, { path: "b" }, { path: "c" }, { path: "d" }],
      oversize_ack: "four files, one rename",
    })]).warnings.some((w) => w.includes("acknowledged")),
  );
  ok("ack does not excuse other errors", errorsOf({ satisfies: "R9", oversize_ack: "why" }).includes("not a requirement"));

  // anchored paths
  ok("line anchor", check(planned, [task({ scope: [{ path: "src/a.ts:12" }] })]).errors.length === 0);
  ok("range anchor", check(planned, [task({ scope: [{ path: "src/a.ts:12-15" }] })]).errors.length === 0);
  ok("symbol anchor", check(planned, [task({ scope: [{ path: "src/a.ts::applyHeaders" }] })]).errors.length === 0);
  ok("open range rejected", errorsOf({ scope: [{ path: "src/a.ts:20-" }] }).includes("anchor must be"));
  ok("bare returns the file", bare("src/a.ts:12-15") === "src/a.ts" && bare("src/a.ts") === "src/a.ts");
  ok(
    "forbidden takes no anchor",
    errorsOf({ forbidden: [{ path: "src/routes.ts:12", reason: "middleware-level" }] }).includes("is anchored"),
  );

  ok(
    "cycle",
    check(planned, [
      task({ id: "T1", __file: "T1.md", depends_on: ["T2"] }),
      task({ id: "T2", __file: "T2.md", depends_on: ["T1"] }),
    ]).errors.join("\n").includes("cycle"),
  );
  ok("may not list tasks", check({ ...planned, tasks: [] }, [task()]).errors.join("\n").includes("the list"));

  console.log("selftest passed");
}

const arg = process.argv[2];

if (!arg) fail("usage: bun validate.ts <change-dir> | --selftest");
if (arg === "--selftest") { selftest(); process.exit(0); }
if (typeof Bun === "undefined" || !("YAML" in Bun)) fail("needs bun with Bun.YAML (bun >= 1.2)");

const dir = arg;
if (!existsSync(join(dir, "proposal.md"))) fail(`${join(dir, "proposal.md")} not found`);

const doc = frontmatter(join(dir, "proposal.md"));

const tasks: Task[] = existsSync(join(dir, "tasks"))
  ? readdirSync(join(dir, "tasks"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => ({ ...frontmatter(join(dir, "tasks", f)), __file: f }))
  : [];

// Tasks present raises the bar whatever the state says - see the header.
const planning = STATES.indexOf(doc.state) >= STATES.indexOf("planned") || tasks.length > 0;
if (planning && tasks.length === 0) fail(`${join(dir, "tasks")} not found`);

const report = check(doc, tasks);
if (planning) checkAgainstRepo(tasks, report);

for (const n of report.notes) console.log(`note:    ${n}`);
for (const w of report.warnings) console.log(`warning: ${w}`);
for (const e of report.errors) console.log(`error:   ${e}`);

console.log(
  `\n${report.errors.length} errors, ${report.warnings.length} warnings, ${tasks.length} tasks`,
);
process.exit(report.errors.length > 0 ? 1 : 0);
