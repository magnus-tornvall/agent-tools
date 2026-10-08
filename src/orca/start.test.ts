import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseShape, type Shape } from "../shape/shape.ts";
import { OrcaRefusal, type Orca } from "./orca.ts";
import { start } from "./start.ts";
import { surpriseCheckSpec } from "./surprise-check.ts";

const SHAPE = readFileSync(new URL("../shape/fixtures/example.yaml", import.meta.url), "utf8");

/** S1 is listed first but depends on S2, so S2 is created first. */
const DAG = `
S1: { title: Export the reason, owns: [R2], bears: [D1], after: [S2] }
S2: { title: Store the reason, owns: [R1, R3], bears: [N1, D1, D3] }
`;

const SLICE_MARKER = "Everything below this line is the slice, in YAML.\n";

const UUID = "4e6752bc-cd92-4d4d-b2a3-696f6815f974";

function exampleShape(): Shape {
  const parsed = parseShape(SHAPE);
  if (!parsed.ok) throw new Error("the example shape does not parse");
  return parsed.shape;
}

/** The call's own failure for the nth task-create (from 1), or none. */
type Failure = (taskCreate: number, args: readonly string[]) => Error | undefined;

/** Answers run-create and task-create as Orca does, under `result.run` and `result.task`. */
function fakeOrca(fail: Failure = () => undefined) {
  const calls: string[][] = [];
  let created = 0;
  const orca: Orca = async (args) => {
    calls.push([...args]);
    if (args[0] === "run-create") return { run: { id: "run_1" } };
    if (args[0] !== "task-create") throw new Error(`unexpected orca ${args[0]}`);
    const failure = args.includes("--retry-request") ? undefined : fail(created + 1, args);
    if (failure !== undefined) throw failure;
    created += 1;
    return { task: { id: `task_${created}` } };
  };
  return { orca, calls };
}

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function spec(args: readonly string[]): string {
  const value = args.find((arg) => arg.startsWith("--spec="));
  if (value === undefined) throw new Error("task-create without --spec=");
  return value.slice("--spec=".length);
}

function frontmatter(text: string): unknown {
  const end = text.indexOf("\n---\n", 4);
  return Bun.YAML.parse(text.slice(4, end));
}

