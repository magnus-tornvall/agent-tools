/**
 * Adds or removes, in a Claude Code settings file, the rules side-effects.ts builds from each mt
 * command's class; src/install/PART.md is its contract.
 *
 *   bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ALLOW_RULES } from "./side-effects.ts";

/** Workaround for settings an install before Bash(mt:*) wrote; remove when no such install is left. */
const EARLIER_ALLOW_RULES = ["Bash(mt get:*)", "Bash(mt list)", "Bash(mt shape:*)"];

const USAGE = "usage: bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]\n";

type Json = Record<string, unknown>;
type Mode = "add" | "remove";
type Edit = { add: string[]; remove: string[] };

const WORDING: Record<Mode, { variable: string; declined: string }> = {
  add: { variable: "ADD_MT_RULES", declined: "agents will ask before each mt command" },
  remove: { variable: "REMOVE_MT_RULES", declined: "the mt rules stay allowed" },
};

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMode(value: string | undefined): value is Mode {
  return value === "add" || value === "remove";
}

function readSettings(file: string): Json | string {
  if (!existsSync(file)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return `not JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
  return isObject(parsed) ? parsed : "not a JSON object";
}

function planEdit(mode: Mode, allow: readonly string[]): Edit {
  if (mode === "add") {
    return {
      add: ALLOW_RULES.filter((rule) => !allow.includes(rule)),
      remove: EARLIER_ALLOW_RULES.filter((rule) => allow.includes(rule)),
    };
  }
  return { add: [], remove: [...ALLOW_RULES, ...EARLIER_ALLOW_RULES].filter((rule) => allow.includes(rule)) };
}

function describe({ add, remove }: Edit): string {
  const parts: string[] = [];
  if (add.length > 0) parts.push(`add ${add.join(", ")} to permissions.allow`);
  if (remove.length > 0) parts.push(`remove ${remove.join(", ")} from permissions.allow`);
  return parts.join("; ");
}

function applyEdit(list: readonly string[], { add, remove }: Edit): string[] {
  return [...list.filter((rule) => !remove.includes(rule)), ...add];
}

function approved(mode: Mode, answer: string, file: string, edit: Edit): boolean {
  if (answer === "yes") return true;
  if (answer === "no") return false;
  const { variable } = WORDING[mode];
  if (!process.stdin.isTTY) {
    process.stdout.write(`left ${file} as it is: no terminal to ask on; run again with ${variable}=yes or ${variable}=no\n`);
    return false;
  }
  const reply = prompt(`In ${file}, ${describe(edit)}? [y/N]`);
  return reply !== null && /^y(es)?$/i.test(reply.trim());
}

function main(args: readonly string[]): number {
  const [mode, file, answer = "", ...rest] = args;
  if (!isMode(mode) || file === undefined || !["", "yes", "no"].includes(answer) || rest.length > 0) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (mode === "remove" && !existsSync(file)) return 0;
  const settings = readSettings(file);
  if (typeof settings === "string") {
    process.stderr.write(`mt-rules: ${file} is ${settings}; ${mode} ${ALLOW_RULES.join(", ")} in permissions.allow by hand\n`);
    return 1;
  }
  const permissions = settings.permissions ?? {};
  if (!isObject(permissions)) {
    process.stderr.write(`mt-rules: ${file}: permissions is not an object\n`);
    return 1;
  }
  const allow = permissions.allow ?? [];
  if (!isStringList(allow)) {
    process.stderr.write(`mt-rules: ${file}: permissions.allow is not a list of strings\n`);
    return 1;
  }
  const edit = planEdit(mode, allow);
  const description = describe(edit);
  if (description === "") return 0;
  if (!approved(mode, answer, file, edit)) {
    process.stdout.write(`${WORDING[mode].declined}\n`);
    return 0;
  }
  settings.permissions = { ...permissions, allow: applyEdit(allow, edit) };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  process.stdout.write(`${mode === "add" ? "added" : "removed"} in ${file}: ${description}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
