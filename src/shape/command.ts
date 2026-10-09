/**
 * `mt shape`, which cli/mt loads only when it is called.
 *
 *   mt shape check <file>                  nothing and exit 0 on a shape, otherwise one
 *                                          `path: message` line per violation and exit 1
 *   mt shape slice <file> --keys <a,b>     the shape with only those top-level keys, as YAML
 *
 * Usage errors exit 2.
 */
import { readFileSync } from "node:fs";
import { parseShape, SHAPE_KEYS, type Parsed } from "./shape.ts";

const USAGE = `usage: mt shape check <file>
       mt shape slice <file> --keys <key,...>
`;

class UsageError extends Error {}

function parseFile(file: string): Parsed | undefined {
  let yaml: string;
  try {
    yaml = readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`mt: cannot read '${file}': ${reason}\n`);
    return undefined;
  }
  const parsed = parseShape(yaml);
  if (!parsed.ok) {
    const lines = parsed.violations.map(({ path, message }) => `${path || "(document)"}: ${message}\n`);
    process.stderr.write(lines.join(""));
  }
  return parsed;
}

function check(args: readonly string[]): number {
  const [file, ...rest] = args;
  if (file === undefined || file.startsWith("-") || rest.length > 0) throw new UsageError("check takes one file");
  return parseFile(file)?.ok ? 0 : 1;
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
    } else if (arg.startsWith("-")) {
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

  const parsed = parseFile(file);
  if (!parsed?.ok) return 1;
  const shape: Record<string, unknown> = parsed.shape;
  const sliced = Object.fromEntries([...new Set(keys)].map((key) => [key, shape[key]]));
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
