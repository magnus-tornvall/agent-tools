/**
 * orca-start's script: turns a shape and the DAG the owner approved into an Orca Run, run from the
 * owner's terminal, which `run-create` binds to the Run as its coordinator.
 *
 *   bun src/orca/start.ts <shape.yaml> <dag.yaml>
 *
 * `bun src/orca/start.ts help` prints the usage and the DAG's format.
 *
 * The DAG maps each Task's S ID to its title, the requirement IDs it owns, the non-goal and
 * decision IDs that bear on it, and the S IDs it depends on:
 *
 *   S1: { title: Store the reason, owns: [R1, R3], bears: [N1, D1] }
 *   S2: { title: Export the reason, owns: [R2], bears: [D1], after: [S1] }
 *
 * It validates both before any Orca call and refuses unless every requirement is owned by exactly
 * one Task, every ID the DAG names exists, and the dependencies form no cycle. Then it creates the
 * Run with the shape's outcome as objective, each Task in dependency order with its slice of the
 * shape as spec, and the surprise check depending on every Task, and prints their IDs as JSON.
 *
 * A failed call stops it, reporting what it created. When Orca does not know whether the call took
 * effect and reports a request ID, it is retried once with `--retry-request` first. It never
 * resumes a half-created Run: the owner cancels it.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { idKey, parseShape, type Shape } from "../shape/shape.ts";
import { orcaCli, OrcaRefusal, type Orca } from "./orca.ts";
import { surpriseCheckSpec } from "./surprise-check.ts";
import { taskSpec } from "./task-spec.ts";

/** Names the script as run, not by its source path, so it reads right from the bundled copy. */
export function help(): string {
  return [
    "usage: bun <this script> <shape.yaml> <dag.yaml>",
    "",
    "Creates a Run from the shape and the DAG the owner approved: each Task, then the surprise check",
    "depending on every Task. Prints their IDs as JSON. The terminal that runs it becomes the Run's",
    "coordinator.",
    "",
    "The DAG maps each Task's S ID to its title, the requirement IDs it owns, the non-goal and",
    "decision IDs that bear on it, and the S IDs it comes after:",
    "",
    "  S1: { title: Store the reason, owns: [R1, R3], bears: [N1, D1] }",
    "  S2: { title: Export the reason, owns: [R2], bears: [D1], after: [S1] }",
    "",
    "It refuses before any Orca call unless every requirement is owned by exactly one Task, every ID",
    "the DAG names exists, and the dependencies form no cycle.",
    "",
    "  help",
    "    Prints this.",
  ].join("\n");
}

const SURPRISE_CHECK_TITLE = "Surprise check";

const DagTask = z.strictObject({
  title: z.string().min(1),
  owns: z.array(idKey("R")),
  bears: z.array(z.string().regex(/^[ND][1-9][0-9]*$/, "must be an N or D ID")).default([]),
  after: z.array(idKey("S")).default([]),
});

const Dag = z
  .record(idKey("S"), DagTask)
  .refine((dag) => Object.keys(dag).length > 0, "must have at least one Task");

type Dag = z.infer<typeof Dag>;
type DagTask = z.infer<typeof DagTask>;

export type Started = {
  readonly run: string;
  /** Each implementation Task's ID by its S ID. */
  readonly tasks: Readonly<Record<string, string>>;
  readonly surpriseCheck: string;
};

export async function start(shapeYaml: string, dagYaml: string, orca: Orca): Promise<Started> {
  const { shape, dag, order } = validate(shapeYaml, dagYaml);

  const run = createdId(await create(orca, "the Run", ["run-create", "--objective", shape.outcome]), "run");
  const tasks: Record<string, string> = {};
  const stopped = (step: string, error: unknown) => new Error(partial(run, tasks, step, error));

  for (const [slice, task] of order) {
    const spec = taskSpec({ shape, run, slice, title: task.title, owns: task.owns, bears: task.bears });
    const deps = task.after.map((parent) => createdBefore(tasks, parent));
    const result = await create(orca, slice, taskCreate(run, spec, task.title, deps)).catch((error: unknown) => {
      throw stopped(slice, error);
    });
    tasks[slice] = createdId(result, "task");
  }

  const checks = Object.values(tasks);
  const spec = surpriseCheckSpec({ shape, run, checks });
  const check = await create(orca, "the surprise check", taskCreate(run, spec, SURPRISE_CHECK_TITLE, checks)).catch(
    (error: unknown) => {
      throw stopped("the surprise check", error);
    },
  );
  return { run, tasks, surpriseCheck: createdId(check, "task") };
}

// ── Validation ───────────────────────────────────────────────────────────────

function validate(shapeYaml: string, dagYaml: string): { shape: Shape; dag: Dag; order: [string, DagTask][] } {
  const parsed = parseShape(shapeYaml);
  if (!parsed.ok) {
    refuse(["the shape does not conform", ...parsed.violations.map((v) => `  ${v.path}: ${v.message}`)]);
  }
  const dag = parseDag(dagYaml);
  const { shape } = parsed;
  const { order, cyclic } = dependencyOrder(dag);
  const problems = [
    ...ownership(shape, dag),
    ...unknownIds(shape, dag),
    ...(cyclic.length > 0 ? [`${cyclic.join(", ")} cannot be ordered: their dependencies form a cycle`] : []),
  ];
  if (problems.length > 0) refuse(problems);
  return { shape, dag, order };
}

