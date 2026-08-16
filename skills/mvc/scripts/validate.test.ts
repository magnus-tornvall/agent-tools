// Table-driven exit-code checks for validate.ts. The script is a gate: what matters is
// which of the three exits a given mvc.md produces, and that a malformed file exits 2
// rather than 1 - exit 1 means "gaps remain", so a malformed file read as unfinished is
// the failure mode worth a test.
//
// Run: bun test skills/mvc/scripts/validate.test.ts

import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VALIDATE = join(import.meta.dir, "validate.ts");

const SETTLED = `
  - id: D1
    q: "Where is the header set?"
    a: "In the existing security middleware, not per-route."
    reason: "Every route already passes through applyHeaders."
    rules_out: "Per-route opt-in, and any registry of routes."`;

const DEFERRED = `
  - what: "CSP violation reporting."
    reason: "Needs an endpoint and a retention decision."`;

/** A directory whose mvc.md is exactly `body`. */
function raw(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mvc-"));
  writeFileSync(join(dir, "mvc.md"), body);
  // seen_in resolves against the repo root, and a tmp fixture has none above it - so the
  // change dir is the fallback. One real glossary is enough for a term to resolve without
  // depending on this repo's own files.
  writeFileSync(join(dir, "CONTEXT.md"), "**route**: A frontend router path.\n");
  return dir;
}

function fixture(frontmatter: string): string {
  return raw(`---\n${frontmatter.trim()}\n---\n`);
}

function run(dir: string): { code: number; out: string } {
  const p = Bun.spawnSync(["bun", VALIDATE, dir], { cwd: dir });
  return { code: p.exitCode, out: p.stdout.toString() + p.stderr.toString() };
}

const mvc = (o: {
  outcome?: string;
  approved?: boolean;
  round?: number;
  ceiling?: number;
  in?: string;
  settled?: string;
  widened?: string;
  deferred?: string;
  out?: string;
  terms?: string;
  open?: string;
} = {}) => `
outcome: ${o.outcome ?? '"Every HTML response carries a CSP header."'}
approved: ${o.approved ?? false}
budget:
  round: ${o.round ?? 2}
  ceiling: ${o.ceiling ?? 3}
in:${o.in ?? '\n  - "A CSP header on every HTML response."'}
settled:${o.settled ?? SETTLED}
widened:${o.widened ?? " []"}
deferred:${o.deferred ?? DEFERRED}
out:${o.out ?? " []"}
terms:${o.terms ?? " []"}
open:${o.open ?? " []"}`;

const term = (o: { status: string; seen_in?: string }) => `
  - term: "route"
    means: "An Express handler path."
    status: ${o.status}
    seen_in: ${o.seen_in ?? "[]"}`;

const OPEN_Q = `
  - id: Q7
    q: "Does an empty value omit the header?"
    stance: "Omit it - an empty CSP header is worse than none."`;

