import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const TMP = mkdtempSync(join(tmpdir(), "mt-report-"));
const REPO = join(TMP, "repo");

/** Git with no config but this test's, so the owner's own settings cannot change what it sees. */
const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};

function gitIn(repo: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: repo, env: ENV });
  if (!result.success) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

function git(...args: string[]): void {
  gitIn(REPO, ...args);
}

/** A repo of its own under TMP: main commits the base files, then a checked-out work branch its own. */
function repoOf(name: string, base: Record<string, string>, work: Record<string, string>): string {
  const repo = join(TMP, name);
  const commit = (files: Record<string, string>, message: string) => {
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), contents);
    }
    gitIn(repo, "add", ".");
    gitIn(repo, "commit", "--quiet", "-m", message);
  };
  mkdirSync(repo);
  gitIn(repo, "init", "--quiet", "--initial-branch=main");
  commit(base, "base");
  gitIn(repo, "checkout", "--quiet", "-b", "work");
  commit(work, "work");
  return repo;
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(join(REPO, path)), { recursive: true });
  writeFileSync(join(REPO, path), contents);
}

let reports = 0;
function reportFile(contents: string): string {
  const path = join(TMP, `report-${++reports}.md`);
  writeFileSync(path, contents);
  return path;
}

function mt(args: string[], stdin?: string, cwd = REPO) {
  const result = Bun.spawnSync([MT, ...args], { cwd, env: ENV, stdin: stdin === undefined ? "ignore" : Buffer.from(stdin) });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function check(report: string) {
  return mt(["report", "check", reportFile(report), "--task", "T4", "--base", "main"]);
}

function stderrLines(stderr: string): string[] {
  return stderr.trimEnd().split("\n");
}

// main holds src/keep.ts and src/d.test.ts; the work branch, checked out, changes src/a.ts and
// src/a.test.ts. The repo's own config sets diff.relative, which only a run from src/ would feel.
beforeAll(() => {
  mkdirSync(REPO);
  git("init", "--quiet", "--initial-branch=main");
  git("config", "diff.relative", "true");
  write("src/keep.ts", "export {};\n");
  write("src/d.test.ts", 'test("accepts a key", () => {});\n');
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  git("checkout", "--quiet", "-b", "work");
  write("src/a.ts", "export const a = 1;\n");
  write("src/a.test.ts", 'test("parses a", () => {});\n');
  git("add", ".");
  git("commit", "--quiet", "-m", "work");
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const MATCHING = "Outcome: succeeded.\nChanged: src/a.ts\nChanged: src/a.test.ts\n";

describe("mt report check", () => {
  test("prints nothing and exits 0 when the Changed lines name exactly the paths the diff touches", () => {
    expect(check(MATCHING)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("names a claimed path the diff does not touch and exits 1", () => {
    expect(check(`${MATCHING}Changed: src/b.ts\n`)).toEqual({ code: 1, stdout: "T4/F1: claimed but untouched: src/b.ts\n", stderr: "" });
  });

  test("names a touched path no Changed line claims and exits 1", () => {
    expect(check("Changed: src/a.test.ts\n")).toEqual({ code: 1, stdout: "T4/F1: touched but unclaimed: src/a.ts\n", stderr: "" });
  });

  test("names a claimed test whose file is absent on the branch", () => {
    expect(check(`${MATCHING}Added test: src/gone.test.ts::rejects an empty key\n`)).toEqual({
      code: 1,
      stdout: "T4/F1: named test not found: src/gone.test.ts::rejects an empty key\n",
      stderr: "",
    });
  });

  test("names a claimed test whose file lacks its name", () => {
    expect(check(`${MATCHING}Added test: src/d.test.ts::rejects an empty key\n`)).toEqual({
      code: 1,
      stdout: "T4/F1: named test not found: src/d.test.ts::rejects an empty key\n",
      stderr: "",
    });
  });

  test("finds a claimed test by its name in the file as committed", () => {
    expect(check(`${MATCHING}Added test: src/a.test.ts::parses a\n`)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("names a claimed test the base already held", () => {
    expect(check(`${MATCHING}Added test: src/d.test.ts::accepts a key\n`)).toEqual({
      code: 1,
      stdout: "T4/F1: named test not added: src/d.test.ts::accepts a key\n",
      stderr: "",
    });
  });

  test("counts a new test as added whose name is part of a name the base already held", () => {
    const held = 'test("exits 2 with no file or flag", () => {});\n';
    const repo = repoOf("prefix", { "src/e.test.ts": held }, { "src/e.test.ts": `${held}test("exits 2 with no file", () => {});\n` });
    const report = reportFile("Changed: src/e.test.ts\nAdded test: src/e.test.ts::exits 2 with no file\n");
    expect(mt(["report", "check", report, "--task", "T4", "--base", "main"], undefined, repo)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("reads a claim's path in backticks as the bare path", () => {
    const report = "Changed: `src/a.ts`\nChanged: `src/a.test.ts`\nAdded test: `src/a.test.ts::parses a`\n";
    expect(check(report)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("names paths from the repo root when run from a subfolder whatever diff.relative says", () => {
    const result = mt(["report", "check", reportFile(MATCHING), "--task", "T4", "--base", "main"], undefined, join(REPO, "src"));
    expect(result).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("keys its finding after the report's own findings under the task", () => {
    const result = check(`T4/F1: a finding\nT4/F2: another\n${MATCHING}Changed: src/b.ts\n`);
    expect(result.stdout).toBe("T4/F3: claimed but untouched: src/b.ts\n");
  });

  test("prints two mismatches in the order their claims stand, keyed F1 and F2, and exits 1", () => {
    const result = check(`Added test: src/d.test.ts::rejects an empty key\n${MATCHING}Changed: src/b.ts\n`);
    expect(result).toEqual({
      code: 1,
      stdout: "T4/F1: named test not found: src/d.test.ts::rejects an empty key\nT4/F2: claimed but untouched: src/b.ts\n",
      stderr: "",
    });
  });

  test("reads the report from stdin when the file is -", () => {
    const report = `${MATCHING}Changed: src/b.ts\n`;
    expect(mt(["report", "check", "-", "--task", "T4", "--base", "main"], report)).toEqual(check(report));
  });

  test("writes nothing to the worktree", () => {
    check(`${MATCHING}Changed: src/b.ts\n`);
    const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: REPO, env: ENV });
    expect(status.stdout.toString()).toBe("");
  });

  test.each([
    ["no --task", ["--base", "main"]],
    ["no --base", ["--task", "T4"]],
    ["an unknown option", ["--task", "T4", "--base", "main", "--branch", "work"]],
    ["a --base without a value", ["--task", "T4", "--base"]],
  ])("prints its usage on stderr and exits 2 with %s", (_, flags) => {
    const result = mt(["report", "check", reportFile(MATCHING), ...flags]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("usage: mt report check <file> --task <id> --base <ref>");
  });

  test("exits 2 with no file", () => {
    expect(mt(["report", "check", "--task", "T4", "--base", "main"]).code).toBe(2);
  });

  test("exits 1 with one line on stderr naming a report it cannot read", () => {
    const missing = join(TMP, "no-such-report.md");
    const result = mt(["report", "check", missing, "--task", "T4", "--base", "main"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr)).toEqual([expect.stringContaining(`cannot read '${missing}'`)]);
  });

  test("exits 1 with one line on stderr naming a base ref git does not know", () => {
    const result = mt(["report", "check", reportFile(MATCHING), "--task", "T4", "--base", "no-such-ref"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr)).toEqual(["mt: report check: git does not know the base ref 'no-such-ref' here"]);
  });

  test("exits 1 with one line on stderr naming a git command that fails", () => {
    const repo = repoOf("corrupt", { "src/keep.ts": "export {};\n" }, { "src/a.ts": "export const a = 1;\n" });
    const tree = gitIn(repo, "rev-parse", "main^{tree}");
    const object = join(repo, ".git", "objects", tree.slice(0, 2), tree.slice(2));
    chmodSync(object, 0o644);
    writeFileSync(object, "not a git object");
    const result = mt(["report", "check", reportFile("Changed: src/a.ts\n"), "--task", "T4", "--base", "main"], undefined, repo);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr)).toEqual([expect.stringContaining("mt: report check: git diff main...HEAD failed: ")]);
  });
});
