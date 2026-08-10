#!/usr/bin/env bun
//
// Phase-aware structural check for a `mise-en-place` change directory. Run at every phase,
// not once at the end: the whole point is to report current state and what is needed to
// move forward, which is only useful while fields are still empty.
//
// Two kinds of output, deliberately separated:
//   gaps    - a field the phase needs and does not have yet. Normal mid-phase state.
//   defects - a factual or structural error. Not a gap; nothing downstream can proceed.
//
// Usage: bun validate.ts <change dir> [--phase spec|plan|tasks]
// Exit 0 = phase invariants hold, 1 = gaps remain, 2 = malformed or unusable.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const PHASES = ["spec", "plan", "tasks"] as const;
type Phase = (typeof PHASES)[number];

const gaps: string[] = [];
const defects: string[] = [];
const warnings: string[] = [];

function die(msg: string): never {
  console.error(`defect: ${msg}`);
  process.exit(2);
}

function frontmatter(path: string): Record<string, any> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"));
  if (!match) die(`${path}: no YAML frontmatter`);
  try {
    return (Bun.YAML.parse(match[1]) ?? {}) as Record<string, any>;
  } catch (e) {
    die(`${path}: ${(e as Error).message}`);
  }
}

/** Strip `:34`, `:34-51`, or `::symbol` off an anchor, leaving the path. */
function anchorPath(anchor: string): string {
  return anchor.split("::")[0].replace(/:\d+(-\d+)?$/, "");
}

function empty(v: unknown): boolean {
  return v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
}

/**
 * A list field, or exit 2. Every list here is iterated: a string would iterate per
 * character and report nonsense, and a mapping would throw - which exits 1, the code that
 * means "gaps remain", so a malformed file would be read as an unfinished one.
 */
function arr(v: unknown, what: string): any[] {
  if (v == null) return [];
  if (!Array.isArray(v)) die(`${what} must be a list`);
  return v;
}

/**
 * Every `**Term**:` the project's glossaries define, and every word they tell you to
 * avoid. Null when the project has no glossary at all - nothing to check against.
 */
function glossary(): { terms: Set<string>; avoid: Map<string, string> } | null {
  const files = existsSync("CONTEXT.md") ? ["CONTEXT.md"] : [];
  if (existsSync("CONTEXT-MAP.md")) {
    for (const m of readFileSync("CONTEXT-MAP.md", "utf8").matchAll(/\]\(\.?\/?([^)]*CONTEXT\.md)\)/g)) {
      if (existsSync(m[1])) files.push(m[1]);
    }
  }
  if (!files.length) return null;

  const terms = new Set<string>();
  const avoid = new Map<string, string>();
  for (const f of files) {
    let last = "";
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const term = /^\*\*(.+?)\*\*:/.exec(line);
      if (term) {
        last = term[1];
        terms.add(last.toLowerCase());
        continue;
      }
      const av = /^_Avoid_:\s*(.+)$/.exec(line);
      if (av && last) for (const w of av[1].split(",")) avoid.set(w.trim().toLowerCase(), last);
    }
  }
  return { terms, avoid };
}

/**
 * Capitalised words that are not sentence-initial - a crude stand-in for "domain noun".
 * Deliberately incomplete: it misses lowercase domain terms and flags proper nouns that
 * were never domain terms. That is why every finding from it is a warning.
 */
function capitalisedNouns(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const w of sentence.trim().split(/\s+/).slice(1)) {
      const bare = w.replace(/[^A-Za-z-]/g, "");
      if (/^[A-Z][A-Za-z-]{2,}$/.test(bare)) out.push(bare);
    }
  }
  return out;
}

if (typeof Bun === "undefined" || !("YAML" in Bun)) die("needs bun >= 1.2 (Bun.YAML)");

const dir = process.argv[2];
if (!dir) die("usage: validate.ts <change dir> [--phase spec|plan|tasks]");
const changeFile = join(dir, "change.md");
if (!existsSync(changeFile)) die(`${changeFile} not found`);

const change = frontmatter(changeFile);
const spec = change.spec ?? {};
const plan = change.plan ?? {};
const approvals = change.approvals ?? {};
const requirements = arr(spec.requirements, "spec.requirements");

const flagIndex = process.argv.indexOf("--phase");
const phase = String(flagIndex > -1 ? process.argv[flagIndex + 1] : change.phase ?? "") as Phase;
if (!PHASES.includes(phase)) die(`phase must be one of ${PHASES.join(", ")}, got "${phase}"`);

// Phases up to and including the current one. An approved phase is still checked - a
// later phase can invalidate an earlier one, and finding that here beats finding it in
// the implementation loop.
const active = PHASES.slice(0, PHASES.indexOf(phase) + 1);
const checking = (p: Phase) => active.includes(p);

