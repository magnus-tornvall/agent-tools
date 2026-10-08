import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseShape, shapeJsonSchema, type Violation } from "./shape.ts";

const EXAMPLE = readFileSync(new URL("./fixtures/example.yaml", import.meta.url), "utf8");

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: unknown, at: string): Fields {
  if (!isFields(value)) throw new Error(`${at} is not a map`);
  return value;
}

/** A fresh copy of the example as plain data, to change one thing in. */
function example(): Fields {
  return fields(Bun.YAML.parse(EXAMPLE), "the example");
}

function violationsOf(document: unknown): readonly Violation[] {
  const parsed = parseShape(Bun.YAML.stringify(document));
  return parsed.ok ? [] : parsed.violations;
}

function paths(document: unknown): string[] {
  return violationsOf(document).map((violation) => violation.path);
}

describe("parseShape", () => {
  test("accepts the filled-in example", () => {
    expect(parseShape(EXAMPLE)).toMatchObject({ ok: true });
  });

  test("accepts empty non-goals, decisions, approach, constraints and touchpoints", () => {
    const shape = { ...example(), non_goals: {}, decisions: {}, approach: [], constraints: [], touchpoints: [] };

    expect(paths(shape)).toEqual([]);
  });

  test("names each missing top-level field", () => {
    const { outcome: _outcome, touchpoints: _touchpoints, ...rest } = example();

    expect(paths(rest)).toEqual(["outcome", "touchpoints"]);
  });

  test("reports an unknown key at its own path, at every level", () => {
    const shape = example();
    shape.assumptions = {};
    fields(fields(shape.decisions, "decisions").D1, "D1").owner = "someone";
    fields(fields(shape.requirements, "requirements").R1, "R1").and = "more";

    expect(paths(shape).sort()).toEqual(["assumptions", "decisions.D1.owner", "requirements.R1"]);
  });

  test("reports a requirement mixing both forms once, naming both forms", () => {
    const shape = example();
    fields(fields(shape.requirements, "requirements").R1, "R1").text = "also text";

    expect(violationsOf(shape)).toEqual([
      { path: "requirements.R1", message: "must be either given, when and then, or text and reason" },
    ]);
  });

  test("reports a requirement with only part of a form", () => {
    const shape = example();
    fields(shape.requirements, "requirements").R1 = { given: "order 812 is open", when: "it is cancelled" };
    fields(shape.requirements, "requirements").R3 = { text: "no reason given" };

    expect(paths(shape)).toEqual(["requirements.R1", "requirements.R3"]);
  });

  test("reports an ID key that does not match its prefix", () => {
    const shape = example();
    const requirements = fields(shape.requirements, "requirements");
    requirements.R0 = requirements.R1;
    requirements.r4 = requirements.R1;
    fields(shape.non_goals, "non_goals").R1 = fields(shape.non_goals, "non_goals").N1;

    expect(violationsOf(shape)).toEqual([
      { path: "requirements.R0", message: "must be R followed by a number from 1" },
      { path: "requirements.r4", message: "must be R followed by a number from 1" },
      { path: "non_goals.R1", message: "must be N followed by a number from 1" },
    ]);
  });

  test("reports a decision's type or decided_by outside its values", () => {
    const shape = example();
    const decision = fields(fields(shape.decisions, "decisions").D1, "D1");
    decision.type = "one-way";
    decision.decided_by = "owner";

    expect(paths(shape).sort()).toEqual(["decisions.D1.decided_by", "decisions.D1.type"]);
  });

  test("reports a decision with no type", () => {
    const shape = example();
    delete fields(fields(shape.decisions, "decisions").D3, "D3").type;

    expect(paths(shape)).toEqual(["decisions.D3.type"]);
  });

  test("reports a non-goal type outside boundary and deferral", () => {
    const shape = example();
    fields(fields(shape.non_goals, "non_goals").N2, "N2").type = "later";

    expect(paths(shape)).toEqual(["non_goals.N2.type"]);
  });

  test("reports a shape with no requirements", () => {
    expect(violationsOf({ ...example(), requirements: {} })).toEqual([
      { path: "requirements", message: "must have at least one requirement" },
    ]);
  });

  test("reports a decision with no rejected alternative", () => {
    const shape = example();
    fields(fields(shape.decisions, "decisions").D1, "D1").rejected = [];

    expect(violationsOf(shape)).toEqual([
      { path: "decisions.D1.rejected", message: "must name at least one rejected alternative" },
    ]);
  });

  test("reports a file that is not YAML as one violation on the whole document", () => {
    const parsed = parseShape("outcome: [unclosed\n");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0]?.path).toBe("");
  });

  test("reports a document that is not a map", () => {
    expect(paths(["a list"])).toEqual([""]);
  });
});

describe("shape.schema.json", () => {
  test("is the schema generated from the Zod schema; run `bun run shape-schema` when this fails", () => {
    const committed = readFileSync(new URL("./shape.schema.json", import.meta.url), "utf8");

    expect(committed).toBe(shapeJsonSchema());
  });
});

describe("shape-check", () => {
  const script = new URL("./shape-check.ts", import.meta.url).pathname;

  function run(...args: string[]) {
    const result = Bun.spawnSync(["bun", script, ...args]);
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  }

  function file(contents: string): string {
    const path = join(mkdtempSync(join(tmpdir(), "shape-check-")), "shape.yaml");
    writeFileSync(path, contents);
    return path;
  }

  test("exits 0 and prints nothing on a valid shape", () => {
    expect(run(new URL("./fixtures/example.yaml", import.meta.url).pathname)).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  test("prints one path: message line per violation and exits 1", () => {
    const shape = example();
    shape.extra = true;
    fields(fields(shape.non_goals, "non_goals").N1, "N1").type = "later";

    const result = run(file(Bun.YAML.stringify(shape)));

    expect(result.code).toBe(1);
    expect(result.stderr.trimEnd().split("\n").sort()).toEqual([
      "extra: not a key the schema defines",
      expect.stringMatching(/^non_goals\.N1\.type: /),
    ]);
  });

  test("names the whole document when the file is not YAML", () => {
    const result = run(file("outcome: [unclosed\n"));

    expect(result.code).toBe(1);
    expect(result.stderr).toStartWith("(document): not YAML");
  });

  test("prints usage and exits 1 without a file", () => {
    expect(run()).toMatchObject({ code: 1, stderr: "usage: bun src/shape/shape-check.ts <file>\n" });
  });
});