describe("start", () => {
  test("creates the Run, the Tasks in dependency order, then the surprise check on all of them", async () => {
    const { orca, calls } = fakeOrca();

    const started = await start(SHAPE, DAG, orca);

    expect(started).toEqual({ run: "run_1", tasks: { S2: "task_1", S1: "task_2" }, surpriseCheck: "task_3" });
    expect(calls.map((args) => [args[0], flag(args, "--task-title"), flag(args, "--deps")])).toEqual([
      ["run-create", undefined, undefined],
      ["task-create", "Store the reason", undefined],
      ["task-create", "Export the reason", '["task_1"]'],
      ["task-create", "Surprise check", '["task_1","task_2"]'],
    ]);
    expect(flag(calls[0] ?? [], "--objective")).toBe(exampleShape().outcome);
    expect(calls.slice(1).map((args) => flag(args, "--run"))).toEqual(["run_1", "run_1", "run_1"]);
  });

  test("gives each Task its slice of the shape in the shape's field names, and nothing else", async () => {
    const { orca, calls } = fakeOrca();

    await start(SHAPE, DAG, orca);

    const s1 = spec(calls[2] ?? []);
    expect(frontmatter(s1)).toEqual({ kind: "implementation", run: "run_1", slice: "S1" });
    expect(s1).toContain("S1/Q1, S1/A1");
    expect(s1).toContain("orca-worker");
    const shape = exampleShape();
    expect(Bun.YAML.parse(s1.slice(s1.indexOf(SLICE_MARKER) + SLICE_MARKER.length))).toEqual({
      outcome: shape.outcome,
      requirements: { R2: shape.requirements.R2 },
      non_goals: {},
      constraints: shape.constraints,
      touchpoints: shape.touchpoints,
      decisions: { D1: { decision: shape.decisions.D1?.decision, rejected: shape.decisions.D1?.rejected } },
    });
  });

  test("carries every non-goal and decision that bears on a Task", async () => {
    const { orca, calls } = fakeOrca();

    await start(SHAPE, DAG, orca);

    const s2 = spec(calls[1] ?? []);
    const slice = Bun.YAML.parse(s2.slice(s2.indexOf(SLICE_MARKER) + SLICE_MARKER.length));
    expect(slice).toMatchObject({
      requirements: { R1: {}, R3: {} },
      non_goals: { N1: exampleShape().non_goals.N1 },
    });
    expect(Object.keys(Object(slice).decisions)).toEqual(["D1", "D3"]);
  });

  test("creates the surprise check from the whole shape and every implementation Task", async () => {
    const { orca, calls } = fakeOrca();

    await start(SHAPE, DAG, orca);

    expect(spec(calls[3] ?? [])).toBe(
      surpriseCheckSpec({ shape: exampleShape(), run: "run_1", checks: ["task_1", "task_2"] }),
    );
  });

  describe("refuses before calling Orca", () => {
    const cases: [string, string, string, string][] = [
      ["a requirement no Task owns", SHAPE, "S1: { title: T, owns: [R1, R2] }", "R3 is owned by no Task"],
      [
        "a requirement two Tasks own",
        SHAPE,
        "S1: { title: T, owns: [R1, R2] }\nS2: { title: U, owns: [R2, R3] }",
        "R2 is owned by S1 and S2",
      ],
      [
        "a requirement the shape does not have",
        SHAPE,
        "S1: { title: T, owns: [R1, R2, R3, R9] }",
        "S1 owns R9, which is not a requirement in the shape",
      ],
      [
        "a non-goal the shape does not have",
        SHAPE,
        "S1: { title: T, owns: [R1, R2, R3], bears: [N9] }",
        "S1 bears N9, which is not a non-goal or decision in the shape",
      ],
      [
        "a decision the shape does not have",
        SHAPE,
        "S1: { title: T, owns: [R1, R2, R3], bears: [D2] }",
        "S1 bears D2, which is not a non-goal or decision in the shape",
      ],
      [
        "a dependency on a Task the DAG does not have",
        SHAPE,
        "S1: { title: T, owns: [R1, R2, R3], after: [S9] }",
        "S1 depends on S9, which is not a Task in the DAG",
      ],
      [
        "a dependency cycle",
        SHAPE,
        "S1: { title: T, owns: [R1], after: [S2] }\nS2: { title: U, owns: [R2], after: [S3] }\nS3: { title: V, owns: [R3], after: [S2] }",
        "S1, S2, S3 cannot be ordered: their dependencies form a cycle",
      ],
      [
        "a Task depending on itself",
        SHAPE,
        "S1: { title: T, owns: [R1, R2, R3], after: [S1] }",
        "S1 cannot be ordered: their dependencies form a cycle",
      ],
      ["an empty DAG", SHAPE, "{}", ": must have at least one Task"],
      ["a DAG key that is not an S ID", SHAPE, "T1: { title: T, owns: [R1, R2, R3] }", "the DAG does not conform"],
      ["a DAG that is not YAML", SHAPE, "S1: [", "the DAG is not YAML"],
      ["a shape that does not conform", "outcome: only", DAG, "the shape does not conform"],
    ];

    for (const [name, shape, dag, problem] of cases) {
      test(name, async () => {
        const { orca, calls } = fakeOrca();

        const refusal = await start(shape, dag, orca).then(
          () => "",
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        );

        expect(refusal).toStartWith("Refused; nothing was created in Orca.\n");
        expect(refusal).toContain(problem);
        expect(calls).toEqual([]);
      });
    }
  });

  test("retries a call whose outcome Orca reports unknown once with its request ID, and carries on", async () => {
    const { orca, calls } = fakeOrca((n) => (n === 2 ? new OrcaRefusal("runtime_timeout", UUID) : undefined));

    const started = await start(SHAPE, DAG, orca);

    expect(started.tasks).toEqual({ S2: "task_1", S1: "task_2" });
    const [failed, retried] = calls.slice(2, 4);
    expect(retried).toEqual([...(failed ?? []), "--retry-request", UUID]);
  });

  test("stops when the outcome is unknown with no request ID, naming what it created", async () => {
    const { orca, calls } = fakeOrca((n) => (n === 2 ? new Error("killed") : undefined));

    const stopped = await start(SHAPE, DAG, orca).catch((error: unknown) => String(error));

    expect(stopped).toContain("Run run_1 has S2 task_1.");
    expect(stopped).toContain("S1: result unknown: killed");
    expect(calls.map((args) => flag(args, "--task-title"))).toEqual([undefined, "Store the reason", "Export the reason"]);
  });

  test("stops when the retry fails too, with the outcome still unknown", async () => {
    const { orca } = fakeOrca((n) => (n === 2 ? new OrcaRefusal("runtime_timeout", UUID) : undefined));
    const failingRetry: Orca = async (args) => {
      if (args.includes("--retry-request")) throw new OrcaRefusal("runtime_timeout again", undefined);
      return orca(args);
    };

    const stopped = await start(SHAPE, DAG, failingRetry).catch((error: unknown) => String(error));

    expect(stopped).toContain(`S1: result unknown: S1: retried with --retry-request ${UUID}: runtime_timeout again`);
  });

  test("stops when Orca refuses a Task, saying it was not created", async () => {
    const { orca } = fakeOrca((n) => (n === 3 ? new OrcaRefusal("invalid_argument: bad deps", undefined) : undefined));

    const stopped = await start(SHAPE, DAG, orca).catch((error: unknown) => String(error));

    expect(stopped).toContain("Run run_1 has S2 task_1, S1 task_2.");
    expect(stopped).toContain("the surprise check: not created: invalid_argument: bad deps");
  });
});
