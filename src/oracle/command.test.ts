import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const TMP = mkdtempSync(join(tmpdir(), "mt-oracle-"));

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

let repos = 0;

/** A fresh git repo holding these files. */
function repo(files: Record<string, string>): string {
  const root = join(TMP, `repo${++repos}`);
  mkdirSync(root);
  Bun.spawnSync(["git", "init", "-q"], { cwd: root });
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

type Spec = { covers?: string[]; base?: "fail" | "pass"; run: string; junit?: string; files: Record<string, string> };

/** A shape holding only these oracles, each file pinned at the contents given. */
function shape(oracles: Record<string, Spec>): string {
  const block = Object.fromEntries(
    Object.entries(oracles).map(([id, { covers = ["R1"], base = "fail", run, junit, files }]) => [
      id,
      { covers, base, run, ...(junit === undefined ? {} : { junit }), files: Object.fromEntries(Object.entries(files).map(([path, contents]) => [path, sha256(contents)])) },
    ]),
  );
  return Bun.YAML.stringify({ outcome: "x", oracles: block }, null, 2);
}

function mt(cwd: string, args: string[], stdin?: string) {
  const result = Bun.spawnSync([MT, ...args], { cwd, stdin: stdin === undefined ? "ignore" : Buffer.from(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/** Runs the oracles in `files` plus the shape written from `oracles`. */
function runIn(files: Record<string, string>, oracles: Record<string, Spec>, ...flags: string[]) {
  const root = repo({ ...files, "shape.yaml": shape(oracles) });
  return mt(root, ["oracle", "run", ...flags, "shape.yaml"]);
}

/** Whether no process has the pid, waiting a moment for a killed one to be reaped. */
function exits(pid: number): boolean {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (Bun.spawnSync(["kill", "-0", String(pid)], { stderr: "ignore" }).exitCode !== 0) return true;
    Bun.sleepSync(20);
  }
  return false;
}

function lines(text: string): string[] {
  return text.trimEnd().split("\n");
}

const EXIT = (code: number) => `#!/bin/sh\nexit ${code}\n`;

describe("mt oracle run", () => {
  test("prints one line per oracle and exits 0 when every oracle passes", () => {
    const files = { "o1.sh": EXIT(0), "o2.sh": EXIT(0) };
    const result = runIn(files, {
      O1: { covers: ["outcome", "R1"], run: "sh o1.sh", files: { "o1.sh": files["o1.sh"] } },
      O2: { covers: ["C1"], run: "sh o2.sh", files: { "o2.sh": files["o2.sh"] } },
    });

    expect(result.code).toBe(0);
    expect(lines(result.stdout)).toEqual(["O1: pass (covers outcome, R1)", "O2: pass (covers C1)"]);
  });

  test.each([
    [1, "O1: fail (covers R1)"],
    [77, "O1: blocked (covers R1)"],
    [99, "O1: broken - exit 99 (covers R1)"],
    [126, "O1: broken - exit 126: the command did not start (covers R1)"],
    [127, "O1: broken - exit 127: the command did not start (covers R1)"],
    [139, "O1: broken - exit 139: killed by a signal (covers R1)"],
  ])("reads exit %p as automake does, and exits 1", (code: number, line: string) => {
    const files = { "o1.sh": EXIT(code) };
    const result = runIn(files, { O1: { run: "sh o1.sh", files } });

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual([line]);
  });

  test("runs every oracle even after one fails", () => {
    const files = { "o1.sh": EXIT(1), "o2.sh": EXIT(0) };
    const result = runIn(files, {
      O1: { run: "sh o1.sh", files: { "o1.sh": files["o1.sh"] } },
      O2: { run: "sh o2.sh", files: { "o2.sh": files["o2.sh"] } },
    });

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: fail (covers R1)", "O2: pass (covers R1)"]);
  });

  test("calls a changed pinned file tampered and does not run that oracle", () => {
    const pinned = "#!/bin/sh\ntouch ran\nexit 1\n";
    const root = repo({ "o1.sh": "#!/bin/sh\ntouch ran\nexit 0\n", "shape.yaml": shape({ O1: { run: "sh o1.sh", files: { "o1.sh": pinned } } }) });

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: tampered - o1.sh changed since it was pinned (covers R1)"]);
    expect(existsSync(join(root, "ran"))).toBe(false);
  });

  test("calls a crash that sh reports as an exit code broken, so it never passes for an expected failure", () => {
    const files = { "o1.sh": "#!/bin/sh\nsh -c 'kill -SEGV $$'\n" };
    const result = runIn(files, { O1: { base: "fail", run: "sh o1.sh", files } }, "--base");

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: broken, expected fail - exit 139: killed by a signal (covers R1)"]);
  });

  test("calls a pinned path that is a folder tampered, and still runs the next oracle", () => {
    const files = { "tests/o1.sh": EXIT(0), "o2.sh": EXIT(0) };
    const root = repo({ ...files, "shape.yaml": shape({ O1: { run: "true", files: { tests: "" } }, O2: { run: "sh o2.sh", files: { "o2.sh": files["o2.sh"] } } }) });

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: tampered - tests is not a file (covers R1)", "O2: pass (covers R1)"]);
  });

  test("calls a missing pinned file tampered", () => {
    const result = runIn({}, { O1: { run: "true", files: { "gone.sh": EXIT(0) } } });

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: tampered - gone.sh is missing (covers R1)"]);
  });

  test("sends the oracle's own output to stderr, so stdout holds only verdicts", () => {
    const files = { "o1.sh": "#!/bin/sh\necho noise\necho more >&2\nexit 0\n" };
    const result = runIn(files, { O1: { run: "sh o1.sh", files } });

    expect(result.stdout).toBe("O1: pass (covers R1)\n");
    expect(result.stderr).toContain("noise");
    expect(result.stderr).toContain("more");
  });

  test("runs the command from the repo root, and reads pinned files there, whichever folder mt runs in", () => {
    const files = { "tests/o1.sh": "#!/bin/sh\ntest -f tests/o1.sh\n" };
    const root = repo({ ...files, "docs/shape.yaml": shape({ O1: { run: "sh tests/o1.sh", files } }) });

    expect(mt(join(root, "docs"), ["oracle", "run", "shape.yaml"])).toMatchObject({ code: 0, stdout: "O1: pass (covers R1)\n" });
  });

  test("refuses to run outside a git repo", () => {
    const root = join(TMP, "not-a-repo");
    mkdirSync(root);
    writeFileSync(join(root, "shape.yaml"), shape({ O1: { run: "true", files: { "o1.sh": "" } } }));

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(result).toMatchObject({ code: 1, stdout: "" });
    expect(result.stderr).toContain("mt: oracles run inside a git repo");
  });

  test("reads the shape from stdin given -", () => {
    const files = { "o1.sh": EXIT(0) };
    const root = repo(files);

    const result = mt(root, ["oracle", "run", "-"], shape({ O1: { run: "sh o1.sh", files } }));

    expect(result).toMatchObject({ code: 0, stdout: "O1: pass (covers R1)\n" });
  });

  test("refuses a shape with no oracles, with its violation, and runs nothing", () => {
    const root = repo({ "shape.yaml": "outcome: x\n" });

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(lines(result.stderr)).toEqual([expect.stringMatching(/^oracles: /)]);
  });

  test("runs the oracles of a shape whose other keys break the schema, even a repeated one", () => {
    const files = { "o1.sh": EXIT(0) };
    const yaml = `requirements:\n  R1: {text: a, reason: b}\n  R1: {text: a, reason: b}\napproach: [old]\n${shape({ O1: { run: "sh o1.sh", files } })}`;
    const root = repo({ ...files, "shape.yaml": yaml });

    expect(mt(root, ["oracle", "run", "shape.yaml"])).toMatchObject({ code: 0, stdout: "O1: pass (covers R1)\n" });
  });

  test("calls an oracle still running after --timeout broken, and runs the next", () => {
    const files = { "slow.sh": "#!/bin/sh\nexec sleep 5\n", "o2.sh": EXIT(0) };
    const result = runIn(
      files,
      { O1: { run: "sh slow.sh", files: { "slow.sh": files["slow.sh"] } }, O2: { run: "sh o2.sh", files: { "o2.sh": files["o2.sh"] } } },
      "--timeout",
      "1",
    );

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: broken - still running after 1s (covers R1)", "O2: pass (covers R1)"]);
  });

  test.each([
    ["it times out", "sleep 30 & echo $! > pid\nwait\n", ["--timeout", "1"], "O1: broken - still running after 1s (covers R1)"],
    ["it exits", "sleep 30 & echo $! > pid\n", [], "O1: pass (covers R1)"],
  ])("ends what an oracle started when %s", (_when: string, script: string, flags: string[], line: string) => {
    const files = { "o1.sh": `#!/bin/sh\n${script}` };
    const root = repo({ ...files, "shape.yaml": shape({ O1: { run: "sh o1.sh", files } }) });

    const result = mt(root, ["oracle", "run", ...flags, "shape.yaml"]);
    const pid = Number(readFileSync(join(root, "pid"), "utf8"));

    try {
      expect(lines(result.stdout)).toEqual([line]);
      expect(exits(pid)).toBe(true);
    } finally {
      if (!exits(pid)) process.kill(pid, "SIGKILL");
    }
  });

  test("refuses a malformed oracle at its path, whatever the rest of the shape holds", () => {
    const root = repo({ "shape.yaml": "outcome: x\napproach: [old]\noracles:\n  O1:\n    covers: [R1]\n    base: fail\n    run: 'true'\n    files: {}\n" });

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(result.code).toBe(1);
    expect(lines(result.stderr)).toEqual(["oracles.O1.files: must pin at least one file"]);
  });
});

describe("mt oracle run --base", () => {
  test("exits 0 when new behaviour fails and preserved behaviour passes", () => {
    const files = { "new.sh": EXIT(1), "kept.sh": EXIT(0) };
    const result = runIn(
      files,
      {
        O1: { base: "fail", run: "sh new.sh", files: { "new.sh": files["new.sh"] } },
        O2: { covers: ["C1"], base: "pass", run: "sh kept.sh", files: { "kept.sh": files["kept.sh"] } },
      },
      "--base",
    );

    expect(result.code).toBe(0);
    expect(lines(result.stdout)).toEqual(["O1: fail, as expected (covers R1)", "O2: pass, as expected (covers C1)"]);
  });

  test("exits 1 on an oracle for new behaviour that already passes", () => {
    const files = { "o1.sh": EXIT(0) };
    const result = runIn(files, { O1: { base: "fail", run: "sh o1.sh", files } }, "--base");

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: pass, expected fail (covers R1)"]);
  });

  test("exits 1 on an oracle that fails for the wrong reason", () => {
    const files = { "o1.sh": EXIT(99) };
    const result = runIn(files, { O1: { base: "fail", run: "sh o1.sh", files } }, "--base");

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual(["O1: broken, expected fail - exit 99 (covers R1)"]);
  });
});

/** A script that writes this JUnit body to report.xml, then exits with `code`. */
function junitScript(body: string, code = 0): string {
  return `#!/bin/sh\ncat > report.xml <<'XML'\n<testsuites><testsuite name="s">${body}</testsuite></testsuites>\nXML\nexit ${code}\n`;
}

describe("mt oracle run with a JUnit report", () => {
  test.each([
    ['<testcase name="a"/><testcase name="b"/>', 0, "O1: pass (covers R1)"],
    ['<testcase name="a"/><testcase name="b"><failure message="expected duplicate"/></testcase>', 1, "O1: fail (covers R1)"],
    ['<testcase name="a"><error message="Class not found"/></testcase>', 1, "O1: broken - a test case errored rather than failed (covers R1)"],
    ['<testcase name="a"><skipped/></testcase>', 0, "O1: blocked (covers R1)"],
    ["", 0, "O1: broken - the report has no test case (covers R1)"],
    ['<testcase name="a"/>', 1, "O1: broken - a passing report, but exit 1 (covers R1)"],
    ['<testcase name="a"><system-out><![CDATA[log: <failure/> <error/>]]></system-out></testcase>', 0, "O1: pass (covers R1)"],
    ['<!-- <testcase name="old"/> -->', 0, "O1: broken - the report has no test case (covers R1)"],
    ['<testcase name="a"><failure/></testcase>', 139, "O1: broken - exit 139: killed by a signal (covers R1)"],
    ['<testcase name="a"><failure/></testcase>', 127, "O1: broken - exit 127: the command did not start (covers R1)"],
  ])("reads the report %p with exit %p", (body: string, code: number, line: string) => {
    const files = { "o1.sh": junitScript(body, code) };
    const result = runIn(files, { O1: { run: "sh o1.sh", junit: "report.xml", files } });

    expect(lines(result.stdout)).toEqual([line]);
  });

  test.each([
    ['<testsuite><testcase name="a"/>', "O1: broken - the report is incomplete (covers R1)"],
    ["<testsuite><testcase", "O1: broken - the report is incomplete (covers R1)"],
    ['<testsuite name="s"/>', "O1: broken - the report has no test case (covers R1)"],
  ])("reads the report %p as written", (report: string, line: string) => {
    const files = { "o1.sh": `#!/bin/sh\nprintf '%s' '${report}' > report.xml\n` };
    const result = runIn(files, { O1: { run: "sh o1.sh", junit: "report.xml", files } });

    expect(lines(result.stdout)).toEqual([line]);
  });

  test("tells an assertion failure from an error at base", () => {
    const files = { "fails.sh": junitScript('<testcase name="a"><failure/></testcase>', 1), "errors.sh": junitScript('<testcase name="a"><error/></testcase>', 1) };
    const result = runIn(
      files,
      {
        O1: { base: "fail", run: "sh fails.sh", junit: "report.xml", files: { "fails.sh": files["fails.sh"] } },
        O2: { base: "fail", run: "sh errors.sh", junit: "report.xml", files: { "errors.sh": files["errors.sh"] } },
      },
      "--base",
    );

    expect(result.code).toBe(1);
    expect(lines(result.stdout)).toEqual([
      "O1: fail, as expected (covers R1)",
      "O2: broken, expected fail - a test case errored rather than failed (covers R1)",
    ]);
  });

  test("calls an oracle whose report path is a folder broken, and leaves the folder", () => {
    const files = { "report.xml/keep": "x", "o1.sh": EXIT(0) };
    const root = repo({ ...files, "shape.yaml": shape({ O1: { run: "sh o1.sh", junit: "report.xml", files: { "o1.sh": files["o1.sh"] } } }) });

    const result = mt(root, ["oracle", "run", "shape.yaml"]);

    expect(lines(result.stdout)).toEqual(["O1: broken - report.xml is not a file (covers R1)"]);
    expect(existsSync(join(root, "report.xml/keep"))).toBe(true);
  });

  test("never reads a report left by an earlier run", () => {
    const files = { "report.xml": '<testsuite><testcase name="a"/></testsuite>', "o1.sh": EXIT(0) };
    const result = runIn(files, { O1: { run: "sh o1.sh", junit: "report.xml", files: { "o1.sh": files["o1.sh"] } } });

    expect(lines(result.stdout)).toEqual(["O1: broken - no report at report.xml (covers R1)"]);
  });
});

describe("mt oracle hash", () => {
  test("prints one file: sha256 line per file", () => {
    const root = repo({ "a.sh": "one", "tests/b.php": "two" });

    const result = mt(root, ["oracle", "hash", "a.sh", "tests/b.php"]);

    expect(result).toEqual({ code: 0, stdout: `a.sh: ${sha256("one")}\ntests/b.php: ${sha256("two")}\n`, stderr: "" });
  });

  test("prints each path relative to the repo root, whichever folder mt runs in", () => {
    const root = repo({ "tests/b.php": "two", "a.sh": "one" });

    const result = mt(join(root, "tests"), ["oracle", "hash", "b.php", "../a.sh", join(root, "tests/b.php")]);

    expect(result).toEqual({ code: 0, stdout: `tests/b.php: ${sha256("two")}\na.sh: ${sha256("one")}\ntests/b.php: ${sha256("two")}\n`, stderr: "" });
  });

  test.each([["outside the repo", "../outside.sh"], ["whose path holds whitespace", "a b.sh"]])("refuses a file %s, which the shape cannot pin", (_why: string, file: string) => {
    const root = repo({ "a b.sh": "one" });
    writeFileSync(join(root, "..", "outside.sh"), "out");

    const result = mt(root, ["oracle", "hash", file]);

    expect(result).toMatchObject({ code: 1, stdout: "" });
    expect(result.stderr).toContain(`mt: cannot pin '${file}'`);
  });

  test("names a file it cannot read, hashes the rest and exits 1", () => {
    const root = repo({ "a.sh": "one" });

    const result = mt(root, ["oracle", "hash", "missing.sh", "a.sh"]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe(`a.sh: ${sha256("one")}\n`);
    expect(result.stderr).toContain("missing.sh");
  });
});

describe("mt oracle", () => {
  test("exits 2 with usage on a malformed call", () => {
    const root = repo({});
    for (const args of [["oracle"], ["oracle", "pin"], ["oracle", "hash"], ["oracle", "run"], ["oracle", "run", "--green", "s.yaml"], ["oracle", "run", "a", "b"], ["oracle", "run", "--timeout", "0", "s.yaml"], ["oracle", "run", "s.yaml", "--timeout"]]) {
      expect(mt(root, args)).toMatchObject({ code: 2, stdout: "" });
    }
  });
});
