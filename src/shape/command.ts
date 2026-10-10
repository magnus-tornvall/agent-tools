/**
 * `mt shape`, which cli/mt loads only when it is called.
 *
 *   mt shape check [--draft] <file>        nothing and exit 0 on a shape, or with --draft on a
 *                                          draft, otherwise one `path: message` line per violation
 *                                          and exit 1
 *   mt shape slice <file> --keys <a,b>     the shape with only those top-level keys, as YAML; the
 *                                          file need only be a YAML map, not pass the check
 *
 * A file of `-` is read from stdin. Usage errors exit 2.
 */
import { readFileSync } from "node:fs";
import { parseDocument, parseDraft, parseShape, SHAPE_KEYS, type Violation } from "./shape.ts";

const USAGE = `usage: mt shape check [--draft] <file>
       mt shape slice <file> --keys <key,...>
A file of - is read from stdin.
`;

class UsageError extends Error {}

function readShape(file: string): string | undefined {
  try {
    return readFileSync(file === "-" ? 0 : file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`mt: cannot read '${file}': ${reason}\n`);
    return undefined;
  }
}

function report(violations: readonly Violation[]): void {
  const lines = violations.map(({ path, message }) => `${path || "(document)"}: ${message}\n`);
  process.stderr.write(lines.join(""));
}

/** A file operand: `-` for stdin, or a path that does not start with `-`. */
function isFile(arg: string): boolean {
  return arg === "-" || !arg.startsWith("-");
}

function check(args: readonly string[]): number {
  let draft = false;
  const files: string[] = [];
  for (const arg of args) {
    if (arg === "--draft") draft = true;
    else if (isFile(arg)) files.push(arg);
    else throw new UsageError(`unknown option '${arg}'`);
  }
  const [file, ...rest] = files;
  if (file === undefined || rest.length > 0) throw new UsageError("check takes one file");
  const yaml = readShape(file);
  if (yaml === undefined) return 1;
  const parsed = draft ? parseDraft(yaml) : parseShape(yaml);
  if (parsed.ok) return 0;
  report(parsed.violations);
  return 1;
}

function slice(args: readonly string[]): number {
  let file: string | undefined;
  let keys: string[] | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--keys") {
      const value = args[++i];
      if (value === undefined || value === "") throw new UsageError("--keys needs a value");
      keys = value.split(",");
    } else if (!isFile(arg)) {
      throw new UsageError(`unknown option '${arg}'`);
    } else {
      if (file !== undefined) throw new UsageError(`unexpected argument '${arg}'`);
      file = arg;
    }
  }
  if (file === undefined) throw new UsageError("slice needs a file");
  if (keys === undefined) throw new UsageError("slice needs --keys");

  const unknown = keys.filter((key) => !SHAPE_KEYS.includes(key));
  if (unknown.length > 0) {
    const names = unknown.map((key) => `'${key}'`).join(", ");
    process.stderr.write(`mt: not a shape key: ${names}. The keys are ${SHAPE_KEYS.join(", ")}.\n`);
    return 1;
  }

  const yaml = readShape(file);
  if (yaml === undefined) return 1;
  const parsed = parseDocument(yaml);
  if (!parsed.ok) {
    report([parsed.violation]);
    return 1;
  }
  const present = [...new Set(keys)].filter((key) => key in parsed.document);
  const sliced = Object.fromEntries(present.map((key) => [key, parsed.document[key]]));
  process.stdout.write(`${Bun.YAML.stringify(sliced, null, 2)}\n`);
  return 0;
}

export function runShape(args: readonly string[]): number {
  const [subcommand, ...rest] = args;
  try {
    switch (subcommand) {
      case "check":
        return check(rest);
      case "slice":
        return slice(rest);
      default:
        throw new UsageError(subcommand === undefined ? "shape needs check or slice" : `unknown shape command '${subcommand}'`);
    }
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`mt: ${error.message}\n${USAGE}`);
    return 2;
  }
}
