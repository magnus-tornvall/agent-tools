/**
 * Adds or removes the rules that let agents run mt without a prompt in a Claude Code settings
 * file, keeping everything else in it. Asks first, and only when there is something to change;
 * `add` creates a missing file.
 *
 *   bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]
 *
 * `yes` or `no` answers without asking. With no answer and no terminal to ask on, nothing is
 * written. A file that is not a JSON object, or whose `permissions.allow` is not a list of
 * strings, is left as it is and exits 1.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const RULES = ["Bash(mt get:*)", "Bash(mt list)", "Bash(mt shape:*)"];

const USAGE = "usage: bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]\n";

type Json = Record<string, unknown>;
type Mode = "add" | "remove";

const WORDING: Record<Mode, { question: string; variable: string; declined: string }> = {
  add: { question: "Add {rules} to", variable: "ADD_MT_RULES", declined: "agents will ask before each mt command" },
  remove: { question: "Remove {rules} from", variable: "REMOVE_MT_RULES", declined: "the mt rules stay allowed" },
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

function approved(mode: Mode, answer: string, file: string, rules: readonly string[]): boolean {
  if (answer === "yes") return true;
  if (answer === "no") return false;
  const { question, variable } = WORDING[mode];
  if (!process.stdin.isTTY) {
    process.stdout.write(`left ${file} as it is: no terminal to ask on; run again with ${variable}=yes or ${variable}=no\n`);
    return false;
  }
  const reply = prompt(`${question.replace("{rules}", rules.join(", "))} permissions.allow in ${file}? [y/N]`);
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
    process.stderr.write(`mt-rules: ${file} is ${settings}; ${mode} ${RULES.join(", ")} in permissions.allow by hand\n`);
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
  const changing = RULES.filter((rule) => allow.includes(rule) === (mode === "remove"));
  if (changing.length === 0) return 0;
  if (!approved(mode, answer, file, changing)) {
    process.stdout.write(`${WORDING[mode].declined}\n`);
    return 0;
  }
  const next = mode === "add" ? [...allow, ...changing] : allow.filter((rule) => !changing.includes(rule));
  settings.permissions = { ...permissions, allow: next };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  process.stdout.write(`${mode === "add" ? "allowed" : "removed"} ${changing.join(", ")} in ${file}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
