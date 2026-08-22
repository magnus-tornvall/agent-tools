#!/usr/bin/env bun
//
// Builds the prompt for one arm of a live run: the tasks-phase rules from SKILL.md, an
// approved change.md, and a file listing standing in for the repository.
//
// The control arm is extracted from SKILL.md rather than copied, so it cannot drift from the
// skill it is supposed to be measuring. The candidate arm is the same text plus the files in
// candidate/ - so the diff between arms is exactly the wording under test and nothing else.
//
// Usage: bun render.ts <fixture> [--candidate | --variant=<dir>]

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const HERE = dirname(Bun.fileURLToPath(import.meta.url));
const SKILL = join(HERE, "..", "..", "..", "SKILL.md");
const FIXTURES = join(HERE, "..", "fixtures");

/** The body under a heading, up to the next heading at the same or a shallower depth. */
function section(md: string, heading: string): string {
  const depth = heading.match(/^#+/)![0].length;
  const start = md.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`SKILL.md has no heading "${heading}" - the extractor is stale`);
  const rest = md.slice(start + 1);
  const next = rest.slice(heading.length).search(new RegExp(`\\n#{1,${depth}} `));
  return (next < 0 ? rest : rest.slice(0, heading.length + next)).trimEnd();
}

// An arm is a directory of wording to splice in, so a third arm costs a directory rather
// than a code change - which is what it took to separate "both additions" from "one of them".
const [fixture, ...flags] = process.argv.slice(2);
const variantFlag = flags.find((f) => f.startsWith("--variant="))?.split("=")[1];
const variant = variantFlag ?? (flags.includes("--candidate") ? "candidate" : null);
if (!fixture) {
  console.error("usage: render.ts <fixture> [--candidate | --variant=<dir under prompts/>]");
  process.exit(2);
}

const dir = join(FIXTURES, fixture);
if (!existsSync(dir)) {
  console.error(`no fixture "${fixture}"`);
  process.exit(2);
}

const skill = readFileSync(SKILL, "utf8");
let tasks = section(skill, "### tasks");

if (variant) {
  const rule = readFileSync(join(HERE, variant, "rule.md"), "utf8").trim();
  const extra = readFileSync(join(HERE, variant, "checklist.md"), "utf8").trim();
  const marker = "**Reader's checklist**:";
  if (!tasks.includes(marker)) throw new Error("tasks section has no reader's checklist to anchor to");
  tasks = tasks.replace(marker, `${rule}\n\n${marker}`).trimEnd() + ` ${extra}`;
}

console.log(`You are drafting the \`tasks\` phase of a mise-en-place change. The \`spec\` and
\`plan\` below are approved: treat every field in them as decided, and do not revise them.

Write one file per task into \`tasks/\`, each in the shape given below. Write nothing else -
no code, no tests, no commentary. Invent nothing that the spec, the plan, or the file listing
does not already determine.

## The rules for this phase

${tasks}

${section(skill, "## Anchors")}

${section(skill, "## tasks/T1.md shape")}

## The change

\`\`\`
${readFileSync(join(dir, "change.md"), "utf8").trim()}
\`\`\`

## The repository

Every file that exists today, with the symbols each one exports. A task may scope a path that
does not exist yet.

\`\`\`
${readFileSync(join(dir, "repo.txt"), "utf8").trim()}
\`\`\`
`);
