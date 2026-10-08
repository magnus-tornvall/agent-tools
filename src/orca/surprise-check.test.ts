import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseShape, type Shape } from "../shape/shape.ts";
import { surpriseCheckSpec } from "./surprise-check.ts";

const SHAPE_MARKER = "Everything below this line is the item's shape, in YAML.\n";

function exampleShape(): Shape {
  const parsed = parseShape(readFileSync(new URL("../shape/fixtures/example.yaml", import.meta.url), "utf8"));
  if (!parsed.ok) throw new Error("the example shape does not parse");
  return parsed.shape;
}

describe("surpriseCheckSpec", () => {
  test("carries a snapshot of the shape that parses back to the same shape", () => {
    const shape = exampleShape();

    const spec = surpriseCheckSpec({ shape, run: "run_c2dd1ed388a4", checks: ["task_018b55e34b8b"] });

    const at = spec.indexOf(SHAPE_MARKER);
    expect(at).toBeGreaterThan(-1);
    expect(parseShape(spec.slice(at + SHAPE_MARKER.length))).toEqual({ ok: true, shape });
  });
});
