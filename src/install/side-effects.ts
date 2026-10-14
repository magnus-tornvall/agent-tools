/**
 * Each mt command's side-effect class, declared once here, and the Claude Code permission rules
 * install builds from them. The README's contract for each command states the same class.
 *
 *   read-only     reads files and prints; writes nothing
 *   local write   writes on this machine only, such as the usage log
 *   network       reaches off this machine, such as `mt update` fetching from the clone's origin
 *
 * Every command is allowed, and Claude Code asks before an agent runs one that reaches off this
 * machine.
 */

export type SideEffect = "read-only" | "local write" | "network";

/** Each command as its words after `mt`, the way its usage line names it. */
export const COMMANDS: Readonly<Record<string, SideEffect>> = {
  get: "local write",
  list: "read-only",
  "shape check": "read-only",
  "shape slice": "read-only",
  config: "read-only",
  update: "network",
};

/** `Bash(mt:*)`, which allows every command; the ask rules still prompt before a network command. */
export const ALLOW_RULES: readonly string[] = ["Bash(mt:*)"];

/** One ask rule per network command: Claude Code checks ask rules before allow rules. */
export const ASK_RULES: readonly string[] = Object.entries(COMMANDS)
  .filter(([, effect]) => effect === "network")
  .map(([command]) => `Bash(mt ${command}:*)`);
