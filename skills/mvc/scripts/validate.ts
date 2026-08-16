#!/usr/bin/env bun
//
// Structural check for an `mvc` change directory. Run every round, not once at the end:
// the point is to report the current frontier, which is only useful while it is non-empty.
//
// Two kinds of output, deliberately separated:
//   gaps    - something the shape needs and does not have yet. Normal mid-grill state.
//   defects - a structural error. Not a gap; nothing downstream can interpret it.
//
// What is deliberately NOT checked: whether a reason is a real reason, whether an `in`
// item is load-bearing, whether a `rules_out` rules anything out. A script can check that
// a field is filled and never that it is true, and a checkable-but-meaningless slot turns
// "justify this" into "type something". Those live in SKILL.md's reader checklist.
//
// Usage: bun validate.ts <change dir>
// Exit 0 = the shape holds, 1 = gaps remain, 2 = malformed.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DEFAULT_CEILING = 3;
const MAX_PER_ROUND = 4;
const CROWDED_IN = 7;

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

/** Every named field non-empty, or one gap per miss. */
function requireFields(entry: any, where: string, fields: string[]): void {
  // A scalar entry has no fields at all, so every one of them would read as empty and the
  // file would report as unfinished rather than unreadable - the exit 1 / exit 2 confusion
  // this script exists to keep apart.
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    defects.push(`${where} must be a mapping, got "${entry}"`);
    return;
  }
  for (const f of fields) {
    if (empty(entry?.[f])) gaps.push(`${where}: ${f} is empty`);
  }
}

/** Normalised for cross-list identity. Two buckets claiming one item is a defect. */
function key(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.]$/, "");
}

/**
 * `seen_in` holds project-relative paths, so they must resolve against the repository, not
 * against wherever the script happened to be run from - otherwise a correct artifact defects
 * on every invocation outside the repo root. Walk up for `.git`; with no repo above it, the
 * change dir is the best guess left.
 */
function repoRoot(from: string): string {
  let d = resolve(from);
  while (dirname(d) !== d) {
    if (existsSync(join(d, ".git"))) return d;
    d = dirname(d);
  }
  return resolve(from);
}

if (typeof Bun === "undefined" || !("YAML" in Bun)) die("needs bun >= 1.2 (Bun.YAML)");

const dir = process.argv[2];
if (!dir) die("usage: validate.ts <change dir>");
const file = join(dir, "mvc.md");
if (!existsSync(file)) die(`${file} not found`);

const mvc = frontmatter(file);
const budget = mvc.budget ?? {};
const inList = arr(mvc.in, "in");
const settled = arr(mvc.settled, "settled");
const widened = arr(mvc.widened, "widened");
const deferred = arr(mvc.deferred, "deferred");
const out = arr(mvc.out, "out");
const terms = arr(mvc.terms, "terms");
const open = arr(mvc.open, "open");

// ---- budget ---------------------------------------------------------------------------

const round = budget.round;
const ceiling = budget.ceiling ?? DEFAULT_CEILING;

if (!Number.isInteger(round) || round < 0) {
  defects.push(`budget.round must be an integer >= 0, got "${round}"`);
}
if (!Number.isInteger(ceiling) || ceiling < 1) {
  defects.push(`budget.ceiling must be an integer >= 1, got "${ceiling}"`);
} else if (ceiling > DEFAULT_CEILING) {
  // The skill promises it never raises its own ceiling, and it is also the thing writing
  // this file - so the promise is worth as much as a check on it. Lowering is the user's
  // to make; only raising is the rule being broken.
  defects.push(`budget.ceiling is ${ceiling} - this skill does not raise its own ceiling of ${DEFAULT_CEILING}`);
}
if (Number.isInteger(round) && Number.isInteger(ceiling)) {
  // Past the ceiling is a rule already broken, not a state to report: the skill promises
  // there is no round ceiling+1, so reaching one means it ran a round it had no budget for.
  if (round > ceiling) {
    defects.push(`budget.round is ${round} - there is no round ${ceiling + 1}`);
  } else if (round === ceiling && open.length) {
    // Exhaustion is reaching the ceiling with a frontier, not passing it. Reporting it only
    // past the ceiling would print the open questions as ordinary gaps at round `ceiling`,
    // invite one more round, and quietly make the budget ceiling+1.
    gaps.push(`budget exhausted - ${open.length} question(s) open after ${round} of ${ceiling} rounds`);
  }
}
// The ceiling bounds what can be asked, so it also bounds what can have been settled by
// asking. More decisions than that means either the user volunteered them off-budget
// (legitimate, and common) or a round quietly asked more than four questions.
if (Number.isInteger(round) && settled.length > round * MAX_PER_ROUND) {
  warnings.push(
    `${settled.length} settled decisions after ${round} round(s) - at most ` +
      `${round * MAX_PER_ROUND} could have been asked, so the rest were volunteered`,
  );
}

// ---- outcome and in -------------------------------------------------------------------

if (empty(mvc.outcome)) gaps.push("outcome is empty");
if (empty(inList)) gaps.push("in is empty - nothing ships");

for (const [i, item] of inList.entries()) {
  if (typeof item !== "string") defects.push(`in[${i}] must be a string, not a mapping`);
  else if (!item.trim()) gaps.push(`in[${i}] is empty`);
}
if (inList.length > CROWDED_IN) {
  warnings.push(`${inList.length} items in scope - this is often two changes`);
}
// An MVC that cut nothing did not minimise; it just wrote down the first idea. The user
// dismisses this when a change genuinely has no adjacent surface, which does happen.
if (empty(deferred) && empty(out)) {
  warnings.push("nothing is deferred and nothing is out - was anything actually cut?");
}

