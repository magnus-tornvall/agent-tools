import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const EXAMPLE_FILE = new URL("../../guides/mvc/example.md", import.meta.url).pathname;
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

function check(shape: unknown) {
  return mt("shape", "check", file(Bun.YAML.stringify(shape, null, 2)));
}

function stderrLines(stderr: string): string[] {
  return stderr.trimEnd().split("\n");
}

describe("mt shape check", () => {
  test("R2: prints nothing and exits 0 on a shape that follows the schema", () => {
    expect(mt("shape", "check", EXAMPLE_FILE)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("R3: rejects a one_way decision decided by silence", () => {
    const shape = example();
    const d3 = decision(shape, "D3");
    d3.door = "one_way";
    d3.who_pays = "Every client of the API.";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D3.decided_by: must be owner when door is one_way"]);
  });

  test("R4: rejects a one_way decision with no who_pays", () => {
    const shape = example();
    delete decision(shape, "D1").who_pays;

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.who_pays: required when door is one_way"]);
  });

  test("R5: rejects a decision by the owner with no question", () => {
    const shape = example();
    delete decision(shape, "D1").question;

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.question: required when decided_by is owner"]);
  });

  test("R5: rejects a decision by silence that carries a question", () => {
    const shape = example();
    const d1 = decision(shape, "D1");
    d1.door = "two_way";
    delete d1.who_pays;
    d1.decided_by = "silence";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.question: not allowed when decided_by is silence"]);
  });

  test("R6: rejects a two_way decision with a who_pays", () => {
    const shape = example();
    const d1 = decision(shape, "D1");
    d1.door = "two_way";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.who_pays: not allowed when door is two_way"]);
  });

  test("R7: rejects a touchpoint that is neither path nor path:symbol", () => {
    const result = check({ ...example(), touchpoints: ["reports/OrderExport.php", "the export"] });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["touchpoints.1: must be a path relative to the repo root, or path:symbol"]);
  });

  test("R8: prints one path: message line per broken rule of the old schema", () => {
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

  test("R8: names the whole document when the file is not YAML", () => {
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
});

describe("mt shape slice", () => {
  test("R9: prints only the keys asked for, values unchanged", () => {
    const result = mt("shape", "slice", EXAMPLE_FILE, "--keys", "outcome,non_goals");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toEndWith("\n");
    const { outcome, non_goals } = example();
    expect(Bun.YAML.parse(result.stdout)).toEqual({ outcome, non_goals });
  });

  test("R10: refuses a key the schema does not define and prints nothing on stdout", () => {
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

describe("mvc's example", () => {
  test("R11: mt get mvc --ref example prints a shape that passes mt shape check", () => {
    const printed = mt("get", "mvc", "--ref", "example");
    expect(printed.code).toBe(0);

    expect(mt("shape", "check", file(printed.stdout))).toEqual({ code: 0, stdout: "", stderr: "" });
  });
});
