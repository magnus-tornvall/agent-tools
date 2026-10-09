/**
 * The matching half of guide-lint: which backticked spans of a guide mention an `mt` or `orca`
 * command, and whether each one still exists. It reads no files and runs nothing; main.ts feeds it
 * the text, mt's usage, the outcome of `mt get` and `orca agent-context --json`.
 */

export interface Span {
  line: number;
  text: string;
}

/** Each backticked span of a document as its first line and whitespace-normalised text. A span may wrap onto the next line of its paragraph. */
export function spans(markdown: string): Span[] {
  const paragraphs: { start: number; text: string }[] = [];
  let current: string[] = [];
  let start = 0;
  const close = () => {
    if (current.length > 0) paragraphs.push({ start, text: current.join("\n") });
    current = [];
  };
  markdown.split("\n").forEach((line, index) => {
    const trimmed = line.trimStart();
    if (line.trim() === "" || trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      close();
      return;
    }
    if (current.length === 0) start = index + 1;
    current.push(line);
  });
  close();

  const found: Span[] = [];
  for (const { start, text } of paragraphs) {
    let from = 0;
    for (;;) {
      const opening = /`+/g;
      opening.lastIndex = from;
      const open = opening.exec(text);
      if (open === null) break;
      const closing = new RegExp(`(?<!\`)${open[0]}(?!\`)`, "g");
      closing.lastIndex = open.index + open[0].length;
      const close = closing.exec(text);
      if (close === null) {
        from = open.index + open[0].length;
        continue;
      }
      const inner = text.slice(open.index + open[0].length, close.index);
      const line = start + text.slice(0, open.index).split("\n").length - 1;
      found.push({ line, text: inner.split(/\s+/).filter(Boolean).join(" ") });
      from = close.index + close[0].length;
    }
  }
  return found;
}

const PLAIN_WORD = /^[a-z][a-z0-9-]*$/;

function plainWords(words: readonly string[]): string[] {
  const end = words.findIndex((word) => !PLAIN_WORD.test(word));
  return words.slice(0, end === -1 ? words.length : end);
}

/** The command words of each `mt …` line in mt's usage text. */
export function parseMtUsage(usage: string): string[][] {
  const verbs: string[][] = [];
  for (const line of usage.split("\n")) {
    const match = /^\s*(?:usage:\s*)?mt\s+(.*)$/.exec(line);
    const words = plainWords((match?.[1] ?? "").split(/\s+/).filter(Boolean));
    if (words.length > 0) verbs.push(words);
  }
  return verbs;
}

/** The exit status of `mt get <args>`, and the first line it wrote to stderr. */
export type MtGet = (args: readonly string[]) => { status: number | null; error: string };

/**
 * The arguments of an `mt get` mention that can be run, or null when its tool is a placeholder. A
 * placeholder value is dropped with the flag before it: `--ref <ref>` leaves only the tool.
 */
function runnableGetArgs(words: readonly string[]): string[] | null {
  const args: string[] = [];
  for (const word of words) {
    const arg = word.replace(/^\[|\]$/g, "");
    if (!arg.includes("<")) {
      args.push(arg);
    } else if (args.at(-1)?.startsWith("-")) {
      args.pop();
    } else {
      return null;
    }
  }
  return args;
}

/** Whether an `mt …` mention is a placeholder that checkMtMention skips: an `mt get` whose tool is a `<placeholder>`. */
export function isPlaceholderMention(words: readonly string[]): boolean {
  return words[1] === "get" && runnableGetArgs(words.slice(2)) === null;
}

/**
 * Why an `mt …` mention no longer resolves, or null when it does or its tool is a placeholder. `mt
 * get` mentions are run through `mtGet`; any other is matched against the verbs of mt's usage.
 */
