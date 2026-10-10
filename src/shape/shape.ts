/**
 * The shape: the contract between whatever produces a shape and Orca. A user opts in by
 * producing one YAML document that conforms to `Shape`; mvc is one producer, not the contract.
 *
 * A draft is an unfinished shape: the same document with a top-level `draft` block. It is never
 * a shape; `Draft` checks it with every shape field optional.
 *
 * This schema is the one source of truth; `mt shape check` and `mt shape slice` both use it.
 */
import { z } from "zod";

function idKey(prefix: string) {
  return z.string().regex(new RegExp(`^${prefix}[1-9][0-9]*$`), `must be ${prefix} followed by a number from 1`);
}

const EMPTY = "must not be empty";

const hasContent = (value: string) => value.trim() !== "";

const Text = z.string().refine(hasContent, EMPTY);

const Observable = z.strictObject({ given: z.string(), when: z.string(), then: z.string() });

const NotObservable = z.strictObject({
  text: z.string(),
  /** Why the requirement cannot be observed. */
  reason: z.string(),
});

const REQUIREMENT_FORMS = "must be either given, when and then, or text and reason";

// The form is checked on plain strings so a wrong form is reported once, whole; the content of
// each field is checked after, so an empty one is reported at its own path.
const Requirement = z.union([Observable, NotObservable], { error: REQUIREMENT_FORMS }).superRefine((requirement, context) => {
  for (const [field, value] of Object.entries(requirement)) {
    if (!hasContent(value)) context.addIssue({ code: "custom", path: [field], message: EMPTY });
  }
});

const NonGoal = z.strictObject({
  item: Text,
  type: z.enum(["boundary", "deferral"]),
  /** The line that separates a boundary from this change, or why a deferral is not now. */
  reason: Text,
});

const Decision = z
  .strictObject({
    decision: Text,
    rejected: z.array(Text).min(1, "must name at least one rejected alternative"),
    /** Evidence for the decision, never a bare question or assumption ID. */
    provenance: Text,
    door: z.enum(["one_way", "two_way"]),
    /** Who pays if a one-way door turns out wrong. */
    who_pays: Text.optional(),
    /** `silence` when the decision was an assumption nobody corrected. */
    decided_by: z.enum(["owner", "silence"]),
    /** The question the owner answered, as it was asked. */
    question: Text.optional(),
  })
  .superRefine((decision, context) => {
    if (decision.door === "one_way" && decision.who_pays === undefined) {
      context.addIssue({ code: "custom", path: ["who_pays"], message: "required when door is one_way" });
    }
    if (decision.door === "two_way" && decision.who_pays !== undefined) {
      context.addIssue({ code: "custom", path: ["who_pays"], message: "not allowed when door is two_way" });
    }
    if (decision.door === "one_way" && decision.decided_by !== "owner") {
      context.addIssue({ code: "custom", path: ["decided_by"], message: "must be owner when door is one_way" });
    }
    if (decision.decided_by === "owner" && decision.question === undefined) {
      context.addIssue({ code: "custom", path: ["question"], message: "required when decided_by is owner" });
    }
    if (decision.decided_by === "silence" && decision.question !== undefined) {
      context.addIssue({ code: "custom", path: ["question"], message: "not allowed when decided_by is silence" });
    }
  });

/**
 * A path relative to the repo root, or `path:symbol`. A directory may end in `/`. The path is not
 * checked for existence.
 */
export function isTouchpoint(touchpoint: string): boolean {
  const colon = touchpoint.indexOf(":");
  const path = colon === -1 ? touchpoint : touchpoint.slice(0, colon);
  const symbol = colon === -1 ? undefined : touchpoint.slice(colon + 1);
  if (symbol !== undefined && !/^\S+$/.test(symbol)) return false;
  if (/\s/.test(path) || path.startsWith("/")) return false;
  const segments = (path.endsWith("/") ? path.slice(0, -1) : path).split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

const Touchpoint = z.string().refine(isTouchpoint, "must be a path relative to the repo root, or path:symbol");

const Requirements = z.record(idKey("R"), Requirement);

export const Shape = z.strictObject({
  outcome: Text,
  requirements: Requirements.refine((requirements) => Object.keys(requirements).length > 0, "must have at least one requirement"),
  non_goals: z.record(idKey("N"), NonGoal),
  approach: z.array(Text),
  constraints: z.array(Text),
  touchpoints: z.array(Touchpoint),
  decisions: z.record(idKey("D"), Decision),
});

export type Shape = z.infer<typeof Shape>;

const Count = z.number().int().nonnegative();

const OpenQuestion = z.strictObject({
  /** The question as it was asked. */
  question: Text,
  /** The position put to the owner with it. */
  stance: Text,
});

const DraftBlock = z.strictObject({
  /** HEAD of the repo when the draft was written; without it, every cited file is read again. */
  commit: Text.optional(),
  budget: Count,
  rounds_spent: Count,
  open: z.array(OpenQuestion),
});

export const Draft = Shape.extend({ requirements: Requirements }).partial().extend({ draft: DraftBlock });

export type Draft = z.infer<typeof Draft>;

export const SHAPE_KEYS: readonly string[] = Draft.keyof().options;

/** One way a document fails to be a shape. `path` is dotted, empty for the whole document. */
export type Violation = { readonly path: string; readonly message: string };

export type Parsed<T = Shape> =
  | { readonly ok: true; readonly shape: T }
  | { readonly ok: false; readonly violations: readonly Violation[] };

/** The document as a map, or the one violation that says why it is not. Only a YAML parse error is one. */
export type Mapping =
  | { readonly ok: true; readonly document: Record<string, unknown> }
  | { readonly ok: false; readonly violation: Violation };

export function parseDocument(yaml: string): Mapping {
  let document: unknown;
  try {
    document = Bun.YAML.parse(yaml);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, violation: { path: "", message: `not YAML: ${error.message}` } };
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return { ok: false, violation: { path: "", message: "must be a map" } };
  }
  return { ok: true, document: Object.fromEntries(Object.entries(document)) };
}

