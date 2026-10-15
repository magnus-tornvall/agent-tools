/**
 * `mt report check`, which cli/mt loads only when it is called.
 *
 *   mt report check <file> --task <id> --base <ref>
 *                       nothing and exit 0 when the branch bears out every claim, otherwise one
 *                       `<id>/F<m>: <what>: <claim>` line per mismatch on stdout and exit 1
 *
 * A file of `-` is read from stdin. The branch is the worktree it runs in, its HEAD diffed against
 * the base ref; a claimed test file is read from HEAD and from the merge base of the ref and HEAD.
 * An unreadable report, a base ref git does not know or a git command that fails exits 1 with one
 * line on stderr. Usage errors exit 2.
 */
import { readFileSync } from "node:fs";
import { findings, testPaths } from "./check.ts";

const USAGE = `usage: mt report check <file> --task <id> --base <ref>
A file of - is read from stdin.
`;

class UsageError extends Error {}

class CheckError extends Error {}

function readReport(file: string): string {
  try {
    return readFileSync(file === "-" ? 0 : file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CheckError(`cannot read '${file}': ${reason}`);
  }
}

function git(args: readonly string[]) {
  return Bun.spawnSync(["git", ...args]);
}

/** Each path `git diff <base>...HEAD` touches from the repo root, a rename as both its paths. */
function touched(base: string): string[] {
  const known = git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${base}^{commit}`]);
  if (!known.success) throw new CheckError(`git does not know the base ref '${base}' here`);
  const diff = git(["diff", "--name-only", "--no-renames", "--no-relative", "-z", `${base}...HEAD`, "--"]);
  if (!diff.success) throw new CheckError(`git diff ${base}...HEAD failed: ${diff.stderr.toString().trim().split("\n")[0]}`);
  return diff.stdout.toString().split("\0").filter((path) => path !== "");
}

function mergeBase(base: string): string {
  const found = git(["merge-base", base, "HEAD"]);
  if (!found.success) throw new CheckError(`git finds no merge base of '${base}' and HEAD`);
  return found.stdout.toString().trim();
}

/** Each path's text at the commit; a path the commit lacks is left out. */
function filesAt(commit: string, paths: readonly string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const path of paths) {
    const blob = git(["cat-file", "blob", `${commit}:${path}`]);
    if (blob.success) files.set(path, blob.stdout.toString());
  }
  return files;
}

function check(args: readonly string[]): number {
  let file: string | undefined;
  let task: string | undefined;
  let base: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--task" || arg === "--base") {
      const value = args[++i];
      if (value === undefined || value === "") throw new UsageError(`${arg} needs a value`);
      if (arg === "--task") task = value;
      else base = value;
    } else if (arg !== "-" && arg.startsWith("-")) {
      throw new UsageError(`unknown option '${arg}'`);
    } else {
      if (file !== undefined) throw new UsageError(`unexpected argument '${arg}'`);
      file = arg;
    }
  }
  if (file === undefined) throw new UsageError("check needs a report file");
  if (task === undefined) throw new UsageError("check needs --task");
  if (base === undefined) throw new UsageError("check needs --base");

  try {
    const report = readReport(file);
    const paths = testPaths(report);
    const lines = findings(report, task, {
      touched: touched(base),
      files: filesAt("HEAD", paths),
      baseFiles: filesAt(mergeBase(base), paths),
    });
    process.stdout.write(lines.map((line) => `${line}\n`).join(""));
    return lines.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof CheckError)) throw error;
    process.stderr.write(`mt: report check: ${error.message}\n`);
    return 1;
  }
}

export function runReport(args: readonly string[]): number {
  const [subcommand, ...rest] = args;
  try {
    if (subcommand === "check") return check(rest);
    throw new UsageError(subcommand === undefined ? "report needs check" : `unknown report command '${subcommand}'`);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`mt: ${error.message}\n${USAGE}`);
    return 2;
  }
}
