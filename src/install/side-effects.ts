/**
 * Each mt command's side-effect class, declared once here, and the Claude Code permission rules
 * install builds from them. The README's contract for each command states the same class.
 *
 *   read-only     reads files and prints; writes nothing
 *   local write   writes on this machine only, such as the usage log or the JUnit report `mt oracle run` deletes
 *   external      reaches a service off this machine, such as GitHub or jev
 *
 * A class covers what mt itself does. `mt oracle run` runs a shape's commands, which may reach
 * further, and is allowed because the owner approved the shape.
 *
 * Every class but external is allowed; each external command is asked before it runs.
 */

export type SideEffect = "read-only" | "local write" | "external";

/** Each command as its words after `mt`, the way its usage line names it. */
export const COMMANDS: Readonly<Record<string, SideEffect>> = {
  get: "local write",
  list: "read-only",
  "shape check": "read-only",
  "shape slice": "read-only",
  "oracle hash": "read-only",
  "oracle run": "local write",
  dogfood: "external",
  "dogfood triage": "external",
  config: "read-only",
};

export interface Rules {
  allow: string[];
  ask: string[];
}

/**
 * `Bash(mt:*)` allowed, and one ask rule per external command that no shorter one covers: Claude
 * Code checks ask rules before allow rules, and `Bash(mt dogfood:*)` covers `mt dogfood triage` by
 * prefix.
 */
export function rules(commands: Readonly<Record<string, SideEffect>> = COMMANDS): Rules {
  const external = Object.keys(commands).filter((command) => commands[command] === "external");
  const covers = (shorter: string, command: string) => command === shorter || command.startsWith(`${shorter} `);
  const asked = external.filter((command) => !external.some((other) => other !== command && covers(other, command)));
  return { allow: ["Bash(mt:*)"], ask: asked.map((command) => `Bash(mt ${command}:*)`) };
}
