/**
 * `mt oracle`, which cli/mt loads only when it is called. Pinned files, reports and commands are
 * relative to the root of the git repo it is run in, from whichever of its folders.
 *
 *   mt oracle hash <file>...           one `path: sha256` line per file, its path relative to the
 *                                      repo root, ready to pin under an oracle's files
 *   mt oracle run [--base] [--timeout <seconds>] <shape>
 *                                      check each oracle's pinned files, run it, and print one
 *                                      `O<n>: <verdict>` line per oracle; exit 0 when every oracle
 *                                      passes, or with --base when each does what its `base` says
 *
 * A shape of `-` is read from stdin. Usage errors exit 2.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { constants } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { isFile, readShape, report } from "../shape/command.ts";
import { isRelativePath, parseOracles, type Oracle } from "../shape/shape.ts";

const USAGE = `usage: mt oracle hash <file>...
       mt oracle run [--base] [--timeout <seconds>] <shape>
A shape of - is read from stdin.
`;

class UsageError extends Error {}

/**
 * pass and fail are the checks' own answer; blocked is a check that could not be made, such as a
 * dependency the change does not own; broken is an oracle that did not run as written; tampered
 * is a pinned file that changed.
 */
export type Verdict = "pass" | "fail" | "blocked" | "broken" | "tampered";

type Result = { readonly verdict: Verdict; readonly detail?: string };

/**
 * The exit code as automake's test harness reads it: 0 pass, 77 skip, 99 hard error, else fail.
 * A command that did not start, or one a signal ended, which sh reports as 128 and up, is broken.
 */
export function verdictOfExit(code: number | null): Result {
  if (code === null) return { verdict: "broken", detail: "killed by a signal" };
  if (code === 0) return { verdict: "pass" };
  if (code === 77) return { verdict: "blocked" };
  if (code === 99) return { verdict: "broken", detail: "exit 99" };
  if (code === 126 || code === 127) return { verdict: "broken", detail: `exit ${code}: the command did not start` };
  if (code >= 128) return { verdict: "broken", detail: `exit ${code}: killed by a signal` };
  return { verdict: "fail" };
}

/**
 * A JUnit XML report: an error is broken, a failure fails, a skip is blocked, and no test case is
 * broken, as is a report that does not end its root element, such as one a crash cut short.
 * Comments and CDATA, such as a test's captured output, are not read.
 */
export function verdictOfJunit(report: string): Result {
  const xml = report.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  if (!/(?:<\/testsuites?>|<testsuites?\b[^>]*\/>)\s*$/.test(xml)) return { verdict: "broken", detail: "the report is incomplete" };
  const cases = xml.match(/<testcase\b/g)?.length ?? 0;
  if (cases === 0) return { verdict: "broken", detail: "the report has no test case" };
  if (/<error\b/.test(xml)) return { verdict: "broken", detail: "a test case errored rather than failed" };
  if (/<failure\b/.test(xml)) return { verdict: "fail" };
  if (/<skipped\b/.test(xml)) return { verdict: "blocked" };
  return { verdict: "pass" };
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The root of the git repo mt runs in. */
function repoRoot(): string | undefined {
  const git = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  if (git.exitCode === 0) return git.stdout.toString().trim();
  process.stderr.write(`mt: oracles run inside a git repo: ${git.stderr.toString().trim()}\n`);
  return undefined;
}

function changedFile(root: string, oracle: Oracle): string | undefined {
  for (const [path, pinned] of Object.entries(oracle.files)) {
    const file = join(root, path);
    if (!existsSync(file)) return `${path} is missing`;
    if (!statSync(file).isFile()) return `${path} is not a file`;
    if (sha256(file) !== pinned) return `${path} changed since it was pinned`;
  }
  return undefined;
}

function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    // No such group: every process in it has already exited.
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
  }
}

/**
 * Runs the command in a process group of its own, which is killed when the command ends, times
 * out or mt is interrupted, so nothing it started outlives it.
 */
async function execute(command: string, root: string, timeout: number | undefined): Promise<{ exitCode: number | null; timedOut: boolean }> {
  // The oracle's own output goes to stderr, so stdout holds only the verdicts.
  const child = Bun.spawn(["sh", "-c", command], { cwd: root, detached: true, stdin: "ignore", stdout: 2, stderr: 2 });
  let timedOut = false;
  const timer =
    timeout === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true;
          killGroup(child.pid);
        }, timeout * 1000);
  const interrupted = (signal: "SIGINT" | "SIGTERM") => {
    killGroup(child.pid);
    process.exit(128 + constants.signals[signal]);
  };
  process.on("SIGINT", interrupted);
  process.on("SIGTERM", interrupted);
  await child.exited;
  clearTimeout(timer);
  process.off("SIGINT", interrupted);
  process.off("SIGTERM", interrupted);
  killGroup(child.pid);
  return { exitCode: child.exitCode, timedOut };
}

