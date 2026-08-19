// Table-driven exit-code checks for validate.ts. The script is a gate: what matters is
// which of the three exits a given directory produces, and that a malformed file exits 2
// rather than 1 - exit 1 means "gaps remain", so a malformed file read as unfinished is
// the failure mode worth a test.
//
// Run: bun test skills/mise-en-place/scripts/validate.test.ts

import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VALIDATE = join(import.meta.dir, "validate.ts");

const SPEC = `
  outcome: "Every HTML response carries a Content-Security-Policy header."
  kill_criterion: "If the policy needs unsafe-inline, stop and re-scope."
  non_goals: ["Not adding CSP reporting."]
  requirements:
    - id: R1
      text: "An HTML response from any route carries the header."
  open_questions: []`;

const PLAN = `
  approach: "Set the header once in the security middleware."
  touchpoints: ["src/app.ts"]
  constraints: ["Header set in middleware, not per-route."]
  acceptance: "npm test"
  escalate_if: ["The policy requires unsafe-inline."]
  open_questions: []`;

const TASK = `---
id: T1
goal: "The header is set."
satisfies: [R1]
scope: ["src/app.ts"]
depends_on: []
---
`;

/** A change directory with the given frontmatter body and task files. */
function fixture(frontmatter: string, tasks: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "mise-en-place-"));
  writeFileSync(join(dir, "change.md"), `---\n${frontmatter.trim()}\n---\n`);
  // The validator resolves anchors against its cwd, which run() sets to the fixture. One
  // real file is enough for a touchpoint to resolve without depending on this repo.
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "app.ts"), "export {};\n");
  if (Object.keys(tasks).length) {
    mkdirSync(join(dir, "tasks"));
    for (const [name, body] of Object.entries(tasks)) writeFileSync(join(dir, "tasks", name), body);
  }
  return dir;
}

function run(dir: string): { code: number; out: string } {
  const p = Bun.spawnSync(["bun", VALIDATE, dir], { cwd: dir });
  return { code: p.exitCode, out: p.stdout.toString() + p.stderr.toString() };
}

const change = (o: {
  approvals?: Record<string, boolean>;
  spec?: string;
  plan?: string;
  tasksOpen?: string;
} = {}) => `
approvals:
  spec: ${o.approvals?.spec ?? false}
  plan: ${o.approvals?.plan ?? false}
  tasks: ${o.approvals?.tasks ?? false}
spec:${o.spec ?? SPEC}
plan:${o.plan ?? PLAN}
tasks:
  open_questions: [${o.tasksOpen ?? ""}]`;

