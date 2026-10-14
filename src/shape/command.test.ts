import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const EXAMPLE_FILE = new URL("./example.yaml", import.meta.url).pathname;
const EXAMPLE = readFileSync(EXAMPLE_FILE, "utf8");
const TMP = mkdtempSync(join(tmpdir(), "mt-shape-"));

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: unknown, at: string): Fields {
  if (!isFields(value)) throw new Error(`${at} is not a map`);
  return value;
}

function example(): Fields {
  return fields(Bun.YAML.parse(EXAMPLE), "the example");
}

function decision(shape: Fields, id: string): Fields {
  return fields(fields(shape.decisions, "decisions")[id], id);
}

let files = 0;
function file(contents: string): string {
  const path = join(TMP, `shape-${++files}.yaml`);
  writeFileSync(path, contents);
  return path;
}

function mt(...args: string[]) {
  const result = Bun.spawnSync([MT, ...args], { env: { ...process.env, MT_LOG: join(TMP, "usage.jsonl") } });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function mtWith(stdin: string, ...args: string[]) {
  const result = Bun.spawnSync([MT, ...args], { env: { ...process.env, MT_LOG: join(TMP, "usage.jsonl") }, stdin: Buffer.from(stdin) });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function check(shape: unknown) {
  return mt("shape", "check", file(Bun.YAML.stringify(shape, null, 2)));
}

function stderrLines(stderr: string): string[] {
  return stderr.trimEnd().split("\n");
}

describe("mt shape check", () => {
  test("prints nothing and exits 0 on a shape that follows the schema", () => {
    expect(mt("shape", "check", EXAMPLE_FILE)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("prints one path: message line per broken rule", () => {
    const shape = example();
    shape.risks = [];
    shape.requirements = {};
    decision(shape, "D3").rejected = [];
    delete fields(fields(shape.non_goals, "non_goals").N1, "N1").type;

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr).sort()).toEqual([
      "decisions.D3.rejected: must name at least one rejected alternative",
      expect.stringMatching(/^non_goals\.N1\.type: /),
      "requirements: must have at least one requirement",
      "risks: not a key the schema defines",
    ]);
  });

  test("names the whole document when the file is not YAML", () => {
    const result = mt("shape", "check", file("outcome: [unclosed\n"));

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual([expect.stringMatching(/^\(document\): not YAML/)]);
  });

  test("names a file it cannot read and exits 1", () => {
    const result = mt("shape", "check", join(TMP, "missing.yaml"));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("missing.yaml");
  });

  test("exits 2 with usage without exactly one file", () => {
    expect(mt("shape", "check")).toMatchObject({ code: 2, stdout: "" });
    expect(mt("shape", "check", EXAMPLE_FILE, EXAMPLE_FILE)).toMatchObject({ code: 2, stdout: "" });
  });

  test("exits 2 with usage on an option it does not know", () => {
    expect(mt("shape", "check", "--drafts", EXAMPLE_FILE)).toMatchObject({ code: 2, stdout: "" });
  });

  test("reads a shape from stdin given -, printing nothing and exiting 0", () => {
    expect(mtWith(EXAMPLE, "shape", "check", "-")).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("reads a shape with a violation from stdin given -, one path: message line each", () => {
    const shape = example();
    shape.requirements = {};
    decision(shape, "D3").rejected = [];

    const result = mtWith(Bun.YAML.stringify(shape, null, 2), "shape", "check", "-");

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr).sort()).toEqual([
      "decisions.D3.rejected: must name at least one rejected alternative",
      "requirements: must have at least one requirement",
    ]);
  });

  test("fails a shape whose purpose is empty, on one line at purpose", () => {
    const result = check({ ...example(), purpose: "" });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["purpose: must not be empty"]);
  });

  test("fails a shape whose purpose is not a string, on one line at purpose", () => {
    const result = check({ ...example(), purpose: ["why"] });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual([expect.stringMatching(/^purpose: /)]);
  });

  test("R2: names touchpoints, draft and decided_by as keys the schema does not define", () => {
    const shape = example();
    shape.touchpoints = ["reports/OrderExport.php"];
    shape.draft = { budget: 3, rounds_spent: 0, open: [] };
    decision(shape, "D1").decided_by = "owner";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr).sort()).toEqual([
      "decisions.D1.decided_by: not a key the schema defines",
      "draft: not a key the schema defines",
      "touchpoints: not a key the schema defines",
    ]);
  });

  test("R3: --draft is an unknown argument, and the usage no longer lists it", () => {
    const result = mt("shape", "check", "--draft", EXAMPLE_FILE);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown option '--draft'");
    expect(mt("--help").stdout).not.toContain("--draft");
  });

  test("R4: prints nothing and exits 0 when one requirement's given names another's key", () => {
    const shape = example();
    fields(fields(shape.requirements, "requirements").R2, "R2").given = "R1 passed and order 812 was cancelled";

    expect(check(shape)).toEqual({ code: 0, stdout: "", stderr: "" });
  });
});

