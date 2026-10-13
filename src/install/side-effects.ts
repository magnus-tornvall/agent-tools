/**
 * Each mt command's side-effect class, declared once here, and the Claude Code permission rules
 * install builds from them. The README's contract for each command states the same class.
 *
 *   read-only     reads files and prints; writes nothing
 *   local write   writes on this machine only, such as the usage log or the JUnit report `mt oracle run` deletes
 *
 * A class covers what mt itself does. `mt oracle run` runs a shape's commands, which may reach
 * further. It is allowed so a worker runs its oracles without a prompt, and nothing checks who
 * wrote or approved the shape it runs.
 *
 * Every class stays on this machine, so every command is allowed.
 */

export type SideEffect = "read-only" | "local write";

/** Each command as its words after `mt`, the way its usage line names it. */
export const COMMANDS: Readonly<Record<string, SideEffect>> = {
  get: "local write",
  list: "read-only",
  "shape check": "read-only",
  "shape slice": "read-only",
  "oracle hash": "read-only",
  "oracle run": "local write",
  config: "read-only",
};

/** `Bash(mt:*)`, which allows every command, as every class is allowed. */
export const ALLOW_RULES: readonly string[] = ["Bash(mt:*)"];