const cases: Array<[name: string, dir: () => string, code: number, expect?: string]> = [
  // ---- gaps: the normal mid-phase state -----------------------------------------------
  [
    "empty spec is a gap",
    () => fixture(change({ spec: "\n  open_questions: []" })),
    1,
    "spec.outcome is empty",
  ],
  ["a filled spec and plan holds", () => fixture(change()), 0],
  [
    "an open question blocks its phase",
    () => fixture(change({ spec: `${SPEC.replace("open_questions: []", 'open_questions: ["which policy?"]')}` })),
    1,
    "spec.open_questions: which policy?",
  ],
  [
    "an empty kill_criterion warns but holds",
    () => fixture(change({ spec: SPEC.replace(/  kill_criterion: .*\n/, "") })),
    0,
    "kill_criterion is empty",
  ],
  [
    "a spec alone is not nagged about plan fields, but says the plan is missing",
    () => fixture(change({ plan: "\n  open_questions: []" })),
    0,
    "was the plan attempted",
  ],
  [
    "a plan holding only an open question still blocks",
    () => fixture(change({ plan: '\n  open_questions: ["which middleware?"]' })),
    1,
    "plan.open_questions: which middleware?",
  ],
  [
    "a tasks open question still blocks with no tasks written",
    () => fixture(change({ tasksOpen: '"how is this verified?"' })),
    1,
    "tasks.open_questions: how is this verified?",
  ],
  [
    "an approved plan with an empty tasks/ is a gap",
    () => fixture(change({ approvals: { spec: true, plan: true } })),
    1,
    "tasks/ holds no tasks",
  ],
  [
    "a whole change written in one pass, nothing approved yet, holds",
    () => fixture(change(), { "T1.md": TASK }),
    0,
  ],
  [
    "a task with no scope is a gap",
    () =>
      fixture(change(), { "T1.md": TASK.replace('scope: ["src/app.ts"]\n', "") }),
    1,
    "scope is empty",
  ],
  [
    "an uncovered requirement is a gap",
    () => fixture(change(), { "T1.md": TASK.replace("satisfies: [R1]", "satisfies: []") }),
    1,
    "R1 is satisfied by no task",
  ],

  // ---- gates ---------------------------------------------------------------------------
  [
    "an approval under a revoked one is a defect",
    () => fixture(change({ approvals: { spec: true, tasks: true } })),
    2,
    "approvals.tasks is true but approvals.plan is not",
  ],
  [
    "re-entry - plan revoked, spec still approved - holds",
    () => fixture(change({ approvals: { spec: true } })),
    0,
  ],
  [
    "a leftover phase field warns but holds",
    () => fixture(`phase: spec\n${change()}`),
    0,
    "`phase` is no longer used",
  ],

  // ---- malformed: must be 2, never 1 ---------------------------------------------------
  ["a missing change.md is a defect", () => mkdtempSync(join(tmpdir(), "mise-en-place-")), 2, "not found"],
  [
    "no frontmatter is a defect",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "mise-en-place-"));
      writeFileSync(join(dir, "change.md"), "# just prose\n");
      return dir;
    },
    2,
    "no YAML frontmatter",
  ],
  [
    "a mapping where a list belongs is a defect, not a gap",
    () =>
      fixture(
        change({ plan: PLAN.replace('touchpoints: ["src/app.ts"]', "touchpoints:\n    a: 1") }),
      ),
    2,
    "plan.touchpoints must be a list",
  ],
  [
    "a string where a list belongs is a defect, not a gap",
    () =>
      fixture(change({ spec: SPEC.replace(/requirements:[\s\S]*?open_questions/, 'requirements: "R1 the header is set"\n  open_questions') })),
    2,
    "spec.requirements must be a list",
  ],
  [
    "a task id that is not T-digits is a defect",
    () =>
      fixture(change(), {
        "T1.md": TASK.replace("id: T1", "id: first"),
      }),
    2,
    "is not T followed by digits",
  ],
  [
    "a depends_on cycle is a defect",
    () =>
      fixture(change(), {
        "T1.md": TASK.replace("depends_on: []", "depends_on: [T2]"),
        "T2.md": TASK.replace("id: T1", "id: T2").replace("depends_on: []", "depends_on: [T1]"),
      }),
    2,
    "depends_on cycle",
  ],
  [
    "a placeholder in acceptance is a defect",
    () => fixture(change({ plan: PLAN.replace('acceptance: "npm test"', 'acceptance: "curl <your-host>"') })),
    2,
    "plan.acceptance contains a placeholder",
  ],
  [
    "a touchpoint that does not resolve is a defect",
    () =>
      fixture(
        change({ plan: PLAN.replace("src/app.ts", "src/nope.ts") }),
      ),
    2,
    "does not resolve",
  ],
  [
    "forbidden with an anchor is a defect",
    () =>
      fixture(change(), {
        "T1.md": TASK.replace(
          "depends_on: []",
          'forbidden:\n  - path: "src/routes.ts::handler"\n    reason: "middleware-level"\ndepends_on: []',
        ),
      }),
    2,
    "is an anchor",
  ],

  // ---- warnings do not change the exit --------------------------------------------------
  [
    "an empty acceptance warns but holds",
    () => fixture(change({ plan: PLAN.replace(/  acceptance: .*\n/, "") }), { "T1.md": TASK }),
    0,
    "plan.acceptance is empty",
  ],
  [
    "a task with an empty goal is a gap",
    () => fixture(change(), { "T1.md": TASK.replace('goal: "The header is set."', 'goal: ""') }),
    1,
    "goal is empty",
  ],
];

for (const [name, dir, code, expected] of cases) {
  test(name, () => {
    const { code: got, out } = run(dir());
    expect({ name, code: got }).toEqual({ name, code });
    if (expected) expect(out).toContain(expected);
  });
}