describe("mt shape slice", () => {
  test("prints only the keys asked for, values unchanged", () => {
    const result = mt("shape", "slice", EXAMPLE_FILE, "--keys", "outcome,non_goals");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toEndWith("\n");
    const { outcome, non_goals } = example();
    expect(Bun.YAML.parse(result.stdout)).toEqual({ outcome, non_goals });
  });

  test("refuses a key the schema does not define and prints nothing on stdout", () => {
    const result = mt("shape", "slice", EXAMPLE_FILE, "--keys", "outcome,risks");

    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("risks");
  });

  test("slices a shape that breaks the schema, since an owner may rule on a violation", () => {
    const shape = example();
    decision(shape, "D3").decided_by = "user";
    const path = file(Bun.YAML.stringify(shape, null, 2));
    expect(mt("shape", "check", path).code).toBe(1);

    const result = mt("shape", "slice", path, "--keys", "outcome,decisions");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(Bun.YAML.parse(result.stdout)).toEqual({ outcome: shape.outcome, decisions: shape.decisions });
  });

  test("refuses a file that is not YAML, with its violation", () => {
    const result = mt("shape", "slice", file("outcome: [unclosed\n"), "--keys", "outcome");

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toStartWith("(document): not YAML");
  });

  test("refuses a file whose top level is not a map", () => {
    const result = mt("shape", "slice", file("- outcome\n- requirements\n"), "--keys", "outcome");

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toStartWith("(document): ");
  });

  test("leaves out a key the file does not have", () => {
    const result = mt("shape", "slice", file("outcome: x\n"), "--keys", "outcome,constraints");

    expect(result.code).toBe(0);
    expect(Bun.YAML.parse(result.stdout)).toEqual({ outcome: "x" });
  });

  test("reads the shape from stdin given -", () => {
    const result = mtWith(EXAMPLE, "shape", "slice", "-", "--keys", "outcome,non_goals");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const { outcome, non_goals } = example();
    expect(Bun.YAML.parse(result.stdout)).toEqual({ outcome, non_goals });
  });

  test("exits 2 with usage without --keys or a file", () => {
    expect(mt("shape", "slice", EXAMPLE_FILE)).toMatchObject({ code: 2, stdout: "" });
    expect(mt("shape", "slice", "--keys", "outcome")).toMatchObject({ code: 2, stdout: "" });
    expect(mt("shape", "slice", EXAMPLE_FILE, "--keys")).toMatchObject({ code: 2, stdout: "" });
  });
});

describe("mt shape", () => {
  test("exits 2 with usage on an unknown subcommand", () => {
    expect(mt("shape", "render")).toMatchObject({ code: 2, stdout: "" });
    expect(mt("shape")).toMatchObject({ code: 2, stdout: "" });
  });
});

describe("mt shape check on a shape from before oracles left it", () => {
  test("R5: fails, naming oracles and unchecked", () => {
    const oracles = {
      O1: {
        covers: ["outcome", "R1", "R2", "N1", "C1"],
        base: "fail",
        run: "php artisan test tests/Feature/CancelReasonTest.php",
        files: { "tests/Feature/CancelReasonTest.php": "14c2529eb4498c5d1ffd6915d05bf58a91bdda796af59f41d480d11c099d0479" },
      },
    };

    const result = check({ ...example(), oracles, unchecked: { R3: "No caller can observe where the reason is stored." } });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["oracles: not a key the schema defines", "unchecked: not a key the schema defines"]);
  });
});

describe("mvc's example", () => {
  test("mt get mvc --ref example prints a shape that passes mt shape check", () => {
    const printed = mt("get", "mvc", "--ref", "example");
    expect(printed.code).toBe(0);

    expect(mt("shape", "check", file(printed.stdout))).toEqual({ code: 0, stdout: "", stderr: "" });
  });
});
