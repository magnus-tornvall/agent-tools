/**
 * Adds or removes, in a Claude Code settings file, the rules side-effects.ts builds from each mt
 * command's class; src/install/PART.md is its contract.
 *
 *   bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { rules } from "./side-effects.ts";

const { allow: ALLOW_RULES, ask: ASK_RULES, deny: DENY_RULES } = rules();
/** Workaround for settings an install before Bash(mt:*) wrote; remove when no such install is left. */
const EARLIER_ALLOW_RULES = ["Bash(mt get:*)", "Bash(mt list)", "Bash(mt shape:*)"];

const USAGE = "usage: bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]\n";

type Json = Record<string, unknown>;
type Mode = "add" | "remove";
type Edit = { add: string[]; remove: string[] };
type Edits = { allow: Edit; ask: Edit; deny: Edit };

const VARIABLE: Record<Mode, string> = { add: "ADD_MT_RULES", remove: "REMOVE_MT_RULES" };

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

function planEdits(mode: Mode, allow: readonly string[], ask: readonly string[], deny: readonly string[]): Edits {
  if (mode === "add") {
    return {
      allow: {
        add: ALLOW_RULES.filter((rule) => !allow.includes(rule)),
        remove: EARLIER_ALLOW_RULES.filter((rule) => allow.includes(rule)),
      },
      ask: { add: ASK_RULES.filter((rule) => !ask.includes(rule)), remove: [] },
      deny: { add: DENY_RULES.filter((rule) => !deny.includes(rule)), remove: [] },
    };
  }
  return {
    allow: { add: [], remove: [...ALLOW_RULES, ...EARLIER_ALLOW_RULES].filter((rule) => allow.includes(rule)) },
    ask: { add: [], remove: ASK_RULES.filter((rule) => ask.includes(rule)) },
    deny: { add: [], remove: DENY_RULES.filter((rule) => deny.includes(rule)) },
  };
}

function describe(edits: Edits): string {
  const parts: string[] = [];
  for (const list of ["allow", "ask", "deny"] as const) {
    const { add, remove } = edits[list];
    if (add.length > 0) parts.push(`add ${add.join(", ")} to permissions.${list}`);
    if (remove.length > 0) parts.push(`remove ${remove.join(", ")} from permissions.${list}`);
  }
  return parts.join("; ");
}

/** The command a `Bash(<command>:*)` rule matches, such as `mt oracle`. */
function command(rule: string): string {
  return rule.replace(/^Bash\((.*):\*\)$/, "$1");
}

/** What declining the edits leaves as it is, for the owner who declined them. */
function declined(edits: Edits): string {
  const parts: string[] = [];
  if (edits.allow.add.length > 0) parts.push("agents will ask before each mt command");
  else if (edits.ask.add.length > 0) parts.push(`agents run ${edits.ask.add.map(command).join(", ")} without asking`);
  if (edits.deny.add.length > 0) parts.push(`agents are not refused ${edits.deny.add.map(command).join(", ")}`);
  for (const list of ["allow", "ask", "deny"] as const) {
    const { remove } = edits[list];
    if (remove.length > 0) parts.push(`kept in permissions.${list}: ${remove.join(", ")}`);
  }
  return parts.join("; ");
}

function applyEdit(list: readonly string[], { add, remove }: Edit): string[] {
  return [...list.filter((rule) => !remove.includes(rule)), ...add];
}

function approved(mode: Mode, answer: string, file: string, edits: Edits): boolean {
  if (answer === "yes") return true;
  if (answer === "no") return false;
  const variable = VARIABLE[mode];
  if (!process.stdin.isTTY) {
    process.stdout.write(`left ${file} as it is: no terminal to ask on; run again with ${variable}=yes or ${variable}=no\n`);
    return false;
  }
  const reply = prompt(`In ${file}, ${describe(edits)}? [y/N]`);
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
    process.stderr.write(`mt-rules: ${file} is ${settings}; ${mode} ${ALLOW_RULES.join(", ")} in permissions.allow, ${ASK_RULES.join(", ")} in permissions.ask and ${DENY_RULES.join(", ")} in permissions.deny by hand\n`);
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
  const ask = permissions.ask ?? [];
  if (!isStringList(ask)) {
    process.stderr.write(`mt-rules: ${file}: permissions.ask is not a list of strings\n`);
    return 1;
  }
  const deny = permissions.deny ?? [];
  if (!isStringList(deny)) {
    process.stderr.write(`mt-rules: ${file}: permissions.deny is not a list of strings\n`);
    return 1;
  }
  const edits = planEdits(mode, allow, ask, deny);
  const description = describe(edits);
  if (description === "") return 0;
  if (!approved(mode, answer, file, edits)) {
    process.stdout.write(`${declined(edits)}\n`);
    return 0;
  }
  const next: Json = { ...permissions, allow: applyEdit(allow, edits.allow) };
  if (permissions.ask !== undefined || edits.ask.add.length > 0) next.ask = applyEdit(ask, edits.ask);
  if (permissions.deny !== undefined || edits.deny.add.length > 0) next.deny = applyEdit(deny, edits.deny);
  settings.permissions = next;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  process.stdout.write(`${mode === "add" ? "added" : "removed"} in ${file}: ${description}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
