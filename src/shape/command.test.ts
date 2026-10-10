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

function mtWith(stdin: string, ...args: string[]) {
  const result = Bun.spawnSync([MT, ...args], { env: { ...process.env, MT_LOG: join(TMP, "usage.jsonl") }, stdin: Buffer.from(stdin) });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/** The example made a draft: one open question, no requirements yet. */
function draft(): Fields {
  const { requirements: _requirements, ...rest } = example();
  return { ...rest, draft: { commit: "21d46e6", budget: 3, rounds_spent: 1, open: [{ question: "Is a closed export emailed?", stance: "No; it is downloaded." }] } };
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

  test("rejects a one_way decision decided by silence", () => {
    const shape = example();
    const d3 = decision(shape, "D3");
    d3.door = "one_way";
    d3.who_pays = "Every client of the API.";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D3.decided_by: must be owner when door is one_way"]);
  });

  test("rejects a one_way decision with no who_pays", () => {
    const shape = example();
    delete decision(shape, "D1").who_pays;

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.who_pays: required when door is one_way"]);
  });

  test("rejects a decision by the owner with no question", () => {
    const shape = example();
    delete decision(shape, "D1").question;

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.question: required when decided_by is owner"]);
  });

  test("rejects a decision by silence that carries a question", () => {
    const shape = example();
    const d1 = decision(shape, "D1");
    d1.door = "two_way";
    delete d1.who_pays;
    d1.decided_by = "silence";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.question: not allowed when decided_by is silence"]);
  });

  test("rejects a two_way decision with a who_pays", () => {
    const shape = example();
    const d1 = decision(shape, "D1");
    d1.door = "two_way";

    const result = check(shape);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D1.who_pays: not allowed when door is two_way"]);
  });

  test("rejects a touchpoint that is neither path nor path:symbol", () => {
    const result = check({ ...example(), touchpoints: ["reports/OrderExport.php", "the export"] });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["touchpoints.1: must be a path relative to the repo root, or path:symbol"]);
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

  test("fails a shape with a top-level draft key, naming the key", () => {
    const result = check({ ...example(), draft: { budget: 3, rounds_spent: 0, open: [] } });

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["draft: a draft is not a shape; check it with --draft"]);
  });

  test("fails a draft on its draft key alongside what it still lacks", () => {
    const result = check(draft());

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr).sort()).toEqual(["draft: a draft is not a shape; check it with --draft", expect.stringMatching(/^requirements: /)]);
  });
});

describe("mt shape check --draft", () => {
  test("prints nothing and exits 0 on a draft with an open question and no requirements", () => {
    expect(mt("shape", "check", "--draft", file(Bun.YAML.stringify(draft(), null, 2)))).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("takes --draft after the file, and the draft from stdin", () => {
    expect(mtWith(Bun.YAML.stringify(draft(), null, 2), "shape", "check", "-", "--draft")).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("fails a draft whose rounds_spent is not a number, at draft.rounds_spent", () => {
    const document = draft();
    fields(document.draft, "draft").rounds_spent = "one";

    const result = mt("shape", "check", "--draft", file(Bun.YAML.stringify(document, null, 2)));

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(stderrLines(result.stderr)).toEqual([expect.stringMatching(/^draft\.rounds_spent: /)]);
  });

  test("checks every shape field the draft has", () => {
    const document = draft();
    decision(document, "D3").rejected = [];

    const result = mt("shape", "check", "--draft", file(Bun.YAML.stringify(document, null, 2)));

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual(["decisions.D3.rejected: must name at least one rejected alternative"]);
  });

  test("fails a closed shape, which has no draft block", () => {
    const result = mt("shape", "check", "--draft", EXAMPLE_FILE);

    expect(result.code).toBe(1);
    expect(stderrLines(result.stderr)).toEqual([expect.stringMatching(/^draft: /)]);
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

  test("slices a draft's draft block", () => {
    const document = draft();

    const result = mtWith(Bun.YAML.stringify(document, null, 2), "shape", "slice", "-", "--keys", "draft");

    expect(result.code).toBe(0);
    expect(Bun.YAML.parse(result.stdout)).toEqual({ draft: document.draft });
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
  test("mt get mvc --ref example prints a shape that passes mt shape check", () => {
    const printed = mt("get", "mvc", "--ref", "example");
    expect(printed.code).toBe(0);

    expect(mt("shape", "check", file(printed.stdout))).toEqual({ code: 0, stdout: "", stderr: "" });
  });
});
