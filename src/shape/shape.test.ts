import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isTouchpoint, parseShape, type Violation } from "./shape.ts";

const EXAMPLE = readFileSync(new URL("../../guides/mvc/example.md", import.meta.url), "utf8");

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

function decision(shape: Fields, id: string): Fields {
  return fields(fields(shape.decisions, "decisions")[id], id);
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
    decision(shape, "D1").owner = "someone";
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

  test("reports a decision's door or decided_by outside its values", () => {
    const shape = example();
    const d3 = decision(shape, "D3");
    d3.door = "one-way";
    d3.decided_by = "user";

    expect(paths(shape).sort()).toEqual(["decisions.D3.decided_by", "decisions.D3.door"]);
  });

  test("reports a decision with no door", () => {
    const shape = example();
    delete decision(shape, "D3").door;

    expect(paths(shape)).toEqual(["decisions.D3.door"]);
  });

  test("reports the old type key on a decision as unknown", () => {
    const shape = example();
    decision(shape, "D3").type = "two_way_door";

    expect(violationsOf(shape)).toEqual([{ path: "decisions.D3.type", message: "not a key the schema defines" }]);
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
    decision(shape, "D1").rejected = [];

    expect(violationsOf(shape)).toEqual([
      { path: "decisions.D1.rejected", message: "must name at least one rejected alternative" },
    ]);
  });

  test.each(["", "   ", "\t"])("reports a who_pays of %p as empty, not as missing", (empty: string) => {
    const shape = example();
    decision(shape, "D1").who_pays = empty;

    expect(violationsOf(shape)).toEqual([{ path: "decisions.D1.who_pays", message: "must not be empty" }]);
  });

  test.each(["", "  "])("reports a question of %p as empty, not as missing", (empty: string) => {
    const shape = example();
    decision(shape, "D1").question = empty;

    expect(violationsOf(shape)).toEqual([{ path: "decisions.D1.question", message: "must not be empty" }]);
  });

  test.each(["", "  "])("reports an outcome of %p as empty", (empty: string) => {
    expect(violationsOf({ ...example(), outcome: empty })).toEqual([{ path: "outcome", message: "must not be empty" }]);
  });

  test("reports each empty string in a decision, a non-goal and the lists at its own path", () => {
    const shape = example();
    const d1 = decision(shape, "D1");
    d1.decision = " ";
    d1.provenance = "";
    d1.rejected = ["a real alternative", ""];
    const n1 = fields(fields(shape.non_goals, "non_goals").N1, "N1");
    n1.item = "";
    n1.reason = " ";
    shape.approach = ["", "a step"];
    shape.constraints = ["a limit", " "];

    expect(paths(shape).sort()).toEqual([
      "approach.0",
      "constraints.1",
      "decisions.D1.decision",
      "decisions.D1.provenance",
      "decisions.D1.rejected.1",
      "non_goals.N1.item",
      "non_goals.N1.reason",
    ]);
  });

  test("reports each empty field of a requirement at its own path, whichever form it has", () => {
    const shape = example();
    const requirements = fields(shape.requirements, "requirements");
    requirements.R1 = { given: "", when: "it is cancelled", then: " " };
    requirements.R3 = { text: "", reason: "no way to observe it" };

    expect(violationsOf(shape)).toEqual([
      { path: "requirements.R1.given", message: "must not be empty" },
      { path: "requirements.R1.then", message: "must not be empty" },
      { path: "requirements.R3.text", message: "must not be empty" },
    ]);
  });

  test("reports a file that is not YAML as one violation on the whole document", () => {
    const parsed = parseShape("outcome: [unclosed\n");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0]?.path).toBe("");
  });

  test("lets an error that is not a YAML parse error propagate", () => {
    const parse = spyOn(Bun.YAML, "parse").mockImplementation(() => {
      throw new TypeError("Bun.YAML.parse is not a function");
    });
    try {
      expect(() => parseShape("outcome: x\n")).toThrow(TypeError);
    } finally {
      parse.mockRestore();
    }
  });

  test.each([
    ["requirements", "R1"],
    ["non_goals", "N1"],
    ["decisions", "D1"],
  ])("reports a repeated %s key as a violation on that key", (section: string, id: string) => {
    const entry = new RegExp(`^  ${id}:.*(?:\\n    .*)*\\n`, "m").exec(EXAMPLE.slice(EXAMPLE.indexOf(`\n${section}:`) + 1));
    if (entry === null) throw new Error(`no ${id} entry in the example`);
    const repeated = EXAMPLE.replace(entry[0], entry[0] + entry[0]);

    const parsed = parseShape(repeated);

    expect(parsed).toEqual({ ok: false, violations: [{ path: `${section}.${id}`, message: "key appears more than once" }] });
  });

  test("reports a repeated quoted key once however often it repeats", () => {
    const yaml = EXAMPLE.replace("requirements:\n", 'requirements:\n  "R1": {text: a, reason: b}\n  \'R1\': {text: a, reason: b}\n  R1: {text: a, reason: b}\n');

    const parsed = parseShape(yaml);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.violations.filter((violation) => violation.path === "requirements.R1")).toHaveLength(1);
  });

  test("reports a repeated top-level key as a violation on that key", () => {
    const yaml = `${EXAMPLE}\noutcome: a second outcome\n`;

    expect(parseShape(yaml)).toEqual({ ok: false, violations: [{ path: "outcome", message: "key appears more than once" }] });
  });

  test("reports a repeated top-level map key, which would drop the first map's entries", () => {
    const yaml = `${EXAMPLE}\nrequirements:\n  R9: {text: a, reason: b}\n`;

    expect(parseShape(yaml)).toEqual({ ok: false, violations: [{ path: "requirements", message: "key appears more than once" }] });
  });

  test("reports a document that is not a map", () => {
    expect(paths(["a list"])).toEqual([""]);
  });
});

describe("isTouchpoint", () => {
  test.each([
    "cli/mt",
    "README.md",
    ".gitignore",
    "guides/mvc/",
    "app/Models/Order.php:cancel",
    "src/order.ts:Order.cancel",
    "src/Order.php:Order::cancel",
  ])("accepts %p", (touchpoint: string) => {
    expect(isTouchpoint(touchpoint)).toBe(true);
  });

  test.each([
    "",
    "the export",
    "/etc/hosts",
    "../other/file.ts",
    "./cli/mt",
    "guides//mvc.md",
    "app/Order.php:",
    "app/Order.php:the cancel method",
    ":cancel",
  ])("rejects %p", (touchpoint: string) => {
    expect(isTouchpoint(touchpoint)).toBe(false);
  });
});