const ID_MAPS = ["requirements", "non_goals", "decisions"];
const MAP_KEY = /^( *)(?:"([^"]*)"|'([^']*)'|([^\s#:][^#:]*?))\s*:(?:\s|$)/;
const SEQUENCE_ITEM = /^ *-(?:\s|$)/;

/**
 * Bun.YAML.parse keeps the last of a repeated key, so a repeat is found in the text: a top-level
 * key, or a key of the requirements, non_goals or decisions map, written as a block map, that
 * appears more than once under one map.
 */
function repeatedKeys(yaml: string): Violation[] {
  const found: Violation[] = [];
  let section: string | undefined;
  let indent: number | undefined;
  let seen = new Set<string>();
  const topLevel = new Set<string>();
  for (const line of yaml.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const match = SEQUENCE_ITEM.test(line) ? null : MAP_KEY.exec(line);
    const key = match?.[2] ?? match?.[3] ?? match?.[4];
    if (!line.startsWith(" ")) {
      if (key !== undefined) {
        if (topLevel.has(key)) found.push({ path: key, message: "key appears more than once" });
        topLevel.add(key);
      }
      section = key !== undefined && ID_MAPS.includes(key) ? key : undefined;
      indent = undefined;
      seen = new Set();
      continue;
    }
    if (section === undefined || match === null || key === undefined) continue;
    const depth = (match[1] ?? "").length;
    indent ??= depth;
    if (depth !== indent) continue;
    if (seen.has(key)) found.push({ path: `${section}.${key}`, message: "key appears more than once" });
    seen.add(key);
  }
  return found.filter((violation, i) => found.findIndex((other) => other.path === violation.path) === i);
}

const NOT_A_SHAPE = "a draft is not a shape; check it with --draft";

/** A shape. A document with a `draft` block fails on that key, whatever else it holds. */
export function parseShape(yaml: string): Parsed {
  const parsed = parseDocument(yaml);
  if (!parsed.ok) return { ok: false, violations: [parsed.violation] };
  const { draft, ...document } = parsed.document;
  const result = checked(Shape, document, repeatedKeys(yaml));
  if (draft === undefined) return result;
  return { ok: false, violations: [{ path: "draft", message: NOT_A_SHAPE }, ...(result.ok ? [] : result.violations)] };
}

/** A draft: its `draft` block, and whatever shape fields it has so far. */
export function parseDraft(yaml: string): Parsed<Draft> {
  const parsed = parseDocument(yaml);
  if (!parsed.ok) return { ok: false, violations: [parsed.violation] };
  return checked(Draft, parsed.document, repeatedKeys(yaml));
}

function checked<T>(schema: z.ZodType<T>, document: Record<string, unknown>, found: readonly Violation[]): Parsed<T> {
  const result = schema.safeParse(document);
  if (result.success && found.length === 0) return { ok: true, shape: result.data };
  const issues = result.success ? [] : result.error.issues.flatMap(violations);
  const unique = issues.filter((violation, i) => issues.findIndex((other) => other.path === violation.path) === i);
  return { ok: false, violations: [...unique, ...found] };
}

function violations(issue: z.core.$ZodIssue): Violation[] {
  const path = issue.path.map(String);
  // Zod reports a union that one branch nearly matched as that branch's issues; a requirement is
  // reported whole, so a mixed form does not read as an error in one form.
  if (path[0] === "requirements" && path.length >= 2 && issue.code !== "invalid_key" && issue.code !== "custom") {
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
