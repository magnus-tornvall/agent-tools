/**
 * The shape: the contract between whatever produces a shape and Orca. A user opts in by
 * producing one YAML document that conforms to `Shape`; mvc is one producer, not the contract.
 * Its oracles, when it has them, are added to a closed shape by whatever writes them.
 *
 * A draft is an unfinished shape: the same document with a top-level `draft` block. It is never
 * a shape; `Draft` checks it with every shape field optional.
 *
 * This schema is the one source of truth; `mt shape` and `mt oracle` both use it.
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
    /** `silence` when the decision was an assumption nobody corrected. */
    decided_by: z.enum(["owner", "silence"]),
  })
  .superRefine((decision, context) => {
    if (decision.door === "one_way" && decision.decided_by !== "owner") {
      context.addIssue({ code: "custom", path: ["decided_by"], message: "must be owner when door is one_way" });
    }
  });

/** A path relative to the repo root, with no empty, `.` or `..` segment. */
export function isRelativePath(path: string): boolean {
  if (/\s/.test(path) || path.startsWith("/")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * A path relative to the repo root, or `path:symbol`. A directory may end in `/`. The path is not
 * checked for existence.
 */
export function isTouchpoint(touchpoint: string): boolean {
  const colon = touchpoint.indexOf(":");
  const path = colon === -1 ? touchpoint : touchpoint.slice(0, colon);
  const symbol = colon === -1 ? undefined : touchpoint.slice(colon + 1);
  if (symbol !== undefined && !/^\S+$/.test(symbol)) return false;
  return isRelativePath(path.endsWith("/") ? path.slice(0, -1) : path);
}

const Touchpoint = z.string().refine(isTouchpoint, "must be a path relative to the repo root, or path:symbol");

const Requirements = z.record(idKey("R"), Requirement).superRefine((requirements, context) => {
  // A given that leans on another requirement passing makes one failure fail both. Only another
  // requirement's key counts, so a word such as R2 in a domain name is read as one less often.
  for (const [key, requirement] of Object.entries(requirements)) {
    if (!("given" in requirement)) continue;
    const named = [...requirement.given.matchAll(/\bR[1-9][0-9]*\b/g)].find(([id]) => id !== key && id in requirements);
    if (named !== undefined) {
      context.addIssue({ code: "custom", path: [key, "given"], message: `must set up its own state, not name ${named[0]}` });
    }
  }
});

/** What an oracle can cover: the outcome, a requirement, a non-goal or a constraint. */
const COVERABLE = /^(?:outcome|[RNC][1-9][0-9]*)$/;

const Coverable = z.string().regex(COVERABLE, "must be outcome, or an R, N or C key");

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "must be a sha256 in lowercase hex");

export const Oracle = z.strictObject({
  covers: z.array(Coverable).min(1, "must cover at least one key"),
  /** What it does at the base commit: new behaviour fails there, preserved behaviour passes. */
  base: z.enum(["fail", "pass"]),
  /** The command, run from the repo root. */
  run: Text,
  /** The JUnit XML report `run` writes, relative to the repo root; without it, the exit code tells. */
  junit: z.string().refine(isRelativePath, "must be a path relative to the repo root").optional(),
  /** Each file the oracle is made of, with the sha256 it was pinned at. */
  files: z
    .record(z.string().refine(isRelativePath, "must be a path relative to the repo root"), Sha256)
    .refine((files) => Object.keys(files).length > 0, "must pin at least one file"),
});

export type Oracle = z.infer<typeof Oracle>;

export const Oracles = z
  .record(idKey("O"), Oracle)
  .refine((oracles) => Object.keys(oracles).length > 0, "must have at least one oracle")
  .superRefine((oracles, context) => {
    // A report is deleted before its oracle runs, so it must never be a file any oracle pins.
    const pinned = new Set(Object.values(oracles).flatMap((oracle) => Object.keys(oracle.files)));
    for (const [id, oracle] of Object.entries(oracles)) {
      if (oracle.junit !== undefined && pinned.has(oracle.junit)) {
        context.addIssue({ code: "custom", path: [id, "junit"], message: "must not be a file an oracle pins" });
      }
    }
  });

export const Shape = z.strictObject({
  outcome: Text,
  /** Why the outcome matters, as the owner states it. It is no end state, so no oracle covers it. */
  purpose: Text.optional(),
  requirements: Requirements.refine((requirements) => Object.keys(requirements).length > 0, "must have at least one requirement"),
  non_goals: z.record(idKey("N"), NonGoal),
  constraints: z.record(idKey("C"), Text),
  touchpoints: z.array(Touchpoint),
  decisions: z.record(idKey("D"), Decision),
  oracles: Oracles.optional(),
  /** What no oracle covers, each with why: it cannot be observed, needs judgement, or no seam reaches it. */
  unchecked: z.record(Coverable, Text).optional(),
});

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapAt(document: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = document[key];
  return isMap(value) ? value : {};
}

/**
 * Once a shape has oracles, the outcome, each requirement, boundary non-goal and constraint is
 * covered by an oracle or unchecked with its reason, never both; every key named exists. It reads
 * the document as written, so a violation elsewhere does not hide what is uncovered.
 */
function coverage(document: Record<string, unknown>): Violation[] {
  const found: Violation[] = [];
  if (document.oracles === undefined) {
    if (document.unchecked !== undefined) found.push({ path: "unchecked", message: "not allowed without oracles" });
    return found;
  }
  // A block that is not a map is the schema's to report; read as empty, it would leave every key
  // uncovered.
  if (!isMap(document.oracles) || (document.unchecked !== undefined && !isMap(document.unchecked))) return found;
  const sections = { requirements: mapAt(document, "requirements"), non_goals: mapAt(document, "non_goals"), constraints: mapAt(document, "constraints") };
  const keys = new Map<string, string>([["outcome", "outcome"]]);
  for (const [section, entries] of Object.entries(sections)) {
    for (const key of Object.keys(entries)) keys.set(key, `${section}.${key}`);
  }
  const coveredBy = new Map<string, string>();
  for (const [id, oracle] of Object.entries(mapAt(document, "oracles"))) {
    const covers = isMap(oracle) && Array.isArray(oracle.covers) ? oracle.covers : [];
    covers.forEach((key: unknown, i) => {
      // A malformed key is the schema's to report.
      if (typeof key !== "string" || !COVERABLE.test(key)) return;
      if (!keys.has(key)) found.push({ path: `oracles.${id}.covers.${i}`, message: "no such key in the shape" });
      if (!coveredBy.has(key)) coveredBy.set(key, id);
    });
  }
  const unchecked = mapAt(document, "unchecked");
  for (const key of Object.keys(unchecked)) {
    if (!COVERABLE.test(key)) continue;
    if (!keys.has(key)) found.push({ path: `unchecked.${key}`, message: "no such key in the shape" });
    const oracle = coveredBy.get(key);
    if (oracle !== undefined) found.push({ path: `unchecked.${key}`, message: `covered by ${oracle}; unchecked holds only what no oracle covers` });
  }
  for (const [key, path] of keys) {
    const goal = sections.non_goals[key];
    if (isMap(goal) && goal.type === "deferral") continue;
    if (coveredBy.has(key) || key in unchecked) continue;
    found.push({ path, message: "covered by no oracle and not unchecked" });
  }
  return found;
}

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

const ID_MAPS = ["requirements", "non_goals", "constraints", "decisions", "oracles", "unchecked"];
const MAP_KEY = /^( *)(?:"([^"]*)"|'([^']*)'|([^\s#:][^#:]*?))\s*:(?:\s|$)/;
const SEQUENCE_ITEM = /^ *-(?:\s|$)/;

/**
 * Bun.YAML.parse keeps the last of a repeated key, so a repeat is found in the text: a top-level
 * key, or a key of one of the keyed maps, written as a block map, that appears more than once
 * under one map.
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

/** A shape's oracles, checked alone: running them needs only that block to be sound. */
export function parseOracles(yaml: string): Parsed<Record<string, Oracle>> {
  const parsed = parseDocument(yaml);
  if (!parsed.ok) return { ok: false, violations: [parsed.violation] };
  const schema = z.looseObject({ oracles: Oracles });
  const repeated = repeatedKeys(yaml).filter((violation) => violation.path === "oracles" || violation.path.startsWith("oracles."));
  const result = checked(schema, parsed.document, repeated);
  return result.ok ? { ok: true, shape: result.shape.oracles } : result;
}

const NOT_A_SHAPE = "a draft is not a shape; check it with --draft";

/** A shape. A document with a `draft` block fails on that key, whatever else it holds. */
export function parseShape(yaml: string): Parsed {
  const parsed = parseDocument(yaml);
  if (!parsed.ok) return { ok: false, violations: [parsed.violation] };
  const { draft, ...document } = parsed.document;
  const result = checked(Shape, document, [...repeatedKeys(yaml), ...coverage(document)]);
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
