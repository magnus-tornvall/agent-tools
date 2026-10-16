/**
 * guide-lint: gathers a repo's guides, stub skills and AGENTS.md, runs mt and orca, and reports
 * each mention that no longer resolves or that names a platform's command outside that platform's
 * reference; src/guide-lint/PART.md is its contract.
 *
 *   bun src/guide-lint/main.ts <repo>
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { checkMtMention, checkOrcaMention, checkPlacement, fixedHomes, fixedLines, homeFiles, isPlaceholderMention, isSectionName, parseMtUsage, readOrcaContext, spans, type MtGet } from "./lint.ts";

const root = process.argv[2];
if (root === undefined) {
  process.stderr.write("usage: bun src/guide-lint/main.ts <repo>\n");
  process.exit(2);
}

/** The repo as a string: a function declared below does not see the narrowing above. */
const repo: string = root;
const mt = join(root, "cli", "mt");

function runMt(...args: string[]) {
  return Bun.spawnSync([process.execPath, mt, ...args], { stdin: "ignore" });
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name));
}

const guides = markdownFiles(join(root, "guides"));
const skills = join(root, "skills");
const stubs = (existsSync(skills) ? readdirSync(skills) : [])
  .map((name) => join(skills, name, "SKILL.md"))
  .filter((file) => existsSync(file) && statSync(file).isFile());
const charter = [join(root, "AGENTS.md")].filter((file) => existsSync(file) && statSync(file).isFile());

interface Mention {
  file: string;
  line: number;
  text: string;
  words: string[];
}

const mentions: Mention[] = [...guides, ...stubs, ...charter].sort().flatMap((path) => {
  const file = relative(root, path);
  return spans(readFileSync(path, "utf8")).map(({ line, text }) => ({ file, line, text, words: text.split(" ") }));
});

const failures: string[] = [];
const fail = ({ file, line, text }: Mention, reason: string) => failures.push(`${file}:${line}: \`${text}\`: ${reason}`);

/** The number of mt mentions checked and of placeholder mentions skipped. */
function lintMt(): { checked: number; skipped: number } {
  const help = runMt("--help");
  const verbs = parseMtUsage(help.stdout.toString());
  if (!help.success || verbs.length === 0) {
    failures.push(`guide-lint: \`mt --help\` exited ${help.exitCode} without usage; mt did not run, so no mt mention was checked`);
    return { checked: 0, skipped: 0 };
  }
  const answers = new Map<string, ReturnType<MtGet>>();
  const mtGet: MtGet = (args) => {
    const key = args.join("\0");
    let answer = answers.get(key);
    if (answer === undefined) {
      const result = runMt("get", ...args);
      answer = { status: result.exitCode, error: firstLine(result.stderr.toString()) };
      answers.set(key, answer);
    }
    return answer;
  };
  const mtMentions = mentions.filter(({ words }) => words[0] === "mt");
  for (const mention of mtMentions) {
    const reason = checkMtMention(mention.words, verbs, mtGet);
    if (reason !== null) fail(mention, reason);
  }
  const skipped = mtMentions.filter(({ words }) => isPlaceholderMention(words)).length;
  return { checked: mtMentions.length - skipped, skipped };
}

/** The number of Orca mentions checked, or null when orca is not on PATH. */
function lintOrca(): number | null {
  if (Bun.which("orca") === null) {
    console.log("guide-lint: orca is not on PATH; skipped the Orca part");
    return null;
  }
  const result = Bun.spawnSync(["orca", "agent-context", "--json"], { stdin: "ignore" });
  if (!result.success) {
    failures.push(`guide-lint: \`orca agent-context --json\` exited ${result.exitCode}: ${firstLine(result.stderr.toString())}`);
    return 0;
  }
  let context: unknown;
  try {
    context = JSON.parse(result.stdout.toString());
  } catch (error) {
    failures.push(`guide-lint: \`orca agent-context --json\` did not print JSON: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
  const table = readOrcaContext(context);
  if (typeof table === "string") {
    failures.push(`guide-lint: ${table}`);
    return 0;
  }
  const orcaMentions = mentions.filter(({ words }) => words[0] === "orca");
  for (const mention of orcaMentions) {
    const reason = checkOrcaMention(mention.words, table);
    if (reason !== null) fail(mention, reason);
  }
  return orcaMentions.length;
}

/** Fails each mention of a platform's command outside that platform's reference. */
function lintPlacement(references: string): void {
  const platforms = new Set(
    (existsSync(references) ? readdirSync(references) : []).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)),
  );
  for (const mention of mentions) {
    const reason = checkPlacement(mention.file, mention.words, platforms);
    if (reason !== null) fail(mention, reason);
  }
}

/** Fails each mention of a spec section that the spec guide does not declare: a judge's reference names sections it never sees declared. */
function lintSections(): void {
  const spec = join(repo, "guides", "spec.md");
  if (!existsSync(spec)) return;
  const declared = new Set(spans(readFileSync(spec, "utf8")).map(({ text }) => text).filter(isSectionName));
  if (declared.size === 0) return;
  for (const mention of mentions) {
    if (mention.file === "guides/spec.md" || !isSectionName(mention.text) || declared.has(mention.text)) continue;
    fail(mention, "the spec guide declares no such section");
  }
}

/** Fails a home the charter names that carries no fixed rule, and a fixed rule in a part the charter names no home. */
function lintFixed(): void {
  const charterPath = charter[0];
  if (charterPath === undefined) return;
  const homes = new Set<string>();
  const references = (tool: string) => markdownFiles(join(repo, "guides", tool)).map((file) => basename(file, ".md"));
  for (const home of fixedHomes(readFileSync(charterPath, "utf8"))) {
    for (const file of homeFiles(home.text.split(" "), references)) {
      homes.add(file);
      const path = join(repo, file);
      if (existsSync(path) && fixedLines(readFileSync(path, "utf8")).length === 0) {
        failures.push(`AGENTS.md:${home.line}: \`${home.text}\`: the charter names it a home, but it carries no fixed rule`);
      }
    }
  }
  if (homes.size === 0) return;
  for (const path of [...guides, ...stubs].sort()) {
    const file = relative(repo, path);
    if (homes.has(file)) continue;
    for (const line of fixedLines(readFileSync(path, "utf8"))) {
      failures.push(`${file}:${line}: a fixed rule outside the homes the charter names`);
    }
  }
}

if (guides.length === 0) failures.push(`guide-lint: found no guides under ${join(root, "guides")}`);
lintPlacement(join(root, "guides", "coordinate"));
lintSections();
lintFixed();
const { checked: mtChecked, skipped } = lintMt();
const orcaChecked = lintOrca();

if (failures.length > 0) {
  console.log(failures.join("\n"));
  process.exit(1);
}
const checked = orcaChecked === null ? `${mtChecked} mt mentions` : `${mtChecked} mt mentions and ${orcaChecked} Orca mentions`;
console.log(`guide-lint: ${checked} resolve; placeholder mentions skipped: ${skipped}`);