export function checkMtMention(words: readonly string[], verbs: readonly string[][], mtGet: MtGet): string | null {
  if (words[1] === "get") {
    const args = runnableGetArgs(words.slice(2));
    if (args === null) return null;
    if (args.length > 0) {
      const { status, error } = mtGet(args);
      if (status === 0) return null;
      if (status === 2) return "mt get rejects these arguments";
      if (status === 1) return args.includes("--ref") ? "mt get finds no such reference" : "mt get finds no such guide";
      return `mt get exited ${status ?? "without a status"}: ${error}`;
    }
  }
  const said = plainWords(words.slice(1));
  if (said.length === 0) return null;
  const listed = verbs.some((verb) => verb.slice(0, said.length).join(" ") === said.join(" ") || said.slice(0, verb.length).join(" ") === verb.join(" "));
  return listed ? null : `mt has no command 'mt ${said.join(" ")}' in its usage`;
}

interface OrcaCommand {
  name: string;
  flags: ReadonlySet<string>;
  group: boolean;
}

/** Every command path `orca agent-context --json` lists, with the commands that answer to it. */
export type OrcaTable = Map<string, OrcaCommand[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * The commands of `orca agent-context --json`, or why guide-lint cannot read it. A proper prefix of
 * a command path, such as `orca orchestration`, is a group: a command with no flags.
 */
export function readOrcaContext(context: unknown): OrcaTable | string {
  if (!isRecord(context)) return "`orca agent-context --json` did not print a JSON object";
  if (context.schemaVersion !== 1) {
    return `\`orca agent-context --json\` reports schemaVersion ${JSON.stringify(context.schemaVersion)}; guide-lint reads only schema version 1`;
  }
  const table: OrcaTable = new Map();
  if (!Array.isArray(context.commands)) return "`orca agent-context --json` has no `commands` array";
  for (const entry of context.commands) {
    if (!isRecord(entry) || typeof entry.command !== "string" || !Array.isArray(entry.path)) {
      return "`orca agent-context --json` lists a command without a string `command` and an array `path`";
    }
    const command: OrcaCommand = { name: entry.command, flags: new Set(strings(entry.flags)), group: false };
    const aliases = Array.isArray(entry.aliases) ? entry.aliases.map(strings) : [];
    for (const path of [strings(entry.path), ...aliases]) {
      if (path.length === 0) continue;
      const key = path.join(" ");
      table.set(key, [...(table.get(key) ?? []), command]);
    }
  }
  for (const key of [...table.keys()]) {
    const path = key.split(" ");
    for (let n = 1; n < path.length; n++) {
      const group = path.slice(0, n).join(" ");
      if (!table.has(group)) table.set(group, [{ name: group, flags: new Set(), group: true }]);
    }
  }
  return table;
}

/** Why an `orca …` mention no longer resolves, or null when its command and every `--flag` still exist. */
export function checkOrcaMention(words: readonly string[], table: OrcaTable): string | null {
  if (words[1]?.startsWith("-") === true || words.some((word) => /^-[^-]/.test(word))) {
    return "guide-lint cannot check a mention that opens with a flag or holds a short flag; write the command path first, then long flags";
  }
  const firstFlag = words.findIndex((word, index) => index > 0 && word.startsWith("-"));
  const said = words.slice(1, firstFlag === -1 ? words.length : firstFlag);
  if (said.length === 0) return null;

  let commands: OrcaCommand[] | undefined;
  for (let n = said.length; n >= 1 && commands === undefined; n--) {
    const candidates = table.get(said.slice(0, n).join(" "));
    // A group takes a subcommand, never an argument.
    if (candidates !== undefined && (n === said.length || !candidates.every((candidate) => candidate.group))) {
      commands = candidates;
    }
  }
  if (commands === undefined) return `orca has no command '${said.join(" ")}'`;

  const names = [...new Set(commands.map((command) => command.name))].sort().join(" or ");
  for (const word of words) {
    if (!word.startsWith("--") || word.length <= 2) continue;
    const flag = word.slice(2).split("=")[0] ?? "";
    if (!commands.some((command) => command.flags.has(flag))) return `orca ${names} has no flag --${flag}`;
  }
  return null;
}
