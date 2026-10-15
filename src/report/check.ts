/**
 * The comparing half of `mt report check`: which claims a Task report makes about the work branch,
 * and which of them the branch does not bear out. It reads no files and runs nothing; command.ts
 * feeds it the report, the paths the branch touched and the text of each claimed test file.
 */

/** One claim line: `Changed: <path>` or `Added test: <path>::<name>`. */
export type Claim = { kind: "changed"; path: string } | { kind: "test"; path: string; name: string } | { kind: "malformed"; text: string };

/** A claim line on its own, optionally indented or a `-` or `*` list item. */
const CLAIM = /^\s*(?:[-*]\s+)?(Changed|Added test):\s*(.*?)\s*$/;

/** Every claim line of a report, in the order they stand in it. */
export function claims(report: string): Claim[] {
  const found: Claim[] = [];
  for (const line of report.split("\n")) {
    const match = CLAIM.exec(line);
    if (match === null) continue;
    const [, kind, value = ""] = match;
    if (kind === "Changed") {
      found.push(value === "" ? { kind: "malformed", text: line.trim() } : { kind: "changed", path: value });
      continue;
    }
    const split = value.indexOf("::");
    const path = split < 0 ? "" : value.slice(0, split);
    const name = split < 0 ? "" : value.slice(split + 2);
    found.push(path === "" || name === "" ? { kind: "malformed", text: line.trim() } : { kind: "test", path, name });
  }
  return found;
}

/** The test files the report's `Added test` claims name, each once. */
export function testPaths(report: string): string[] {
  const paths = claims(report).flatMap((claim) => (claim.kind === "test" ? [claim.path] : []));
  return [...new Set(paths)];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The highest `F<k>` the report itself keys under the task, or 0 when it keys none. */
function highestFinding(report: string, task: string): number {
  const key = new RegExp(`(?<![\\w/])${escape(task)}/F(\\d+)(?!\\w)`, "g");
  let highest = 0;
  for (const match of report.matchAll(key)) highest = Math.max(highest, Number(match[1]));
  return highest;
}

export interface Branch {
  /** Each path the diff from the base ref touches, relative to the repo root. */
  touched: readonly string[];
  /** The text of each claimed test file on the branch; a path absent here is absent there. */
  files: ReadonlyMap<string, string>;
}

/**
 * One `<task>/F<m>: <what>: <claim>` line per claim the branch does not bear out, the claims' own
 * mismatches in the order they stand in the report, then each touched path no `Changed` line
 * claims. `<m>` continues after the highest `F<k>` the report keys under the task.
 */
export function findings(report: string, task: string, branch: Branch): string[] {
  const touched = new Set(branch.touched);
  const claimed = new Set<string>();
  const problems: string[] = [];
  for (const claim of claims(report)) {
    if (claim.kind === "malformed") {
      problems.push(`malformed claim: ${claim.text}`);
    } else if (claim.kind === "changed") {
      if (claimed.has(claim.path)) continue;
      claimed.add(claim.path);
      if (!touched.has(claim.path)) problems.push(`claimed but untouched: ${claim.path}`);
    } else if (!branch.files.get(claim.path)?.includes(claim.name)) {
      problems.push(`named test not found: ${claim.path}::${claim.name}`);
    }
  }
  for (const path of branch.touched) {
    if (!claimed.has(path)) problems.push(`touched but unclaimed: ${path}`);
  }
  const first = highestFinding(report, task) + 1;
  return problems.map((problem, index) => `${task}/F${first + index}: ${problem}`);
}
