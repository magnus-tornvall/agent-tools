#!/usr/bin/env bun
//
// The grader for a `tasks/` directory. It answers one question: what shape is this
// decomposition? Not whether it is correct - correctness is the user's gate, and the same
// rule that governs validate.ts governs this file: a metric earns a place only when a wrong
// answer is mechanically decidable from the artifact.
//
// Every metric here exists to separate two named decomposition shapes on some fixture. A
// metric no fixture discriminates on is a number that will be read as a score, and a score
// invites tuning the wording until the number moves.

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export type LayerSpec = {
  /** Layer name -> globs. A path matching no glob lands in no layer and is ignored. */
  layers: Record<string, string[]>;
  /** Layers that observe the change rather than make it. Excluded from product span. */
  verification: string[];
};

export type Task = {
  file: string;
  id: string;
  goal: string;
  satisfies: string[];
  scope: string[];
  depends_on: string[];
};

export type Metrics = {
  task_count: number;
  /** Fraction of tasks whose scope reaches >= 2 product layers AND a verification layer. */
  complete_path: number;
  /** Fraction of tasks reaching exactly one product layer. The layer-shaped task. */
  single_layer: number;
  /** (longest chain - 1) / (tasks - 1). 0 = every task startable now, 1 = one long queue. */
  critical_path: number;
  /** Fraction of tasks with no blockers. */
  startable: number;
  /** Mean tasks listing a given covered requirement. 1 = one task delivers one requirement. */
  req_fanout: number;
  /** Tasks claiming no requirement. validate.ts checks the other direction only. */
  unclaimed: number;
  /** Expand -> fan of migrations -> contract, read off the DAG alone. */
  expand_contract: number;
  /** Advisory, lexical: goals naming work done rather than a state observable after. */
  work_shaped_goals: number;
};

/** Direction of improvement. A metric absent here cannot be ranked, only bounded. */
export const BETTER: Record<string, "high" | "low"> = {
  complete_path: "high",
  single_layer: "low",
  critical_path: "low",
  startable: "high",
  req_fanout: "low",
  unclaimed: "low",
  expand_contract: "high",
  work_shaped_goals: "low",
};

export function frontmatter(path: string): Record<string, any> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"));
  if (!match) throw new Error(`${path}: no YAML frontmatter`);
  return (Bun.YAML.parse(match[1]) ?? {}) as Record<string, any>;
}

/** Strip `:34`, `:34-51`, or `::symbol` off an anchor, leaving the path. Mirrors validate.ts. */
export function anchorPath(anchor: string): string {
  return anchor.split("::")[0].replace(/:\d+(-\d+)?$/, "");
}

// Sentinels: substituted before the single-star rule so `**` never decays into `[^/]*`.
// Spelled out rather than a control character so the source stays greppable.
const DIR_STAR = "@@GLOB_DIR_STAR@@";
const ANY_STAR = "@@GLOB_ANY_STAR@@";

export function globToRe(g: string): RegExp {
  const body = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", DIR_STAR)
    .replaceAll("**", ANY_STAR)
    .replaceAll("*", "[^/]*")
    .replaceAll(DIR_STAR, "(?:.*/)?")
    .replaceAll(ANY_STAR, ".*");
  return new RegExp(`^${body}$`);
}

export function layersOf(scope: string[], spec: LayerSpec): Set<string> {
  const hit = new Set<string>();
  for (const anchor of scope) {
    const path = anchorPath(String(anchor));
    for (const [name, globs] of Object.entries(spec.layers)) {
      if (globs.some((g) => globToRe(g).test(path))) hit.add(name);
    }
  }
  return hit;
}

