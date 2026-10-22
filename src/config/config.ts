/**
 * The owner's config and `mt config`, which cli/mt loads only when it is called. The config is one
 * TOML file of standing owner policy for unattended work; only the owner edits it, and mt only
 * reads it. A key is binding, which no agent overrides and which stops whatever reads it when it is
 * missing or invalid, or advisory, whose reader carries on without it. No key has a default.
 *
 *   mt config          the file's path, then one line per key: its name, binding or advisory, and
 *                      its value, or missing, or invalid and why; a key mt does not know is named
 *                      too. Exits 1 when a binding key is missing or invalid or a key is unknown.
 *   mt config <key>    the key's value alone, a list one item per line, a table one entry per line,
 *                      its name then its items separated by tabs; exits 1 naming the key when it is
 *                      missing or invalid, and 2 when mt has no such key.
 *
 * Only a command that reads a key fails on it; nothing else reads config.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const USAGE = "usage: mt config [<key>]\n";

class UsageError extends Error {}

type Kind = "binding" | "advisory";

interface Spec<T> {
  kind: Kind;
  /** What a valid value is, as a message completes "must be". */
  rule: string;
  schema: z.ZodType<T>;
}

interface Values {
  fix_rounds: number;
  repo_agents: Record<string, string[]>;
}

export type Key = keyof Values;

const AGENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// A repo is printed on its own line with its agents after a tab, so it holds no control character:
// a tab or a line break in it would be read as another field or another repo.
const REPO = /^\P{Cc}+$/u;

const SPECS: { [K in Key]: Spec<Values[K]> } = {
  fix_rounds: { kind: "binding", rule: "an integer of 0 or more", schema: z.number().int().min(0) },
  repo_agents: {
    kind: "binding",
    rule: "a table from repo to a non-empty list of agent names",
    schema: z.record(z.string().regex(REPO), z.array(z.string().regex(AGENT)).min(1)),
  },
};

const KEYS: readonly Key[] = ["fix_rounds", "repo_agents"];

function isKey(name: string): name is Key {
  return KEYS.some((key) => key === name);
}

/** A value as the file gave it, but a number past what a double holds exactly is read already rounded, so it is described instead. */
function shown(raw: unknown): string {
  if (typeof raw === "number" && Number.isInteger(raw) && !Number.isSafeInteger(raw)) {
    return `a number beyond ±${Number.MAX_SAFE_INTEGER}, which mt cannot read exactly`;
  }
  return JSON.stringify(raw);
}

/** A key's value, or why there is none: missing, or invalid and why. */
export type Lookup<T> = { ok: true; value: T } | { ok: false; state: "missing" } | { ok: false; state: "invalid"; why: string };

/** The config file as read: its path, and its keys or why it could not be read. */
export interface Config {
  path: string;
  file: { ok: true; keys: Record<string, unknown> } | { ok: false; why: string | null };
}

/** `${XDG_CONFIG_HOME:-$HOME/.config}/mt/config.toml`. */
export function configPath(env: Record<string, string | undefined> = process.env): string {
  return join(env.XDG_CONFIG_HOME || join(env.HOME ?? "", ".config"), "mt", "config.toml");
}

function reason(error: unknown): string {
  if (error instanceof Error) return error.message;
  // Bun.TOML.parse throws a BuildMessage, which is not an Error but carries a message.
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  return String(error);
}

/** Reads the config file. A file that is not there is not an error: every key in it is missing. */
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const path = configPath(env);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const missing = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
    return { path, file: { ok: false, why: missing ? null : `the file cannot be read: ${reason(error)}` } };
  }
  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(text);
  } catch (error) {
    return { path, file: { ok: false, why: `the file is not TOML: ${reason(error)}` } };
  }
  const keys = z.record(z.string(), z.unknown()).safeParse(parsed);
  return keys.success ? { path, file: { ok: true, keys: keys.data } } : { path, file: { ok: false, why: "the file is not a TOML table" } };
}

/** One key of the config, checked against what that key must be. */
export function lookup<K extends Key>(config: Config, key: K): Lookup<Values[K]> {
  const { file } = config;
  if (!file.ok) {
    return file.why === null ? { ok: false, state: "missing" } : { ok: false, state: "invalid", why: file.why };
  }
  if (!Object.hasOwn(file.keys, key)) return { ok: false, state: "missing" };
  const raw = file.keys[key];
  const spec = SPECS[key];
  const parsed = spec.schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, state: "invalid", why: `must be ${spec.rule}, not ${shown(raw)}` };
}

/** Why a key has no value, naming the file: `missing from <path>` or `invalid in <path>: <why>`. */
export function problem(config: Config, found: Exclude<Lookup<unknown>, { ok: true }>): string {
  return found.state === "missing" ? `missing from ${config.path}` : `invalid in ${config.path}: ${found.why}`;
}

function listing(config: Config): number {
  const lines = [config.path];
  let code = 0;
  for (const key of KEYS) {
    const { kind } = SPECS[key];
    const found = lookup(config, key);
    if (!found.ok && kind === "binding") code = 1;
    const shown = found.ok ? JSON.stringify(found.value) : found.state === "missing" ? "missing" : `invalid: ${found.why}`;
    lines.push(`${key.padEnd(18)} ${kind.padEnd(9)} ${shown}`);
  }
  const unknown = config.file.ok ? Object.keys(config.file.keys).filter((name) => !isKey(name)) : [];
  for (const name of unknown) lines.push(`${name.padEnd(18)} unknown   mt has no such key`);
  if (unknown.length > 0) code = 1;
  process.stdout.write(`${lines.join("\n")}\n`);
  return code;
}

/** A value as `mt config <key>` prints it: a list one item per line, a table one entry per line. */
function asLines(value: Values[Key]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "object") return Object.entries(value).map(([name, items]) => [name, ...items].join("\t"));
  return [String(value)];
}

function single(config: Config, key: Key): number {
  const found = lookup(config, key);
  if (!found.ok) {
    process.stderr.write(`mt: config: ${key} is ${problem(config, found)}\n`);
    return 1;
  }
  process.stdout.write(asLines(found.value).map((line) => `${line}\n`).join(""));
  return 0;
}

/** Runs `mt config` with the words after it. */
export function runConfig(args: readonly string[]): number {
  try {
    const [name, ...rest] = args;
    if (rest.length > 0) throw new UsageError(`unexpected argument '${rest[0]}'`);
    if (name === undefined) return listing(readConfig());
    if (!isKey(name)) throw new UsageError(`unknown config key '${name}'; the keys are ${KEYS.join(", ")}`);
    return single(readConfig(), name);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`mt: ${error.message}\n${USAGE}`);
    return 2;
  }
}
