/**
 * Each mt command's side-effect class, declared once here, and the Claude Code permission rules
 * install builds from them. The README's contract for each command states the same class.
 *
 *   read-only     reads files and prints; writes nothing
 *   local write   writes on this machine only, such as the usage log or the JUnit report `mt oracle run` deletes
 *   network       reaches off this machine, such as `mt update` fetching from the clone's origin
 *
 * A class covers what mt itself does. `mt oracle run` runs a shape's commands, which may reach
 * further, and nothing checks who wrote or approved the shape it runs.
 *
 * Every command is allowed, and Claude Code asks before an agent runs one that reaches off this
 * machine. What only the owner runs is denied to agents, whatever its class.
 */

export type SideEffect = "read-only" | "local write" | "network";

/** Each command as its words after `mt`, the way its usage line names it. */
export const COMMANDS: Readonly<Record<string, SideEffect>> = {
  get: "local write",
  list: "read-only",
  "shape check": "read-only",
  "shape slice": "read-only",
  "oracle hash": "read-only",
  "oracle run": "local write",
  config: "read-only",
  update: "network",
};

/** `Bash(mt:*)`, which allows every command; the ask rules still prompt before a network command. */
export const ALLOW_RULES: readonly string[] = ["Bash(mt:*)"];

/** One ask rule per network command: Claude Code checks ask rules before allow rules. */
export const ASK_RULES: readonly string[] = Object.entries(COMMANDS)
  .filter(([, effect]) => effect === "network")
  .map(([command]) => `Bash(mt ${command}:*)`);

/**
 * What agents are refused, as its words after `mt`: oracles are the owner's to write and run, so
 * an agent neither runs `mt oracle` nor loads the oracle guide.
 */
export const OWNER_ONLY: readonly string[] = ["oracle", "get oracle"];

/** One deny rule per owner-only prefix: Claude Code checks deny rules before allow rules. */
export const DENY_RULES: readonly string[] = OWNER_ONLY.map((prefix) => `Bash(mt ${prefix}:*)`);