const cases: Array<[name: string, dir: () => string, code: number, expect?: string]> = [
  // ---- the happy path -------------------------------------------------------------------
  ["a settled shape holds", () => fixture(mvc()), 0],
  ["an approved shape holds", () => fixture(mvc({ approved: true })), 0],

  // ---- gaps: normal mid-grill state -----------------------------------------------------
  ["an open question is a gap", () => fixture(mvc({ open: OPEN_Q })), 1, "Q7 is open"],
  ["an empty outcome is a gap", () => fixture(mvc({ outcome: '""' })), 1, "outcome is empty"],
  ["an empty in is a gap", () => fixture(mvc({ in: " []" })), 1, "in is empty"],
  [
    "a settled decision that rules nothing out is a gap",
    () =>
      fixture(mvc({ settled: '\n  - id: D1\n    q: "q?"\n    a: "a"\n    reason: "r"\n    rules_out: ""' })),
    1,
    "D1: rules_out is empty",
  ],
  [
    "a deferral with no reason is a gap",
    () => fixture(mvc({ deferred: '\n  - what: "Reporting."\n    reason: ""' })),
    1,
    "deferred[0]: reason is empty",
  ],
  [
    "an open question with no stance is a gap",
    () => fixture(mvc({ open: '\n  - id: Q7\n    q: "which?"\n    stance: ""' })),
    1,
    "Q7: stance is empty",
  ],
  // The budget binds without becoming an error: the state is legible, there is simply
  // nothing left to spend, and each survivor takes one of the three documented exits.
  [
    "reaching the ceiling with an open question is exhaustion",
    () => fixture(mvc({ round: 3, ceiling: 3, open: OPEN_Q })),
    1,
    "budget exhausted - 1 question(s) open after 3 of 3 rounds",
  ],
  // The off-by-one worth a test: at the ceiling with nothing open, the grill is simply
  // finished. Exhaustion must not fire on a shape that is ready to approve.
  ["reaching the ceiling with nothing open holds", () => fixture(mvc({ round: 3, ceiling: 3 })), 0],
  [
    "a round past the ceiling is a defect",
    () => fixture(mvc({ round: 4, ceiling: 3 })),
    2,
    "budget.round is 4 - there is no round 4",
  ],

  // ---- defects: state no reader can interpret --------------------------------------------
  [
    "approval over an open question is a defect",
    () => fixture(mvc({ approved: true, open: OPEN_Q })),
    2,
    "approved is true but 1 question(s) are open",
  ],
  // Approval signs a finished shape, and an empty outcome is as unfinished as an open
  // question - exiting 1 there would report a signed-but-unfinished file as mid-grill.
  [
    "approval over a plain gap is a defect",
    () => fixture(mvc({ approved: true, outcome: '""' })),
    2,
    "approved is true but 1 gap(s) remain",
  ],
  [
    "a raised ceiling is a defect",
    () => fixture(mvc({ ceiling: 4 })),
    2,
    "does not raise its own ceiling",
  ],
  ["a lowered ceiling holds", () => fixture(mvc({ round: 2, ceiling: 2 })), 0],
  // A scalar list entry has no fields, so every one reads as empty: unreadable reported as
  // unfinished, the same confusion as a scalar where a list belongs.
  [
    "a scalar list entry is a defect",
    () => fixture(mvc({ deferred: '\n  - "just a string"' })),
    2,
    "deferred[0] must be a mapping",
  ],
  [
    "an item in two buckets is a defect",
    () =>
      fixture(
        mvc({
          in: '\n  - "CSP violation reporting."',
          deferred: '\n  - what: "CSP violation reporting"\n    reason: "Later."',
        }),
      ),
    2,
    "is in both in and deferred",
  ],
  [
    "a widening not present in `in` is a defect",
    () =>
      fixture(
        mvc({ widened: '\n  - what: "Per-env policy."\n    from: deferred\n    reason: "r"\n    ruled_out: "x"' }),
      ),
    2,
    'widened "per-env policy" is not in `in`',
  ],
  [
    "an unknown widening source is a defect",
    () =>
      fixture(
        mvc({
          in: '\n  - "Per-env policy."',
          widened: '\n  - what: "Per-env policy."\n    from: whim\n    reason: "r"\n    ruled_out: "x"',
        }),
      ),
    2,
    "from must be one of",
  ],
  ["a malformed id is a defect", () => fixture(mvc({ open: '\n  - id: 7\n    q: "q?"\n    stance: "s"' })), 2, "does not match"],
  [
    "a duplicate id is a defect",
    () => fixture(mvc({ settled: `${SETTLED}${SETTLED}` })),
    2,
    "id D1 is used twice",
  ],
  ["a negative round is a defect", () => fixture(mvc({ round: -1 })), 2, "budget.round must be"],
  // A scalar where a list belongs must exit 2. Exiting 1 would report a malformed file as
  // an unfinished one, and the grill would keep going against a shape it cannot read.
  ["a scalar where a list belongs is a defect", () => fixture(mvc({ in: ' "not a list"' })), 2, "in must be a list"],
  // status and seen_in state one fact twice; disagreement is undecidable, not unfinished.
  ["a new term holds", () => fixture(mvc({ terms: term({ status: "new" }) })), 0],
  [
    "a new term with a definition elsewhere is a defect",
    () => fixture(mvc({ terms: term({ status: "new", seen_in: '["CONTEXT.md"]' }) })),
    2,
    "status is new but seen_in names 1 definition(s)",
  ],
  [
    "a narrowed term with nowhere to narrow from is a defect",
    () => fixture(mvc({ terms: term({ status: "narrowed" }) })),
    2,
    "status is narrowed but seen_in is empty",
  ],
  [
    "an unresolvable seen_in is a defect",
    () => fixture(mvc({ terms: term({ status: "conflict", seen_in: '["docs/adr/0007.md"]' }) })),
    2,
    "seen_in docs/adr/0007.md does not resolve",
  ],
  [
    "an unknown term status is a defect",
    () => fixture(mvc({ terms: term({ status: "coined" }) })),
    2,
    "status must be one of new, conflict, narrowed",
  ],

  ["no frontmatter is a defect", () => raw("no frontmatter here\n"), 2, "no YAML frontmatter"],
  ["a missing mvc.md is a defect", () => mkdtempSync(join(tmpdir(), "mvc-")), 2, "not found"],
];

for (const [name, dir, code, needle] of cases) {
  test(name, () => {
    const { code: got, out } = run(dir());
    expect({ name, code: got }).toEqual({ name, code });
    if (needle) expect(out).toContain(needle);
  });
}

// Warnings never change the exit code - they are the user's to judge, not the gate's.
test("cutting nothing warns but still holds", () => {
  const { code, out } = run(fixture(mvc({ deferred: " []", out: " []" })));
  expect(code).toBe(0);
  expect(out).toContain("was anything actually cut?");
});

// A conflict is pinned locally by `means`, so it never blocks - but the ADR it owes has no
// owner, and the warning is the only thing that gives it one.
test("a term conflict warns but still holds", () => {
  const { code, out } = run(fixture(mvc({ terms: term({ status: "conflict", seen_in: '["CONTEXT.md"]' }) })));
  expect(code).toBe(0);
  expect(out).toContain('"route" conflicts with an existing definition - owes an ADR');
});

// The regression worth its own test: seen_in must not depend on where the script was run
// from, or a correct artifact defects everywhere except the repo root.
test("seen_in resolves independently of cwd", () => {
  const dir = fixture(mvc({ terms: term({ status: "conflict", seen_in: '["CONTEXT.md"]' }) }));
  const p = Bun.spawnSync(["bun", VALIDATE, dir], { cwd: tmpdir() });
  expect(p.exitCode).toBe(0);
});

test("approval after zero rounds warns but still holds", () => {
  const { code, out } = run(fixture(mvc({ approved: true, round: 0, settled: " []" })));
  expect(code).toBe(0);
  expect(out).toContain("nothing was grilled");
});