async function runOracle(root: string, oracle: Oracle, timeout: number | undefined): Promise<Result> {
  const changed = changedFile(root, oracle);
  if (changed !== undefined) return { verdict: "tampered", detail: changed };
  const junit = oracle.junit === undefined ? undefined : join(root, oracle.junit);
  // A report left by an earlier run must not answer for this one.
  if (junit !== undefined && existsSync(junit)) {
    if (!statSync(junit).isFile()) return { verdict: "broken", detail: `${oracle.junit} is not a file` };
    rmSync(junit);
  }
  const run = await execute(oracle.run, root, timeout);
  if (run.timedOut) return { verdict: "broken", detail: `still running after ${timeout}s` };
  // A runner that crashed or did not start proves nothing, whatever its report says.
  const exit = verdictOfExit(run.exitCode);
  if (junit === undefined || exit.verdict === "broken") return exit;
  if (!existsSync(junit)) return { verdict: "broken", detail: `no report at ${oracle.junit}` };
  const result = verdictOfJunit(readFileSync(junit, "utf8"));
  if (result.verdict === "pass" && run.exitCode !== 0) return { verdict: "broken", detail: `a passing report, but exit ${run.exitCode}` };
  return result;
}

async function run(args: readonly string[]): Promise<number> {
  let base = false;
  let timeout: number | undefined;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--base") base = true;
    else if (arg === "--timeout") {
      const seconds = Number(args[++i]);
      if (!Number.isInteger(seconds) || seconds <= 0) throw new UsageError("--timeout needs a whole number of seconds above 0");
      timeout = seconds;
    } else if (isFile(arg)) files.push(arg);
    else throw new UsageError(`unknown option '${arg}'`);
  }
  const [file, ...rest] = files;
  if (file === undefined || rest.length > 0) throw new UsageError("run takes one shape");
  const yaml = readShape(file);
  if (yaml === undefined) return 1;
  const parsed = parseOracles(yaml);
  if (!parsed.ok) {
    report(parsed.violations);
    return 1;
  }
  const root = repoRoot();
  if (root === undefined) return 1;

  let met = true;
  for (const [id, oracle] of Object.entries(parsed.shape)) {
    const { verdict, detail } = await runOracle(root, oracle, timeout);
    const expected = base ? oracle.base : "pass";
    const ok = verdict === expected;
    met &&= ok;
    const outcome = base ? `${verdict}, ${ok ? "as expected" : `expected ${expected}`}` : verdict;
    process.stdout.write(`${id}: ${outcome}${detail === undefined ? "" : ` - ${detail}`} (covers ${oracle.covers.join(", ")})\n`);
  }
  return met ? 0 : 1;
}

/** The path `files` takes for a file named from mt's working folder, or undefined if it has none. */
function pinPath(root: string, file: string): string | undefined {
  const absolute = resolve(file);
  const path = relative(root, join(realpathSync(dirname(absolute)), basename(absolute)));
  const outside = path === ".." || path.startsWith("../") || isAbsolute(path);
  return !outside && isRelativePath(path) ? path : undefined;
}

function hash(args: readonly string[]): number {
  if (args.length === 0) throw new UsageError("hash needs a file");
  const unknown = args.find((arg) => arg.startsWith("-"));
  if (unknown !== undefined) throw new UsageError(`unknown option '${unknown}'`);
  const root = repoRoot();
  if (root === undefined) return 1;
  let code = 0;
  for (const file of args) {
    try {
      const digest = sha256(file);
      const path = pinPath(root, file);
      if (path === undefined) {
        process.stderr.write(`mt: cannot pin '${file}': it is outside the repo at ${root}, or its path holds whitespace\n`);
        code = 1;
      } else process.stdout.write(`${path}: ${digest}\n`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      process.stderr.write(`mt: cannot read '${file}': ${reason}\n`);
      code = 1;
    }
  }
  return code;
}

export async function runOracleCommand(args: readonly string[]): Promise<number> {
  const [subcommand, ...rest] = args;
  try {
    switch (subcommand) {
      case "hash":
        return hash(rest);
      case "run":
        return await run(rest);
      default:
        throw new UsageError(subcommand === undefined ? "oracle needs hash or run" : `unknown oracle command '${subcommand}'`);
    }
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`mt: ${error.message}\n${USAGE}`);
    return 2;
  }
}
