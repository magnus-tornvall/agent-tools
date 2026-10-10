/**
 * Adds or removes the rules that let agents run mt without a prompt in a Claude Code settings
 * file, keeping everything else in it: `Bash(mt:*)` in permissions.allow, and `Bash(mt dogfood:*)`
 * in permissions.ask so a dogfood filing still prompts. `add` also replaces the narrower allow
 * rules an earlier install wrote, and `remove` takes those out too. Asks first, and only when
 * there is something to change; `add` creates a missing file.
 *
 *   bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]
 *
 * `yes` or `no` answers without asking. With no answer and no terminal to ask on, nothing is
 * written. A file that is not a JSON object, or whose `permissions.allow` or `permissions.ask`
 * is not a list of strings, is left as it is and exits 1.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ALLOW_RULE = "Bash(mt:*)";
const ASK_RULE = "Bash(mt dogfood:*)";
const EARLIER_ALLOW_RULES = ["Bash(mt get:*)", "Bash(mt list)", "Bash(mt shape:*)"];

const USAGE = "usage: bun src/install/mt-rules.ts add|remove <settings.json> [yes|no]\n";

type Json = Record<string, unknown>;
type Mode = "add" | "remove";
type Edit = { add: string[]; remove: string[] };
type Edits = { allow: Edit; ask: Edit };

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

function planEdits(mode: Mode, allow: readonly string[], ask: readonly string[]): Edits {
  if (mode === "add") {
    return {
      allow: {
        add: allow.includes(ALLOW_RULE) ? [] : [ALLOW_RULE],
        remove: EARLIER_ALLOW_RULES.filter((rule) => allow.includes(rule)),
      },
      ask: { add: ask.includes(ASK_RULE) ? [] : [ASK_RULE], remove: [] },
    };
  }
  return {
    allow: { add: [], remove: [ALLOW_RULE, ...EARLIER_ALLOW_RULES].filter((rule) => allow.includes(rule)) },
    ask: { add: [], remove: ask.includes(ASK_RULE) ? [ASK_RULE] : [] },
  };
}

function describe(edits: Edits): string {
  const parts: string[] = [];
  for (const list of ["allow", "ask"] as const) {
    const { add, remove } = edits[list];
    if (add.length > 0) parts.push(`add ${add.join(", ")} to permissions.${list}`);
    if (remove.length > 0) parts.push(`remove ${remove.join(", ")} from permissions.${list}`);
  }
  return parts.join("; ");
}

function applyEdit(list: readonly string[], { add, remove }: Edit): string[] {
  return [...list.filter((rule) => !remove.includes(rule)), ...add];
}

function approved(mode: Mode, answer: string, file: string, edits: Edits): boolean {
  if (answer === "yes") return true;
  if (answer === "no") return false;
  const { variable } = WORDING[mode];
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
    process.stderr.write(`mt-rules: ${file} is ${settings}; ${mode} ${ALLOW_RULE} in permissions.allow and ${ASK_RULE} in permissions.ask by hand\n`);
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
  const edits = planEdits(mode, allow, ask);
  const description = describe(edits);
  if (description === "") return 0;
  if (!approved(mode, answer, file, edits)) {
    process.stdout.write(`${WORDING[mode].declined}\n`);
    return 0;
  }
  const next: Json = { ...permissions, allow: applyEdit(allow, edits.allow) };
  if (permissions.ask !== undefined || edits.ask.add.length > 0) next.ask = applyEdit(ask, edits.ask);
  settings.permissions = next;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  process.stdout.write(`${mode === "add" ? "added" : "removed"} in ${file}: ${description}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
