import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const EXAMPLE = readFileSync(new URL("../../guides/mvc/example.md", import.meta.url).pathname, "utf8");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "mt-config-")));
const HOME = join(TMP, "home");
const CONFIG_HOME = join(TMP, "config");
const CONFIG = join(CONFIG_HOME, "mt", "config.toml");

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

beforeEach(() => {
  rmSync(CONFIG_HOME, { recursive: true, force: true });
  rmSync(HOME, { recursive: true, force: true });
  mkdirSync(HOME);
});

function config(toml: string, file = CONFIG): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, toml);
}

function mt(args: string[], env: Record<string, string | undefined> = {}, stdin?: string) {
  const result = Bun.spawnSync([MT, ...args], {
    env: {
      PATH: process.env.PATH,
      HOME,
      XDG_CONFIG_HOME: CONFIG_HOME,
      MT_LOG: join(TMP, "usage.jsonl"),
      XDG_STATE_HOME: join(TMP, "state"),
      ...env,
    },
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
  });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

const COMPLETE = 'agents = ["claude"]\nfix_rounds = 1\n';

describe("mt config", () => {
  test("R2: prints the file's path, then each key with binding or advisory and its value, and exits 0", () => {
    config(COMPLETE);
    const { code, stdout, stderr } = mt(["config"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        CONFIG,
        'agents             binding   ["claude"]',
        "fix_rounds         binding   1",
        "",
      ].join("\n"),
    );
  });

  test("R3: a missing binding key reads missing on its line, and mt config exits 1", () => {
    config('agents = ["claude"]\n');
    const { code, stdout } = mt(["config"]);
    expect(code).toBe(1);
    expect(stdout.split("\n")).toContain("fix_rounds         binding   missing");
    expect(stdout.split("\n")).toContain('agents             binding   ["claude"]');
  });

  test("R3: with no config file every key is missing, and mt config still prints the path and exits 1", () => {
    const { code, stdout, stderr } = mt(["config"]);
    expect(stderr).toBe("");
    expect(code).toBe(1);
    expect(stdout).toBe([CONFIG, "agents             binding   missing", "fix_rounds         binding   missing", ""].join("\n"));
  });

  test("a triage_confidence left in the file is a key mt does not know, and mt config exits 1", () => {
    config(`${COMPLETE}triage_confidence = 0.7\n`);
    const { code, stdout, stderr } = mt(["config"]);
    expect(stderr).toBe("");
    expect(code).toBe(1);
    expect(stdout).toBe(
      [
        CONFIG,
        'agents             binding   ["claude"]',
        "fix_rounds         binding   1",
        "triage_confidence  unknown   mt has no such key",
        "",
      ].join("\n"),
    );
  });

  test("agents and fix_rounds read alone print their values and exit 0 with a triage_confidence left in the file", () => {
    config(`${COMPLETE}triage_confidence = 0.7\n`);
    expect(mt(["config", "agents"])).toEqual({ code: 0, stdout: "claude\n", stderr: "" });
    expect(mt(["config", "fix_rounds"])).toEqual({ code: 0, stdout: "1\n", stderr: "" });
  });

  test("R4: mt config fix_rounds names fix_rounds and why \"two\" is invalid, and exits 1", () => {
    config('agents = ["claude"]\nfix_rounds = "two"\n');
    const { code, stdout, stderr } = mt(["config", "fix_rounds"]);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe(`mt: config: fix_rounds is invalid in ${CONFIG}: must be an integer of 0 or more, not "two"\n`);
    expect(mt(["config"]).stdout).toContain('fix_rounds         binding   invalid: must be an integer of 0 or more, not "two"\n');
  });

  test("R4: each key refuses what it must not be", () => {
    for (const [toml, key, why] of [
      ["fix_rounds = -1", "fix_rounds", "must be an integer of 0 or more, not -1"],
      ["fix_rounds = 1.5", "fix_rounds", "must be an integer of 0 or more, not 1.5"],
      ["fix_rounds = 9007199254740993", "fix_rounds", "must be an integer of 0 or more, not a number beyond ±9007199254740991, which mt cannot read exactly"],
      ["agents = []", "agents", "must be a non-empty list of agent names, not []"],
      ['agents = "claude"', "agents", 'must be a non-empty list of agent names, not "claude"'],
      ['agents = ["claude", ""]', "agents", 'must be a non-empty list of agent names, not ["claude",""]'],
    ] as const) {
      config(`${toml}\n`);
      const { code, stderr } = mt(["config", key]);
      expect(code).toBe(1);
      expect(stderr).toBe(`mt: config: ${key} is invalid in ${CONFIG}: ${why}\n`);
    }
  });

  test("R4: a missing key read alone is named, and exits 1", () => {
    config('agents = ["claude"]\n');
    const { code, stdout, stderr } = mt(["config", "fix_rounds"]);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe(`mt: config: fix_rounds is missing from ${CONFIG}\n`);
  });

  test("R5: mt config fix_rounds prints 2 alone and exits 0", () => {
    config("fix_rounds = 2\n");
    const { code, stdout, stderr } = mt(["config", "fix_rounds"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toBe("2\n");
  });

  test("R5: a key read alone ignores the others, even a missing binding key or an unknown key", () => {
    config('agents = ["claude", "codex"]\ncolour = "red"\n');
    expect(mt(["config", "agents"])).toEqual({ code: 0, stdout: "claude\ncodex\n", stderr: "" });
  });

  test("R6: mt config colour exits 2 naming colour as an unknown key, whatever the config", () => {
    for (const toml of [null, COMPLETE, 'colour = "red"\n', "not = = toml\n"]) {
      rmSync(CONFIG_HOME, { recursive: true, force: true });
      if (toml !== null) config(toml);
      const { code, stdout, stderr } = mt(["config", "colour"]);
      expect(code).toBe(2);
      expect(stdout).toBe("");
      expect(stderr).toStartWith("mt: unknown config key 'colour'; the keys are agents, fix_rounds\nusage: mt config");
    }
  });

  test("R7: a key mt does not know is named on its own line, and mt config exits 1", () => {
    config(`${COMPLETE}colour = "red"\n`);
    const { code, stdout } = mt(["config"]);
    expect(code).toBe(1);
    expect(stdout.split("\n").at(-2)).toBe("colour             unknown   mt has no such key");
    expect(stdout).toContain("fix_rounds         binding   1\n");
  });

  test("a file that is not TOML makes every key invalid, saying why, and mt config exits 1", () => {
    config("fix_rounds = \n");
    const { code, stdout } = mt(["config"]);
    expect(code).toBe(1);
    const lines = stdout.split("\n");
    expect(lines[0]).toBe(CONFIG);
    for (const line of lines.slice(1, 3)) expect(line).toMatch(/ invalid: the file is not TOML: \S/);
    const single = mt(["config", "fix_rounds"]);
    expect(single.code).toBe(1);
    expect(single.stderr).toStartWith(`mt: config: fix_rounds is invalid in ${CONFIG}: the file is not TOML: `);
  });

  test("a config path that cannot be read is invalid, not missing", () => {
    mkdirSync(CONFIG, { recursive: true });
    const { code, stdout } = mt(["config"]);
    expect(code).toBe(1);
    expect(stdout).toContain("fix_rounds         binding   invalid: the file cannot be read: ");
  });

  test("the file is under XDG_CONFIG_HOME, or ~/.config when it is unset or empty", () => {
    config("fix_rounds = 3\n", join(HOME, ".config", "mt", "config.toml"));
    for (const xdg of [undefined, ""]) {
      const { code, stdout } = mt(["config", "fix_rounds"], { XDG_CONFIG_HOME: xdg });
      expect(code).toBe(0);
      expect(stdout).toBe("3\n");
      expect(mt(["config"], { XDG_CONFIG_HOME: xdg }).stdout.split("\n")[0]).toBe(join(HOME, ".config", "mt", "config.toml"));
    }
  });

  test("mt config only reads the file", () => {
    config(`${COMPLETE}colour = "red"\n`);
    mt(["config"]);
    mt(["config", "fix_rounds"]);
    expect(readFileSync(CONFIG, "utf8")).toBe(`${COMPLETE}colour = "red"\n`);
  });

  test("a second word after the key is a usage error", () => {
    const { code, stderr } = mt(["config", "fix_rounds", "3"]);
    expect(code).toBe(2);
    expect(stderr).toBe("mt: unexpected argument '3'\nusage: mt config [<key>]\n");
  });

  test("R8: with no config file mt shape check on a valid shape exits 0 and prints nothing about config", () => {
    const shape = join(TMP, "shape.yaml");
    writeFileSync(shape, EXAMPLE);
    const { code, stdout, stderr } = mt(["shape", "check", shape]);
    expect(code).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  test("D1: commands that read no key run as before over an invalid config", () => {
    config("fix_rounds = \n");
    expect(mt(["list"]).code).toBe(0);
    expect(mt(["shape", "check", "-"], {}, EXAMPLE)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("R13: the usage lists mt config and the config file's path", () => {
    const { code, stdout } = mt(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^ +mt config \[<key>\] /m);
    expect(stdout).toContain("${XDG_CONFIG_HOME:-$HOME/.config}/mt/config.toml");
  });
});
