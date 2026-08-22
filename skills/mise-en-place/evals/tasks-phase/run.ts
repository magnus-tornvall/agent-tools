#!/usr/bin/env bun
//
// Runs the grader over the fixtures and says whether it can tell the shapes apart.
//
// Two modes, and the difference matters more than anything else in this directory:
//
//   bun run.ts                       calibration. Grades the checked-in sample
//                                    decompositions, which are hand-written, and asserts the
//                                    metrics separate them the way each fixture declares.
//                                    This tests the GRADER. It says nothing about SKILL.md.
//
//   bun run.ts <fixture> <dir>...    grades real `tasks/` directories - one per arm - that a
//                                    model produced from a prompt. This is the arm that can
//                                    say whether a wording change earned its place.
//
// Calibration passing is the precondition for trusting a live run, not a result in itself. A
// grader that cannot separate a hand-written horizontal decomposition from a hand-written
// vertical one will not detect the difference in generated output either.

import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BETTER, frontmatter, grade, readTasks, type LayerSpec, type Metrics } from "./metrics.ts";

const HERE = dirname(Bun.fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

type Manifest = LayerSpec & {
  title: string;
  why: string;
  /** Metrics this fixture is entitled to draw a conclusion from. */
  discriminates: string[];
  /** Pairs the discriminating metrics must rank in this order. */
  expect?: { better: string; worse: string }[];
  /** Metrics on which the worse sample is expected to look better - a declared trap. */
  inverts?: string[];
  /** Checked per sample, pass/fail, never ranked. */
  bounds?: Record<string, { max?: number; min?: number }>;
  /** Which samples must clear the bounds and which must breach them. */
  expectBounds?: { pass?: string[]; fail?: string[] };
};

function reqIds(changeDir: string): string[] {
  const fm = frontmatter(join(changeDir, "change.md"));
  return (fm.spec?.requirements ?? []).map((r: any) => String(r?.id));
}

const COLS: (keyof Metrics)[] = [
  "task_count",
  "complete_path",
  "single_layer",
  "critical_path",
  "startable",
  "req_fanout",
  "unclaimed",
  "expand_contract",
  "work_shaped_goals",
];

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function table(rows: Record<string, Metrics>, discriminates: string[]): void {
  const names = Object.keys(rows);
  const w = Math.max(6, ...names.map((n) => n.length));
  const head = COLS.map((c) => (discriminates.includes(c) ? `*${c}` : c));
  const widths = head.map((h, i) => Math.max(h.length, ...names.map((n) => fmt(rows[n][COLS[i]]).length)));
  console.log(
    `  ${"sample".padEnd(w)}  ` + head.map((h, i) => h.padStart(widths[i])).join("  "),
  );
  for (const n of names) {
    console.log(
      `  ${n.padEnd(w)}  ` + COLS.map((c, i) => fmt(rows[n][c]).padStart(widths[i])).join("  "),
    );
  }
  console.log(`  (* = this fixture's discriminating metrics; the rest are context only)`);
}

/** Did `better` beat `worse` on the metrics this fixture is allowed to judge by? */
function separation(a: Metrics, b: Metrics, metrics: string[]): { won: string[]; lost: string[]; tied: string[] } {
  const won: string[] = [];
  const lost: string[] = [];
  const tied: string[] = [];
  for (const m of metrics) {
    const dir = BETTER[m];
    if (!dir) continue; // unrankable: bounds-only
    const x = a[m as keyof Metrics];
    const y = b[m as keyof Metrics];
    if (x === y) tied.push(m);
    else if (dir === "high" ? x > y : x < y) won.push(m);
    else lost.push(m);
  }
  return { won, lost, tied };
}

function checkBounds(name: string, m: Metrics, bounds: Manifest["bounds"]): string[] {
  const fails: string[] = [];
  for (const [metric, b] of Object.entries(bounds ?? {})) {
    const v = m[metric as keyof Metrics];
    if (b.max !== undefined && v > b.max) fails.push(`${name}: ${metric} ${fmt(v)} > max ${b.max}`);
    if (b.min !== undefined && v < b.min) fails.push(`${name}: ${metric} ${fmt(v)} < min ${b.min}`);
  }
  return fails;
}

// ---- live mode ------------------------------------------------------------------------

const [fixtureArg, ...armDirs] = process.argv.slice(2);

if (fixtureArg) {
  const dir = join(FIXTURES, fixtureArg);
  if (!existsSync(dir)) {
    console.error(`no fixture "${fixtureArg}" - have: ${readdirSync(FIXTURES).sort().join(", ")}`);
    process.exit(2);
  }
  if (!armDirs.length) {
    console.error(`usage: run.ts ${fixtureArg} <tasks dir> [<tasks dir> ...]`);
    process.exit(2);
  }
  const man: Manifest = await Bun.file(join(dir, "eval.json")).json();
  const reqs = reqIds(dir);
  const rows: Record<string, Metrics> = {};
  for (const d of armDirs) rows[basename(dirname(d)) || d] = grade(readTasks(d), reqs, man);

  console.log(`\n${fixtureArg} - ${man.title}\n  ${man.why}\n`);
  table(rows, man.discriminates);
  const fails = Object.entries(rows).flatMap(([n, m]) => checkBounds(n, m, man.bounds));
  for (const f of fails) console.log(`  bound: ${f}`);
  console.log(
    `\n  Judge by the starred metrics only. Two arms, one fixture, one sample each is an` +
      `\n  anecdote; repeat each arm several times before reading a difference as real.`,
  );
  process.exit(0);
}

// ---- calibration mode -----------------------------------------------------------------

let failures = 0;

for (const fixture of readdirSync(FIXTURES).sort()) {
  const dir = join(FIXTURES, fixture);
  const man: Manifest = await Bun.file(join(dir, "eval.json")).json();
  const reqs = reqIds(dir);
  const samplesDir = join(dir, "samples");

  const rows: Record<string, Metrics> = {};
  for (const s of readdirSync(samplesDir).sort()) {
    rows[s] = grade(readTasks(join(samplesDir, s, "tasks")), reqs, man);
  }

  console.log(`\n${fixture} - ${man.title}`);
  console.log(`  ${man.why}\n`);
  table(rows, man.discriminates);

  for (const { better, worse } of man.expect ?? []) {
    const { won, lost, tied } = separation(rows[better], rows[worse], man.discriminates);
    if (lost.length || !won.length) {
      failures++;
      console.log(`  FAIL  ${better} over ${worse}: won ${won.join(",") || "nothing"}` +
        `${lost.length ? `, LOST ${lost.join(",")}` : ""}${tied.length ? `, tied ${tied.join(",")}` : ""}`);
    } else {
      console.log(`  ok    ${better} over ${worse} on ${won.join(", ")}` +
        `${tied.length ? ` (tied on ${tied.join(", ")})` : ""}`);
    }
  }

  // A declared inversion is an assertion that the trap is real: the shape this fixture
  // calls worse must genuinely look better on these metrics. If it stops inverting, the
  // fixture no longer demonstrates what it claims and the note above it has gone stale.
  for (const metric of man.inverts ?? []) {
    const pair = (man.expect ?? [])[0];
    if (!pair) continue;
    const dir = BETTER[metric];
    const b = rows[pair.better][metric as keyof Metrics];
    const w = rows[pair.worse][metric as keyof Metrics];
    const inverted = dir === "high" ? w > b : w < b;
    if (inverted) console.log(`  ok    ${metric} inverts as declared (${pair.worse} looks better)`);
    else {
      failures++;
      console.log(`  FAIL  ${metric} was declared to invert and does not`);
    }
  }

  // A bound is not a metric: it cannot be traded against verticality, and a fixture that
  // declares one is asserting a sample breaches it. If the breach stops happening, the
  // fixture has stopped demonstrating the cost it was built to show.
  for (const [n, m] of Object.entries(rows)) {
    const breaches = checkBounds(n, m, man.bounds);
    for (const f of breaches) console.log(`  bound: ${f}`);
    const mustPass = man.expectBounds?.pass?.includes(n);
    const mustFail = man.expectBounds?.fail?.includes(n);
    if (mustPass && breaches.length) {
      failures++;
      console.log(`  FAIL  ${n} was declared within bounds and is not`);
    }
    if (mustFail && !breaches.length) {
      failures++;
      console.log(`  FAIL  ${n} was declared to breach a bound and does not`);
    }
    if (mustFail && breaches.length) console.log(`  ok    ${n} breaches its bound as declared`);
  }
}

console.log(
  failures
    ? `\n${failures} calibration failures - the grader cannot see what the fixtures claim.`
    : `\ncalibration holds. This tests the grader, not SKILL.md: to compare wordings, generate` +
        `\ntasks/ from each prompt in prompts/ and pass them to run.ts <fixture> <dir> <dir>.`,
);
process.exit(failures ? 1 : 0);