// Approvals cascade. An approval standing downstream of a revoked one is state no reader
// can interpret: it claims the tasks were approved against a plan that was withdrawn.
for (let i = 1; i < PHASES.length; i++) {
  if (approvals[PHASES[i]] === true && approvals[PHASES[i - 1]] !== true) {
    defects.push(`approvals.${PHASES[i]} is true but approvals.${PHASES[i - 1]} is not`);
  }
}
if (approvals[phase] === true && phase !== PHASES[PHASES.length - 1]) {
  defects.push(`phase is ${phase} but approvals.${phase} is already true - advance phase`);
}

// The mirror of the cascade: a `phase` set past a gate that was never given. Without this
// a hand-edited `phase: tasks` with no approvals is checked and can be approved, skipping
// both upstream gates. Fix by setting `phase` back to the first unapproved phase - never
// by approving on the user's behalf.
for (const p of PHASES.slice(0, PHASES.indexOf(phase))) {
  if (approvals[p] !== true) defects.push(`phase is ${phase} but approvals.${p} is not true`);
}

// open_questions blocks its own phase's approval and nothing else. Empty at approval by
// definition, so it never reaches the handoff.
for (const p of active) {
  const holder = p === "tasks" ? change.tasks ?? {} : p === "spec" ? spec : plan;
  for (const q of arr(holder.open_questions, `${p}.open_questions`)) gaps.push(`${p}.open_questions: ${q}`);
}

// Discovered before the plan checks, because whether an empty `constraints` matters
// depends on how many tasks could disagree about it.
const tasksDir = join(dir, "tasks");
const taskFiles = existsSync(tasksDir)
  ? readdirSync(tasksDir).filter((f) => f.endsWith(".md")).sort()
  : [];

// ---- spec ----------------------------------------------------------------------------

// A requirement naming a file or a technology is an approach decision wearing a
// requirement's clothes. Cheap regex, catches the common shape: a path, or an extension.
const APPROACH_SHAPED = /(\b[\w.-]+\/[\w.-]+)|(\.\w{2,4}\b)/;

if (checking("spec")) {
  if (empty(spec.outcome)) gaps.push("spec.outcome is empty");
  if (empty(spec.kill_criterion)) gaps.push("spec.kill_criterion is empty");
  if (empty(spec.requirements)) gaps.push("spec.requirements is empty - nothing to deliver");
  // A change with no non-goals is possible. A change where nobody considered scope is
  // more common, so this is the user's to dismiss rather than the script's to allow.
  if (empty(spec.non_goals)) warnings.push("spec.non_goals is empty - was scope considered?");

  const gloss = glossary();
  const seen = new Set<string>();
  for (const r of requirements) {
    const id = String(r?.id ?? "");
    if (!/^R\d+$/.test(id)) defects.push(`requirement id "${id}" is not R followed by digits`);
    if (seen.has(id)) defects.push(`requirement id ${id} is used twice`);
    seen.add(id);

    if (empty(r?.text)) {
      gaps.push(`${id} has no text`);
      continue;
    }
    const text = String(r.text);
    if (APPROACH_SHAPED.test(text)) {
      warnings.push(`${id} looks like it names a file or technology - that belongs in plan`);
    }
    if (gloss) {
      for (const [word, canonical] of gloss.avoid) {
        if (/[^\w-]/.test(word)) continue;
        if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
          warnings.push(`${id} says "${word}" - the glossary prefers "${canonical}"`);
        }
      }
      for (const noun of capitalisedNouns(text)) {
        if (!gloss.terms.has(noun.toLowerCase())) {
          warnings.push(`${id}: "${noun}" is in no glossary - define it or reword`);
        }
      }
    }
  }
  if (requirements.length > 7) {
    warnings.push(`${requirements.length} requirements - this is often two changes`);
  }
}

// ---- plan --------------------------------------------------------------------------

if (checking("plan")) {
  if (empty(plan.approach)) gaps.push("plan.approach is empty");
  if (empty(plan.touchpoints)) gaps.push("plan.touchpoints is empty");
  if (empty(plan.escalate_if)) gaps.push("plan.escalate_if is empty - nothing stops the loop");
  // acceptance may legitimately be empty: no single command decides every change.
  if (empty(plan.acceptance)) warnings.push("plan.acceptance is empty - no change-level check");
  // constraints coordinates tasks. With one task there is nothing to coordinate, so an
  // empty list is only suspicious once two tasks could decide the same thing differently.
  if (empty(plan.constraints) && taskFiles.length > 1) {
    warnings.push(`plan.constraints is empty but ${taskFiles.length} tasks could disagree`);
  }

  // Touchpoints name code that exists now, so a miss is a factual error, not a gap.
  for (const t of arr(plan.touchpoints, "plan.touchpoints")) {
    if (!existsSync(anchorPath(String(t)))) defects.push(`plan.touchpoints: ${t} does not resolve`);
  }
}

// ---- tasks -------------------------------------------------------------------------

