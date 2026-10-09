/**
 * guide-lint: fails, one `file:line: `mention`: reason` line each, when a guide or stub skill
 * mentions in backticks an mt guide, reference or command, or an Orca command or flag, that no
 * longer exists.
 *
 *   bun src/guide-lint/main.ts <repo>
 *
 * It runs only `mt get` and `mt --help`, with MT_LOG on a throwaway file so the owner's usage log
 * is left alone, and `orca agent-context --json` when orca is on PATH. Without orca it checks the
 * mt mentions only and says so in one line.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { checkMtMention, checkOrcaMention, isPlaceholderMention, parseMtUsage, readOrcaContext, spans, type MtGet } from "./lint.ts";

const root = process.argv[2];
if (root === undefined) {
  process.stderr.write("usage: bun src/guide-lint/main.ts <repo>\n");
  process.exit(2);
}

const mt = join(root, "cli", "mt");
const scratch = mkdtempSync(join(tmpdir(), "guide-lint-"));
const mtEnv = { ...process.env, MT_LOG: join(scratch, "usage.jsonl") };

function runMt(...args: string[]) {
  return Bun.spawnSync([process.execPath, mt, ...args], { env: mtEnv, stdin: "ignore" });
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

interface Mention {
  file: string;
  line: number;
  text: string;
  words: string[];
}

const mentions: Mention[] = [...guides, ...stubs].sort().flatMap((path) => {
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

let mtChecked = 0;
let skipped = 0;
let orcaChecked: number | null = null;
try {
  if (guides.length === 0) failures.push(`guide-lint: found no guides under ${join(root, "guides")}`);
  ({ checked: mtChecked, skipped } = lintMt());
  orcaChecked = lintOrca();
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.log(failures.join("\n"));
  process.exit(1);
}
const checked = orcaChecked === null ? `${mtChecked} mt mentions` : `${mtChecked} mt mentions and ${orcaChecked} Orca mentions`;
console.log(`guide-lint: ${checked} resolve; placeholder mentions skipped: ${skipped}`);
