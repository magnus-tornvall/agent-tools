/**
 * The shape: the contract between whatever produces a shape and Orca. A user opts in by
 * producing one YAML document that conforms to `Shape`; mvc is one producer, not the contract.
 *
 * This schema is the one source of truth. shape.schema.json is generated from it for editors and
 * anything not written in TypeScript (`bun run shape-schema`).
 */
import { z } from "zod";

export function idKey(prefix: string) {
  return z.string().regex(new RegExp(`^${prefix}[1-9][0-9]*$`), `must be ${prefix} followed by a number from 1`);
}

const Observable = z.strictObject({ given: z.string(), when: z.string(), then: z.string() });

const NotObservable = z.strictObject({
  text: z.string(),
  /** Why the requirement cannot be observed. */
  reason: z.string(),
});

const REQUIREMENT_FORMS = "must be either given, when and then, or text and reason";

const Requirement = z.union([Observable, NotObservable], { error: REQUIREMENT_FORMS });

const NonGoal = z.strictObject({
  item: z.string(),
  type: z.enum(["boundary", "deferral"]),
  /** The line that separates a boundary from this change, or why a deferral is not now. */
  reason: z.string(),
});

const Decision = z.strictObject({
  decision: z.string(),
  rejected: z.array(z.string()).min(1, "must name at least one rejected alternative"),
  provenance: z.string(),
  /** `silence` when the decision was an assumption nobody corrected. */
  decided_by: z.enum(["user", "silence"]),
  type: z.enum(["one_way_door", "two_way_door"]),
});

export const Shape = z.strictObject({
  outcome: z.string(),
  requirements: z
    .record(idKey("R"), Requirement)
    .refine((requirements) => Object.keys(requirements).length > 0, "must have at least one requirement")
    .meta({ minProperties: 1 }),
  non_goals: z.record(idKey("N"), NonGoal),
  approach: z.array(z.string()),
  constraints: z.array(z.string()),
  touchpoints: z.array(z.string()),
  decisions: z.record(idKey("D"), Decision),
});

export type Shape = z.infer<typeof Shape>;

/** One way a document fails to be a shape. `path` is dotted, empty for the whole document. */
export type Violation = { readonly path: string; readonly message: string };

export type Parsed =
  | { readonly ok: true; readonly shape: Shape }
  | { readonly ok: false; readonly violations: readonly Violation[] };

export function parseShape(yaml: string): Parsed {
  let document: unknown;
  try {
    document = Bun.YAML.parse(yaml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, violations: [{ path: "", message: `not YAML: ${message}` }] };
  }
  const result = Shape.safeParse(document);
  if (result.success) return { ok: true, shape: result.data };
  const found = result.error.issues.flatMap(violations);
  const unique = found.filter((violation, i) => found.findIndex((other) => other.path === violation.path) === i);
  return { ok: false, violations: unique };
}

export function shapeJsonSchema(): string {
  return `${JSON.stringify(z.toJSONSchema(Shape), null, 2)}\n`;
}

function violations(issue: z.core.$ZodIssue): Violation[] {
  const path = issue.path.map(String);
  // Zod reports a union that one branch nearly matched as that branch's issues; a requirement is
  // reported whole, so a mixed form does not read as an error in one form.
  if (path[0] === "requirements" && path.length >= 2 && issue.code !== "invalid_key") {
    return [{ path: path.slice(0, 2).join("."), message: REQUIREMENT_FORMS }];
  }
  switch (issue.code) {
    case "unrecognized_keys":
      return issue.keys.map((key) => ({ path: [...path, key].join("."), message: "not a key the schema defines" }));
    case "invalid_key":
      return [{ path: path.join("."), message: issue.issues[0]?.message ?? issue.message }];
    default:
      return [{ path: path.join("."), message: issue.message }];
  }
}

if (import.meta.main) {
  await Bun.write(new URL("./shape.schema.json", import.meta.url), shapeJsonSchema());
}