/** Longest chain in nodes. A cycle is validate.ts's defect; here it must only not hang. */
export function longestChain(tasks: Task[]): number {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    const deps = (byId.get(id)?.depends_on ?? []).filter((d) => byId.has(d));
    const d = deps.length ? 1 + Math.max(...deps.map((x) => depth(x, new Set([...seen, id])))) : 1;
    memo.set(id, d);
    return d;
  };
  return tasks.length ? Math.max(...tasks.map((t) => depth(t.id, new Set()))) : 0;
}

/**
 * Expand-contract, read off the DAG: exactly one source, a fan of two or more middles each
 * blocked by nothing but that source, and one sink blocked by all of them. Topology alone
 * decides it - there is no wording to game, and none to get right either, which is the
 * point: a decomposition either has this shape or it does not.
 */
export function expandContract(tasks: Task[]): boolean {
  if (tasks.length < 4) return false;
  const ids = new Set(tasks.map((t) => t.id));
  const deps = (t: Task) => t.depends_on.filter((d) => ids.has(d));
  const sources = tasks.filter((t) => deps(t).length === 0);
  if (sources.length !== 1) return false;
  const expand = sources[0];

  const dependedOn = new Set(tasks.flatMap(deps));
  const sinks = tasks.filter((t) => !dependedOn.has(t.id));
  if (sinks.length !== 1) return false;
  const contract = sinks[0];

  const middles = tasks.filter((t) => t.id !== expand.id && t.id !== contract.id);
  if (middles.length < 2) return false;
  if (!middles.every((m) => deps(m).length === 1 && deps(m)[0] === expand.id)) return false;
  return middles.every((m) => contract.depends_on.includes(m.id));
}

/**
 * Advisory only, and lexical, so it is reported apart from the ranked metrics. It flags a
 * goal that opens on a verb of work and never says what is observable afterwards. It cannot
 * see whether a goal is true, only whether it is shaped like a state.
 */
const WORK_VERB =
  /^\s*(add|update|create|implement|refactor|wire|introduce|extract|move|rename|migrate|build|port|set up|hook up|switch)\b/i;
const STATE_CLAUSE =
  /\b(so that|returns?|responds?|renders?|shows?|carries|contains?|reflects?|persists?|resolves?|survives?|no longer|still|is|are|sees?|can)\b/i;

export function workShaped(goal: string): boolean {
  return WORK_VERB.test(goal) && !STATE_CLAUSE.test(goal);
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function readTasks(tasksDir: string): Task[] {
  return readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const fm = frontmatter(join(tasksDir, f));
      return {
        file: basename(f),
        id: String(fm.id ?? f.replace(/\.md$/, "")),
        goal: String(fm.goal ?? ""),
        satisfies: list(fm.satisfies),
        scope: list(fm.scope),
        depends_on: list(fm.depends_on),
      };
    });
}

export function grade(tasks: Task[], reqIds: string[], spec: LayerSpec): Metrics {
  const n = tasks.length;
  if (!n) throw new Error("no tasks to grade");

  let complete = 0;
  let single = 0;
  for (const t of tasks) {
    const hit = layersOf(t.scope, spec);
    const product = [...hit].filter((l) => !spec.verification.includes(l));
    const verified = [...hit].some((l) => spec.verification.includes(l));
    if (product.length >= 2 && verified) complete++;
    if (product.length === 1) single++;
  }

  const claimed = reqIds.map((r) => tasks.filter((t) => t.satisfies.includes(r)).length);
  const covered = claimed.filter((c) => c > 0);

  return {
    task_count: n,
    complete_path: complete / n,
    single_layer: single / n,
    critical_path: n > 1 ? (longestChain(tasks) - 1) / (n - 1) : 0,
    startable: tasks.filter((t) => !t.depends_on.length).length / n,
    req_fanout: covered.length ? covered.reduce((a, b) => a + b, 0) / covered.length : 0,
    unclaimed: tasks.filter((t) => !t.satisfies.length).length,
    expand_contract: expandContract(tasks) ? 1 : 0,
    work_shaped_goals: tasks.filter((t) => workShaped(t.goal)).length,
  };
}
