/**
 * `mt mvc`, which cli/mt loads only when it is called. It parks an mvc grill as a draft and closes
 * it; the agent finds a draft to resume by its documented location, so there is no resume command.
 *
 *   mt mvc save <slug> <file>           the draft's path on stdout; - reads the body from stdin
 *   mt mvc close <slug> <shape-file>    nothing and exit 0 once the shape passes `mt shape check`,
 *                                       otherwise the check's violations and exit 1
 *
 * A slug has one draft, at ${XDG_STATE_HOME:-$HOME/.local/state}/mt/mvc/<repo>/<slug>/draft.md,
 * where <repo> is the name of the git common directory, or of its parent when that is named .git:
 * the main clone's directory, shared by every worktree of the clone.
 * Its front matter is mt's: repo, commit (HEAD of the repo save runs in), saved and status, open
 * or closed. The body is the agent's, written verbatim; mt never checks it.
 *
 * Usage errors exit 2; outside a git repository, an unknown slug, an unreadable file or a draft it
 * cannot write exit 1.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const USAGE = `usage: mt mvc save <slug> <file>
       mt mvc close <slug> <shape-file>
`;

class UsageError extends Error {}

class Failure extends Error {}

interface Repo {
  name: string;
  commit: string;
}

function git(...args: string[]): string | null {
  if (Bun.which("git") === null) return null;
  const result = Bun.spawnSync(["git", ...args], { stderr: "ignore" });
  const out = result.stdout.toString().trim();
  return result.success && out !== "" ? out : null;
}

/** The repo the caller is in: its main clone's directory name, and HEAD. */
function currentRepo(): Repo {
  const common = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  if (common === null) throw new Failure("not in a git repository");
  // A bare clone's common directory is the clone itself; otherwise it is the clone's .git.
  const name = basename(common) === ".git" ? basename(dirname(common)) : basename(common);
  const commit = git("rev-parse", "--verify", "HEAD");
  if (commit === null) throw new Failure(`${name} has no commit yet`);
  return { name, commit };
}

function draftPath(repo: string, slug: string): string {
  const env = process.env;
  const state = env.XDG_STATE_HOME || join(env.HOME ?? "", ".local/state");
  return join(state, "mt", "mvc", repo, slug, "draft.md");
}

function read(file: string | 0): string {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Failure(`cannot read '${file === 0 ? "-" : file}': ${reason}`);
  }
}

/** Writes beside the draft and renames over it, so an interrupted write never truncates the only copy. */
function write(path: string, text: string): void {
  const temp = `${path}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temp, text);
    renameSync(temp, path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (existsSync(temp)) rmSync(temp);
    throw new Failure(`cannot write ${path}: ${reason}`);
  }
}

type FrontMatter = Record<string, unknown>;

function draft(frontMatter: FrontMatter, body: string): string {
  return `---\n${Bun.YAML.stringify(frontMatter, null, 2)}\n---\n${body}`;
}

/** A draft split into the front matter mt wrote and the agent's body, untouched. */
function parseDraft(path: string, text: string): { frontMatter: FrontMatter; body: string } {
  const malformed = new Failure(`${path} does not open with the front matter mt writes`);
  const end = text.startsWith("---\n") ? text.indexOf("\n---\n", 3) : -1;
  if (end === -1) throw malformed;
  let frontMatter: unknown;
  try {
    frontMatter = Bun.YAML.parse(text.slice(4, end));
  } catch {
    throw malformed;
  }
  if (typeof frontMatter !== "object" || frontMatter === null || Array.isArray(frontMatter)) throw malformed;
  return { frontMatter: { ...frontMatter }, body: text.slice(end + "\n---\n".length) };
}

function operands(command: string, args: readonly string[], second: string, validName: (name: string) => boolean): [string, string] {
  const [slug, file, ...rest] = args;
  if (slug === undefined || file === undefined || rest.length > 0) throw new UsageError(`${command} takes a slug and a ${second}`);
  if (slug.startsWith("-") || !validName(slug)) throw new UsageError(`not a slug: '${slug}'`);
  if (file.startsWith("-") && !(command === "save" && file === "-")) throw new UsageError(`unknown option '${file}'`);
  return [slug, file];
}

function save(args: readonly string[], validName: (name: string) => boolean): number {
  const [slug, file] = operands("save", args, "file", validName);
  const body = read(file === "-" ? 0 : file);
  const repo = currentRepo();
  const path = draftPath(repo.name, slug);
  const saved = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  write(path, draft({ repo: repo.name, commit: repo.commit, saved, status: "open" }, body));
  process.stdout.write(`${path}\n`);
  return 0;
}

async function close(args: readonly string[], validName: (name: string) => boolean): Promise<number> {
  const [slug, shapeFile] = operands("close", args, "shape file", validName);
  const repo = currentRepo();
  const path = draftPath(repo.name, slug);
  if (!existsSync(path)) throw new Failure(`no draft '${slug}' for ${repo.name}, looked for ${path}`);
  const { frontMatter, body } = parseDraft(path, read(path));
  const { runShape }: typeof import("../shape/command.ts") = await import("../shape/command.ts");
  const checked = runShape(["check", shapeFile]);
  if (checked !== 0) return checked;
  write(path, draft({ ...frontMatter, status: "closed" }, body));
  return 0;
}

/** `mt mvc <args>`; validName is mt's rule for a name, which a slug follows. */
export async function runMvc(args: readonly string[], validName: (name: string) => boolean): Promise<number> {
  const [subcommand, ...rest] = args;
  try {
    switch (subcommand) {
      case "save":
        return save(rest, validName);
      case "close":
        return await close(rest, validName);
      default:
        throw new UsageError(subcommand === undefined ? "mvc needs save or close" : `unknown mvc command '${subcommand}'`);
    }
  } catch (error) {
    if (error instanceof Failure) {
      process.stderr.write(`mt: ${error.message}\n`);
      return 1;
    }
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`mt: ${error.message}\n${USAGE}`);
    return 2;
  }
}
