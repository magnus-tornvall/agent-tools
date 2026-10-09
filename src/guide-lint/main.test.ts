import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAIN = new URL("./main.ts", import.meta.url).pathname;
const MT = new URL("../../cli/mt", import.meta.url).pathname;
const TMP = mkdtempSync(join(tmpdir(), "guide-lint-"));
const FIX = join(TMP, "repo");
const WITH_ORCA = join(TMP, "with-orca");
const NO_ORCA = join(TMP, "no-orca");
const OWNER_LOG = join(TMP, "owner.jsonl");
const STATE = join(TMP, "state");
const DEFAULT_LOG = join(STATE, "mt", "usage.jsonl");

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

interface OrcaCommand {
  command: string;
  flags: string[];
  aliases?: string[][];
}

const WORKER_LIST: OrcaCommand = { command: "orchestration worker-list", flags: ["help", "run", "terminal-state"] };
const RUN_CREATE: OrcaCommand = { command: "orchestration run-create", flags: ["help", "objective"] };
const ASK: OrcaCommand = { command: "orchestration ask", flags: ["help", "options"] };
const SKILLS_GET: OrcaCommand = { command: "skills get", flags: ["help", "topic"], aliases: [["skills", "show"]] };

/** A fake orca on PATH that prints this agent-context for `orca agent-context --json` and fails on anything else. */
function fakeOrca(commands: OrcaCommand[], schemaVersion: unknown = 1): void {
  const context = {
    schemaVersion,
    commands: commands.map(({ command, flags, aliases }) => ({
      command,
      path: command.split(" "),
      aliases: aliases ?? [],
      flags,
    })),
  };
  writeFileSync(join(TMP, "agent-context.json"), `${JSON.stringify(context)}\n`);
  writeFileSync(
    join(WITH_ORCA, "orca"),
    `#!/bin/bash\n[ "$*" = "agent-context --json" ] || exit 2\nwhile IFS= read -r line; do printf '%s\\n' "$line"; done <"${TMP}/agent-context.json"\n`,
  );
  chmodSync(join(WITH_ORCA, "orca"), 0o755);
}

function write(path: string, contents: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
}

function fixture(): void {
  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(join(FIX, "cli"), { recursive: true });
  cpSync(MT, join(FIX, "cli", "mt"));
  write(join(FIX, "guides", "ask.md"), "# ask\n\nSee `mt get door-rule`, then\nthe stance form, `mt get ask --ref stance`.\n");
  write(join(FIX, "guides", "ask", "stance.md"), "# stance\n");
  write(join(FIX, "guides", "door-rule.md"), "# door-rule\n");
  write(join(FIX, "guides", "mvc.md"), "# mvc\n\nCheck it with `mt shape check <file>`, and `mt\nshape slice` it.\n");
  write(
    join(FIX, "skills", "mvc", "SKILL.md"),
    "---\ndescription: Settle a shape.\n---\n\nRun `mt get mvc` and follow what it prints.\n",
  );
  write(
    join(FIX, "guides", "to-orca.md"),
    "# to-orca\n\nA worker runs `mt get <name>` and `mt list`; read `orca skills get orchestration`.\n",
  );
  write(
    join(FIX, "guides", "to-orca", "overlay.md"),
    "# overlay\n\n- `orca orchestration worker-list --terminal-state reclaimable` misses one;\n  `orca orchestration run-create` moves it.\n- Ask with `orca orchestration ask --options`, in the group `orca orchestration`.\n",
  );
}

function lineCount(path: string): number {
  return readFileSync(path, "utf8").split("\n").length - 1;
}

/** Runs guide-lint on the fixture with only `pathDir` on PATH, the owner's log at MT_LOG and at its default path. */
function lint(pathDir: string, { mtLog = true } = {}) {
  const env: Record<string, string> = { PATH: pathDir, HOME: TMP, XDG_STATE_HOME: STATE };
  if (mtLog) env.MT_LOG = OWNER_LOG;
  const result = Bun.spawnSync([process.execPath, MAIN, FIX], { env, stdin: "ignore" });
  return { status: result.exitCode, out: result.stdout.toString() + result.stderr.toString() };
}

beforeEach(() => {
  mkdirSync(WITH_ORCA, { recursive: true });
  mkdirSync(NO_ORCA, { recursive: true });
  mkdirSync(join(STATE, "mt"), { recursive: true });
  writeFileSync(DEFAULT_LOG, "{}\n{}\n{}\n");
  writeFileSync(OWNER_LOG, "{}\n{}\n");
  fakeOrca([WORKER_LIST, RUN_CREATE, ASK, SKILLS_GET]);
  fixture();
});

