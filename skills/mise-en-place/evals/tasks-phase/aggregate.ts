#!/usr/bin/env bun
//
// Aggregates a live run: several samples per arm, per fixture. One sample per arm is an
// anecdote, so nothing here reports a bare mean - every metric carries its observed range,
// and a difference is only called separated when the two arms' ranges do not overlap.
//
// Overlapping ranges are not a null result. They mean this many samples cannot tell, which
// is a different thing from the wording doing nothing, and the output says so.
//
// Usage: bun aggregate.ts <runs dir>
//   expects <runs dir>/<fixture>/<arm>/<n>/tasks/

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { BETTER, frontmatter, grade, readTasks, type LayerSpec, type Metrics } from "./metrics.ts";

const HERE = dirname(Bun.fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

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

type Spread = { mean: number; min: number; max: number; n: number };

function spread(xs: number[]): Spread {
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs), n: xs.length };
}

const f2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const cell = (s: Spread) => (s.min === s.max ? f2(s.mean) : `${f2(s.mean)} [${f2(s.min)}-${f2(s.max)}]`);

const runsRoot = process.argv[2];
if (!runsRoot || !existsSync(runsRoot)) {
  console.error("usage: aggregate.ts <runs dir>");
  process.exit(2);
}

let verdicts: string[] = [];

for (const fixture of readdirSync(runsRoot).sort()) {
  const man = (await Bun.file(join(FIXTURES, fixture, "eval.json")).json()) as LayerSpec & {
    title: string;
    discriminates: string[];
    expect?: { better: string; worse: string }[];
    bounds?: Record<string, { max?: number; min?: number }>;
  };
  const reqs = (frontmatter(join(FIXTURES, fixture, "change.md")).spec?.requirements ?? []).map((r: any) =>
    String(r?.id),
  );

  const arms: Record<string, Metrics[]> = {};
  for (const arm of readdirSync(join(runsRoot, fixture)).sort()) {
    arms[arm] = [];
    for (const n of readdirSync(join(runsRoot, fixture, arm)).sort()) {
      const dir = join(runsRoot, fixture, arm, n, "tasks");
      if (!existsSync(dir) || !readdirSync(dir).filter((f) => f.endsWith(".md")).length) {
        console.log(`  (skipped ${fixture}/${arm}/${n} - no task files)`);
        continue;
      }
      arms[arm].push(grade(readTasks(dir), reqs, man));
    }
  }

  const stats: Record<string, Record<string, Spread>> = {};
  for (const [arm, runs] of Object.entries(arms)) {
    stats[arm] = Object.fromEntries(COLS.map((c) => [c, spread(runs.map((m) => m[c]))]));
  }

  console.log(`\n${fixture} - ${man.title}`);
  const names = Object.keys(stats);
  const w = Math.max(9, ...names.map((n) => n.length));
  const head = COLS.map((c) => (man.discriminates.includes(c) ? `*${c}` : c));
  const widths = head.map((h, i) => Math.max(h.length, ...names.map((n) => cell(stats[n][COLS[i]]).length)));
  console.log(`  ${"arm".padEnd(w)}  n  ` + head.map((h, i) => h.padStart(widths[i])).join("  "));
  for (const n of names) {
    console.log(
      `  ${n.padEnd(w)}  ${stats[n].task_count.n}  ` +
        COLS.map((c, i) => cell(stats[n][c]).padStart(widths[i])).join("  "),
    );
  }

  // The manifest's `expect` names calibration samples, not arms. A live run compares the
  // two arms, and the hypothesis under test is always that the candidate wording is better -
  // so a metric moving the other way is a finding, not a mislabelled pass.
  {
    const better = process.argv[3] ?? "candidate";
    const worse = process.argv[4] ?? "control";
    if (!stats[better] || !stats[worse]) {
      console.log(`\n  (no ${better}/${worse} pair to compare - arms present: ${names.join(", ")})`);
      continue;
    }
    console.log("");
    for (const m of man.discriminates) {
      const dir = BETTER[m];
      if (!dir) continue;
      const b = stats[better][m];
      const x = stats[worse][m];
      const meanWins = dir === "high" ? b.mean > x.mean : b.mean < x.mean;
      // Disjointness is symmetric: two ranges that do not overlap are separated whichever
      // way round they fall. Testing only the favourable direction hides the finding that
      // matters most - a wording that moves a metric backwards, cleanly, every run.
      const disjoint = b.min > x.max || b.max < x.min;
      const same = b.mean === x.mean;
      const tag = same ? "no difference" : disjoint ? (meanWins ? "SEPARATED" : "SEPARATED, WRONG WAY") :
        meanWins ? "overlapping, mean favours candidate" : "overlapping, mean favours control";
      console.log(`  ${m.padEnd(18)} ${better} ${cell(b)}  vs  ${worse} ${cell(x)}   ${tag}`);
      if (disjoint) verdicts.push(`${fixture}/${m}: ${meanWins ? "separated" : "SEPARATED THE WRONG WAY"}`);
    }
  }

  for (const [arm, runs] of Object.entries(arms)) {
    for (const [metric, b] of Object.entries(man.bounds ?? {})) {
      const over = runs.filter((m) => b.max !== undefined && m[metric as keyof Metrics] > b.max).length;
      if (over) console.log(`  bound: ${arm} breached ${metric} max ${b.max} in ${over}/${runs.length} runs`);
    }
  }
}

console.log(`\n${verdicts.length} metric(s) separated with non-overlapping ranges:`);
for (const v of verdicts) console.log(`  - ${v}`);
console.log(
  `\nEverything else is within sample noise at this n. Read only the starred metrics per` +
    `\nfixture; the rest are context.`,
);