function parseDag(yaml: string): Dag {
  let document: unknown;
  try {
    document = Bun.YAML.parse(yaml);
  } catch (error) {
    refuse([`the DAG is not YAML: ${error instanceof Error ? error.message : String(error)}`]);
  }
  const result = Dag.safeParse(document);
  if (!result.success) {
    refuse([
      "the DAG does not conform",
      ...result.error.issues.map((issue) => `  ${issue.path.map(String).join(".")}: ${issue.message}`),
    ]);
  }
  return result.data;
}

function ownership(shape: Shape, dag: Dag): string[] {
  return Object.keys(shape.requirements).flatMap((requirement) => {
    const owners = Object.entries(dag)
      .filter(([, task]) => task.owns.includes(requirement))
      .map(([slice]) => slice);
    if (owners.length === 0) return [`${requirement} is owned by no Task`];
    if (owners.length > 1) return [`${requirement} is owned by ${owners.join(" and ")}`];
    return [];
  });
}

function unknownIds(shape: Shape, dag: Dag): string[] {
  return Object.entries(dag).flatMap(([slice, task]) => [
    ...task.owns
      .filter((id) => !(id in shape.requirements))
      .map((id) => `${slice} owns ${id}, which is not a requirement in the shape`),
    ...task.bears
      .filter((id) => !(id in shape.non_goals) && !(id in shape.decisions))
      .map((id) => `${slice} bears ${id}, which is not a non-goal or decision in the shape`),
    ...task.after
      .filter((id) => !(id in dag))
      .map((id) => `${slice} depends on ${id}, which is not a Task in the DAG`),
  ]);
}

/** The DAG's Tasks with each after the Tasks it depends on, and the Tasks left over by a cycle. */
function dependencyOrder(dag: Dag): { order: [string, DagTask][]; cyclic: string[] } {
  const order: [string, DagTask][] = [];
  const waiting = Object.entries(dag);
  const ready = ([, task]: [string, DagTask]) =>
    task.after.every((parent) => order.some(([slice]) => slice === parent) || !(parent in dag));
  for (let next = waiting.find(ready); next !== undefined; next = waiting.find(ready)) {
    order.push(next);
    waiting.splice(waiting.indexOf(next), 1);
  }
  return { order, cyclic: waiting.map(([slice]) => slice) };
}

function refuse(problems: readonly string[]): never {
  throw new Error(["Refused; nothing was created in Orca.", ...problems].join("\n"));
}

// ── Orca ─────────────────────────────────────────────────────────────────────

function taskCreate(run: string, spec: string, title: string, deps: readonly string[]): string[] {
  const args = ["task-create", `--spec=${spec}`, "--task-title", title, "--run", run];
  return deps.length > 0 ? [...args, "--deps", JSON.stringify(deps)] : args;
}

/** One create call, retried once with `--retry-request` when Orca reports its outcome unknown. */
async function create(orca: Orca, what: string, args: readonly string[]): Promise<unknown> {
  try {
    return await orca(args);
  } catch (error) {
    if (!(error instanceof OrcaRefusal) || error.requestId === undefined) throw error;
    const retry = [...args, "--retry-request", error.requestId];
    return orca(retry).catch((retryError: unknown) => {
      throw new Error(`${what}: retried with --retry-request ${error.requestId}: ${message(retryError)}`, {
        cause: retryError,
      });
    });
  }
}

const Created = z.object({ id: z.string() });

/** The ID under `result.run` or `result.task`, as run-create and task-create return it. */
function createdId(result: unknown, kind: "run" | "task"): string {
  const fields = z.record(z.string(), z.unknown()).safeParse(result);
  const created = Created.safeParse(fields.success ? fields.data[kind] : undefined);
  if (!created.success) throw new Error(`Orca returned a ${kind}-create result with no ${kind} ID`);
  return created.data.id;
}

/** Dependency order creates every parent first. */
function createdBefore(tasks: Readonly<Record<string, string>>, parent: string): string {
  const id = tasks[parent];
  if (id === undefined) throw new Error(`${parent} was not created before the Tasks that depend on it`);
  return id;
}

/** A refusal Orca states means nothing was created; anything else leaves the outcome unknown. */
function partial(run: string, tasks: Readonly<Record<string, string>>, step: string, error: unknown): string {
  const created = Object.entries(tasks).map(([slice, id]) => `${slice} ${id}`);
  const outcome =
    error instanceof OrcaRefusal ? `${step}: not created: ${message(error)}` : `${step}: result unknown: ${message(error)}`;
  return [
    `Stopped. Run ${run} has ${created.length > 0 ? created.join(", ") : "no Tasks"}.`,
    outcome,
    `Cancel Run ${run} and start again; the script does not resume.`,
  ].join("\n");
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  const [shapeFile, dagFile, ...rest] = process.argv.slice(2);
  if (shapeFile === "help" && dagFile === undefined) {
    console.log(help());
  } else if (shapeFile === undefined || dagFile === undefined || rest.length > 0) {
    console.error(help());
    process.exitCode = 1;
  } else {
    start(readFileSync(shapeFile, "utf8"), readFileSync(dagFile, "utf8"), orcaCli(process.cwd())).then(
      (started) => console.log(JSON.stringify(started, null, 2)),
      (error: unknown) => {
        console.error(message(error));
        process.exitCode = 1;
      },
    );
  }
}