describe("guide-lint on a clean repo", () => {
  test("exits 0 and counts the mentions it checked and the placeholder it skipped and a wrapped span read whole", () => {
    const { status, out } = lint(WITH_ORCA);
    expect(out).toBe("guide-lint: 6 mt mentions and 5 Orca mentions resolve; placeholder mentions skipped: 1\n");
    expect(status).toBe(0);
  });

  test("does not read a bare word as an Orca mention", () => {
    write(join(FIX, "guides", "door-rule.md"), "# door-rule\n\nA `worker-gonezo --x`, an `update` and `add endpoint`.\n");
    expect(lint(WITH_ORCA).status).toBe(0);
  });

  test("a placeholder tool raises no failure", () => {
    expect(lint(WITH_ORCA).out).not.toContain("<name>");
  });
});

describe("mt mentions", () => {
  test("names the file, line and mention of a deleted reference", () => {
    rmSync(join(FIX, "guides", "ask", "stance.md"));
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/ask.md:4: `mt get ask --ref stance`: mt get finds no such reference\n");
  });

  test("names the stub, line and mention of a renamed guide", () => {
    renameSync(join(FIX, "guides", "mvc.md"), join(FIX, "guides", "mvc-old.md"));
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("skills/mvc/SKILL.md:5: `mt get mvc`: mt get finds no such guide\n");
  });

  test("names the guide, line and mention of a command mt's usage does not list", () => {
    writeFileSync(join(FIX, "guides", "mvc.md"), "# mvc\n\nThen run `mt shape lint`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/mvc.md:3: `mt shape lint`: mt has no command 'mt shape lint' in its usage\n");
  });

  test("still checks the guide of a mention whose ref is a placeholder", () => {
    writeFileSync(join(FIX, "guides", "mvc.md"), "# mvc\n\nSee `mt get gone --ref <ref>`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/mvc.md:3: `mt get gone --ref <ref>`: mt get finds no such guide\n");
  });

  test("fails a --ref=<ref> spelling, as mt rejects it", () => {
    writeFileSync(join(FIX, "guides", "mvc.md"), "# mvc\n\nSee `mt get ask --ref=stance`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/mvc.md:3: `mt get ask --ref=stance`: mt get rejects these arguments\n");
  });

  test("fails an mt get mention with a word beyond the tool and ref, as mt rejects it", () => {
    writeFileSync(join(FIX, "guides", "mvc.md"), "# mvc\n\nSee `mt get ask extra`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/mvc.md:3: `mt get ask extra`: mt get rejects these arguments\n");
  });

  test("runs no mt command but mt get: an mt dogfood mention files nothing", () => {
    writeFileSync(join(FIX, "guides", "mvc.md"), '# mvc\n\nFile it with `mt dogfood "a finding"`.\n');
    const gh = join(TMP, "with-gh");
    const ghCalls = join(TMP, "gh-calls");
    rmSync(ghCalls, { force: true });
    write(join(gh, "gh"), `#!/bin/bash\necho "$*" >>"${ghCalls}"\n`);
    chmodSync(join(gh, "gh"), 0o755);
    expect(lint(gh).status).toBe(0);
    expect(existsSync(ghCalls)).toBe(false);
  });

  test("says once that mt did not run, instead of failing every mention", () => {
    writeFileSync(join(FIX, "cli", "mt"), "process.exit(1);\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe(
      "guide-lint: `mt --help` exited 1 without usage; mt did not run, so no mt mention was checked\n",
    );
  });

  test("reports an mt get that exits other than 1 or 2 with its first line of stderr", () => {
    rmSync(join(FIX, "guides"), { recursive: true });
    rmSync(join(FIX, "skills"), { recursive: true });
    write(join(FIX, "guides", "ask.md"), "# ask\n\nSee `mt get ask`.\n");
    writeFileSync(
      join(FIX, "cli", "mt"),
      'if (process.argv[2] === "--help") console.log("usage: mt get <tool>");\nelse { console.error("boom\\nsecond"); process.exit(3); }\n',
    );
    const { status, out } = lint(NO_ORCA);
    expect(status).toBe(1);
    expect(out).toContain("guides/ask.md:3: `mt get ask`: mt get exited 3: boom\n");
  });

  test("fails when the scan finds no guides", () => {
    rmSync(join(FIX, "guides"), { recursive: true });
    const { status, out } = lint(NO_ORCA);
    expect(status).toBe(1);
    expect(out).toContain(`guide-lint: found no guides under ${FIX}/guides`);
  });
});