// ---- settled and open -----------------------------------------------------------------

const ids = new Set<string>();
function checkId(raw: unknown, pattern: RegExp, what: string): string {
  const id = String(raw ?? "");
  if (!pattern.test(id)) defects.push(`${what} id "${id}" does not match ${pattern.source}`);
  if (ids.has(id)) defects.push(`id ${id} is used twice`);
  ids.add(id);
  return id;
}

for (const d of settled) {
  const id = checkId(d?.id, /^D\d+$/, "settled");
  // `rules_out` is required because it is the point. A decision that eliminates no
  // alternative was a description, and the script can at least insist one was written.
  requireFields(d, id, ["q", "a", "reason", "rules_out"]);
}

for (const q of open) {
  const id = checkId(q?.id, /^Q\d+$/, "open");
  requireFields(q, id, ["q", "stance"]);
  gaps.push(`${id} is open: ${q?.q ?? "(no question)"}`);
}
if (open.length > MAX_PER_ROUND && Number.isInteger(round) && round < ceiling) {
  warnings.push(`${open.length} open questions but only ${MAX_PER_ROUND} fit a round - rank them`);
}

// ---- the three buckets ------------------------------------------------------------------

const FROM = ["deferred", "out", "discovered"];
const TERM_STATUS = ["new", "conflict", "narrowed"];

for (const [i, w] of widened.entries()) {
  requireFields(w, `widened[${i}]`, ["what", "reason", "ruled_out"]);
  if (!FROM.includes(String(w?.from))) {
    defects.push(`widened[${i}]: from must be one of ${FROM.join(", ")}, got "${w?.from}"`);
  }
}
for (const [i, d] of deferred.entries()) requireFields(d, `deferred[${i}]`, ["what", "reason"]);
for (const [i, o] of out.entries()) requireFields(o, `out[${i}]`, ["what", "boundary"]);

// `status` and `seen_in` are two statements of one fact - whether a glossary already
// defines this term. Disagreement between them is a contradiction, not a gap: a reader
// cannot tell which half is wrong, so neither can be acted on.
const root = repoRoot(dir);
for (const [i, t] of terms.entries()) {
  const where = `terms[${i}]`;
  requireFields(t, where, ["term", "means"]);

  const status = String(t?.status);
  if (!TERM_STATUS.includes(status)) {
    defects.push(`${where}: status must be one of ${TERM_STATUS.join(", ")}, got "${t?.status}"`);
    continue;
  }
  const seen = arr(t?.seen_in, `${where}: seen_in`);
  if (status === "new" && seen.length) {
    defects.push(`${where}: status is new but seen_in names ${seen.length} definition(s)`);
  }
  if (status !== "new" && !seen.length) {
    defects.push(`${where}: status is ${status} but seen_in is empty - where is the other one?`);
  }
  for (const s of seen) {
    if (!existsSync(join(root, String(s)))) defects.push(`${where}: seen_in ${s} does not resolve`);
  }
  // The one job with no owner. `means` already pins the sense this change uses, so the
  // conflict does not block - but the durable record is owed to someone, and naming it
  // every round is how it gets one.
  if (status === "conflict") {
    warnings.push(`${where}: "${t?.term}" conflicts with an existing definition - owes an ADR`);
  }
}

// An item in two buckets is undecidable, not ambiguous: a reader cannot tell whether it
// ships. This is the exact failure a widening leaves behind when the source list is not
// pruned in the same edit.
const buckets: Array<[string, string[]]> = [
  ["in", inList.filter((x) => typeof x === "string").map(key)],
  ["deferred", deferred.map((d) => key(d?.what))],
  ["out", out.map((o) => key(o?.what))],
];
for (let a = 0; a < buckets.length; a++) {
  for (let b = a + 1; b < buckets.length; b++) {
    for (const k of buckets[a][1]) {
      if (k && buckets[b][1].includes(k)) {
        defects.push(`"${k}" is in both ${buckets[a][0]} and ${buckets[b][0]}`);
      }
    }
  }
}
// Every widening names something that ships. If it is not in `in`, the widening was
// recorded and then reverted, or never applied - either way the record now lies.
const inKeys = buckets[0][1];
for (const w of widened) {
  const k = key(w?.what);
  if (k && !inKeys.includes(k)) defects.push(`widened "${k}" is not in \`in\``);
}

// ---- approval ---------------------------------------------------------------------------

if (mvc.approved !== true && mvc.approved !== false) {
  defects.push(`approved must be true or false, got "${mvc.approved}"`);
}
// Approval is the user's signature on a settled shape. Standing over gaps it signs
// something that was never finished, which is state no reader can interpret.
// Every gap counts, not just an open question: approval over an empty `outcome` signs the
// same unfinished shape. This runs last because it reads the finished gap list.
if (mvc.approved === true) {
  if (open.length) defects.push(`approved is true but ${open.length} question(s) are open`);
  else if (gaps.length) defects.push(`approved is true but ${gaps.length} gap(s) remain`);
  if (round === 0) warnings.push("approved after 0 rounds - nothing was grilled");
}

// ---- report ------------------------------------------------------------------------------

for (const w of warnings) console.log(`warning: ${w}`);

if (defects.length) {
  for (const d of defects) console.error(`defect: ${d}`);
  console.error(`\n${defects.length} defect(s) - fix these, they are errors and not gaps.`);
  process.exit(2);
}

if (gaps.length) {
  console.log(`\nneeded before approval (round ${round} of ${ceiling}):`);
  for (const g of gaps) console.log(`  - ${g}`);
  process.exit(1);
}

console.log(`the shape holds after ${round} round(s) - run the checklist, then the user approves.`);
process.exit(0);
