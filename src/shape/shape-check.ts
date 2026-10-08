/**
 * Checks that a file is a shape any producer can hand to to-orca.
 *
 *   bun src/shape/shape-check.ts <file>
 *
 * Prints nothing and exits 0 when it is; otherwise prints one `path: message` line per violation
 * and exits 1.
 */
import { readFileSync } from "node:fs";
import { parseShape } from "./shape.ts";

const USAGE = "usage: bun src/shape/shape-check.ts <file>";

/** The violations in the file the arguments name, one `path: message` line each. */
export function shapeCheck(args: readonly string[]): string[] {
  const [file, ...rest] = args;
  if (file === undefined || rest.length > 0) throw new Error(USAGE);
  const parsed = parseShape(readFileSync(file, "utf8"));
  if (parsed.ok) return [];
  return parsed.violations.map(({ path, message }) => `${path || "(document)"}: ${message}`);
}

if (import.meta.main) {
  try {
    const violations = shapeCheck(process.argv.slice(2));
    if (violations.length > 0) {
      console.error(violations.join("\n"));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