describe("Orca mentions", () => {
  test("names the guide, line and flag the installed Orca no longer has", () => {
    fakeOrca([{ ...WORKER_LIST, flags: ["help", "run"] }, RUN_CREATE, ASK, SKILLS_GET]);
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe(
      "guides/to-orca/overlay.md:3: `orca orchestration worker-list --terminal-state reclaimable`: orca orchestration worker-list has no flag --terminal-state\n",
    );
  });

  test("a removed orca orchestration run-create fails at its guide line", () => {
    fakeOrca([WORKER_LIST, ASK, SKILLS_GET]);
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/to-orca/overlay.md:4: `orca orchestration run-create`: orca has no command 'orchestration run-create'\n");
  });

  test("checks --options inside orca orchestration ask --options", () => {
    fakeOrca([WORKER_LIST, RUN_CREATE, { ...ASK, flags: ["help"] }, SKILLS_GET]);
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/to-orca/overlay.md:5: `orca orchestration ask --options`: orca orchestration ask has no flag --options\n");
  });

  test("fails a mention that opens with a flag, telling the author how to write it", () => {
    writeFileSync(join(FIX, "guides", "door-rule.md"), "# door-rule\n\nThen `orca --json agent-context`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe(
      "guides/door-rule.md:3: `orca --json agent-context`: guide-lint cannot check a mention that opens with a flag or holds a short flag; write the command path first, then long flags\n",
    );
  });

  test("fails a command that never existed", () => {
    writeFileSync(join(FIX, "guides", "door-rule.md"), "# door-rule\n\nThen `orca orchestration frob`.\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guides/door-rule.md:3: `orca orchestration frob`: orca has no command 'orchestration frob'\n");
  });
});

describe("without orca on PATH", () => {
  test("runs the mt part, says in one line the Orca part was skipped, and exits 0", () => {
    const { status, out } = lint(NO_ORCA);
    expect(out).toBe("guide-lint: orca is not on PATH; skipped the Orca part\nguide-lint: 6 mt mentions resolve; placeholder mentions skipped: 1\n");
    expect(status).toBe(0);
  });

  test("the exit status reflects the mt part", () => {
    rmSync(join(FIX, "guides", "ask", "stance.md"));
    const { status, out } = lint(NO_ORCA);
    expect(status).toBe(1);
    expect(out).toContain("guides/ask.md:4: `mt get ask --ref stance`");
  });
});

describe("the Orca schema version", () => {
  test("says a version other than 1 is not one it reads", () => {
    fakeOrca([WORKER_LIST, RUN_CREATE, ASK, SKILLS_GET], 2);
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guide-lint: `orca agent-context --json` reports schemaVersion 2; guide-lint reads only schema version 1\n");
  });

  test("reads only the integer 1 as version 1", () => {
    for (const version of [true, "1"]) {
      fakeOrca([WORKER_LIST, RUN_CREATE, ASK, SKILLS_GET], version);
      expect(lint(WITH_ORCA).status).toBe(1);
    }
  });

  test("fails with the parse error when agent-context is not JSON", () => {
    writeFileSync(join(WITH_ORCA, "orca"), "#!/bin/bash\necho not json\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toMatch(/^guide-lint: `orca agent-context --json` did not print JSON: .*JSON.*\n$/);
  });

  test("fails when agent-context is JSON but not an object", () => {
    writeFileSync(join(WITH_ORCA, "orca"), "#!/bin/bash\necho '[]'\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guide-lint: `orca agent-context --json` did not print a JSON object\n");
  });

  test("names the exit status and first stderr line when agent-context fails", () => {
    writeFileSync(join(WITH_ORCA, "orca"), "#!/bin/bash\necho boom >&2\necho later >&2\nexit 3\n");
    const { status, out } = lint(WITH_ORCA);
    expect(status).toBe(1);
    expect(out).toBe("guide-lint: `orca agent-context --json` exited 3: boom\n");
  });
});

describe("the usage log", () => {
  test("keeps its lines at MT_LOG and at its default path", () => {
    expect(lint(WITH_ORCA).status).toBe(0);
    expect(lineCount(OWNER_LOG)).toBe(2);
    expect(lineCount(DEFAULT_LOG)).toBe(3);
  });

  test("keeps the default path's lines when MT_LOG is unset", () => {
    expect(lint(WITH_ORCA, { mtLog: false }).status).toBe(0);
    expect(lineCount(DEFAULT_LOG)).toBe(3);
  });
});