if (checking("tasks")) {
  if (!taskFiles.length) {
    gaps.push("tasks/ holds no tasks");
  } else {
    const tasks = taskFiles.map((f) => ({ file: join(tasksDir, f), ...frontmatter(join(tasksDir, f)) }));
    const ids = new Set(tasks.map((t) => String(t.id)));

    // Two tasks sharing an id is not cosmetic: `byId` keeps one, so the other leaves the
    // DAG walk entirely and every `depends_on` naming that id is undecidable.
    const seenIds = new Set<string>();
    for (const t of tasks) {
      const id = String(t.id ?? "");
      if (!/^T\d+$/.test(id)) defects.push(`${basename(t.file)}: id "${id}" is not T followed by digits`);
      if (seenIds.has(id)) defects.push(`task id ${id} is used by more than one file`);
      seenIds.add(id);
    }

    for (const t of tasks) {
      const where = basename(t.file);

      if (empty(t.goal)) gaps.push(`${where}: goal is empty`);

      // The loop writes `done`. A task born done is skipped by it - same forgery family
      // as a verify that already passes. Legitimate only when re-entering mid-change,
      // which is why it warns rather than blocks.
      if (!["todo", "done"].includes(String(t.status))) {
        defects.push(`${where}: status must be todo or done, got "${t.status}"`);
      } else if (t.status === "done" && approvals.tasks !== true) {
        warnings.push(`${where}: status is done before the tasks were approved`);
      }

      // A verify that cannot decide by exit status cannot gate anything.
      if (empty(t.verify)) gaps.push(`${where}: verify is empty`);
      else if (/<[^>]+>|\byour\b/i.test(String(t.verify))) {
        defects.push(`${where}: verify contains a placeholder`);
      }

      if (!["pass", "fail", "unrun"].includes(String(t.verify_result))) {
        gaps.push(`${where}: verify_result must be pass, fail or unrun`);
      }
      // Recorded before the change is implemented, so `pass` means the check does not
      // test the change, or the task is a no-op. Louder forgery than `unrun`.
      if (t.verify_result === "pass") {
        warnings.push(`${where}: verify already passes - it may not test the change`);
      }
      if (t.verify_result === "unrun") warnings.push(`${where}: verify was never run`);

      for (const dep of arr(t.depends_on, `${where}: depends_on`)) {
        if (!ids.has(String(dep))) defects.push(`${where}: depends_on ${dep} is not a task`);
      }
      // A task with no scope carries no anchor, and an anchor is the whole evidence trail.
      if (empty(t.scope)) gaps.push(`${where}: scope is empty - no anchor, no evidence`);
      // Task scope may name a file the task creates, so a miss is only a warning.
      for (const s of arr(t.scope, `${where}: scope`)) {
        if (!existsSync(anchorPath(String(s)))) warnings.push(`${where}: scope ${s} does not resolve`);
      }
      for (const f of arr(t.forbidden, `${where}: forbidden`)) {
        const p = String(f?.path ?? f);
        if (p.includes("::") || /:\d/.test(p)) defects.push(`${where}: forbidden ${p} is an anchor`);
      }
    }

    // A cycle deadlocks the loop with no error of its own.
    const byId = new Map(tasks.map((t) => [String(t.id), t]));
    const state = new Map<string, number>(); // 1 = visiting, 2 = done
    (function walkAll() {
      const walk = (id: string, trail: string[]): void => {
        if (state.get(id) === 2) return;
        if (state.get(id) === 1) {
          defects.push(`depends_on cycle: ${[...trail, id].join(" -> ")}`);
          return;
        }
        state.set(id, 1);
        for (const dep of (byId.get(id)?.depends_on ?? []) as any[]) {
          if (byId.has(String(dep))) walk(String(dep), [...trail, id]);
        }
        state.set(id, 2);
      };
      for (const id of ids) walk(id, []);
    })();

    // Coverage, both directions. An uncovered requirement is the tasks frontier: the set
    // does not deliver the spec. A task satisfying an unknown id is a stale reference.
    const satisfied = new Set(
      tasks.flatMap((t) => arr(t.satisfies, `${basename(t.file)}: satisfies`).map(String)),
    );
    for (const r of requirements) {
      if (!satisfied.has(String(r?.id))) gaps.push(`${r?.id} is satisfied by no task`);
    }
    for (const s of satisfied) {
      if (!requirements.some((r: any) => String(r?.id) === s)) {
        defects.push(`a task satisfies ${s}, which is not a requirement`);
      }
    }
  }
}

// ---- report ------------------------------------------------------------------------

for (const w of warnings) console.log(`warning: ${w}`);

if (defects.length) {
  for (const d of defects) console.error(`defect: ${d}`);
  console.error(`\n${defects.length} defects - fix these, they are errors and not gaps.`);
  process.exit(2);
}

if (gaps.length) {
  console.log(`\nneeded to approve ${phase}:`);
  for (const g of gaps) console.log(`  - ${g}`);
  process.exit(1);
}

console.log(`${phase} invariants hold - ready for the user to approve.`);
process.exit(0);
