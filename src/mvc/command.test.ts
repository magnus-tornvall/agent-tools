import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const SHAPE_FILE = new URL("../../guides/mvc/example.md", import.meta.url).pathname;
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "mt-mvc-")));
const STATE = join(TMP, "state");
const NOT_A_SHAPE = join(TMP, "not-a-shape.yaml");
writeFileSync(NOT_A_SHAPE, "outcome: x\nrisks: []\n");

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const ENV = {
  ...process.env,
  MT_LOG: join(TMP, "usage.jsonl"),
  XDG_STATE_HOME: STATE,
  GIT_CEILING_DIRECTORIES: TMP,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, env: ENV });
  if (!result.success) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

function commit(repo: string, message: string): string {
  git(repo, "commit", "-q", "--allow-empty", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

let repos = 0;
/** A clone named `name` with one commit, and a worktree of it in a directory named after its branch. */
function clone(name = "agent-tools") {
  const root = join(TMP, `clones-${++repos}`);
  const main = join(root, name);
  mkdirSync(main, { recursive: true });
  git(main, "init", "-q", "-b", "main");
  commit(main, "first");
  const worktree = join(root, "workspaces", "feat-park");
  git(main, "worktree", "add", "-q", "-b", "feat-park", worktree);
  return { main, worktree };
}

interface Run {
  cwd: string;
  stdin?: string;
  env?: Record<string, string | undefined>;
}

function mt({ cwd, stdin, env }: Run, ...args: string[]) {
  const result = Bun.spawnSync([MT, ...args], {
    cwd,
    env: { ...ENV, ...env },
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
  });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

let bodies = 0;
function bodyFile(body: string): string {
  const path = join(TMP, `body-${++bodies}.md`);
  writeFileSync(path, body);
  return path;
}

function draftAt(repo: string, slug: string): string {
  return join(STATE, "mt", "mvc", repo, slug, "draft.md");
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A draft split into its front matter, parsed, and its body as written. */
function readDraft(path: string): { frontMatter: Fields; body: string } {
  const text = readFileSync(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const frontMatter: unknown = match === null ? undefined : Bun.YAML.parse(match[1] ?? "");
  if (match === null || !isFields(frontMatter)) throw new Error(`${path} has no front matter`);
  return { frontMatter, body: text.slice(match[0].length) };
}

const ANSWERED = `## Questions

- Q1, asked: "Who writes the draft's front matter?"
  Owner: "mt does - every field comes from git or the clock.  Agreed."

---

Q2 stays open: "Where do drafts live?"
Rounds spent: 2 of 3. Ångström, tab\there, no newline at the end`;

describe("mt mvc save", () => {
  test("prints the path of the slug's draft under the state directory and writes it", () => {
    const { main } = clone();

    const result = mt({ cwd: main }, "mvc", "save", "park-1", bodyFile("Q1 open\n"));

    expect(result).toEqual({ code: 0, stdout: `${draftAt("agent-tools", "park-1")}\n`, stderr: "" });
    expect(existsSync(draftAt("agent-tools", "park-1"))).toBe(true);
  });

  test("keeps the body word for word: the question as asked and the owner's answer", () => {
    const { main } = clone();

    expect(mt({ cwd: main }, "mvc", "save", "verbatim", bodyFile(ANSWERED)).code).toBe(0);

    expect(readDraft(draftAt("agent-tools", "verbatim")).body).toBe(ANSWERED);
  });

  test("- reads the body from stdin", () => {
    const { main } = clone();

    expect(mt({ cwd: main, stdin: ANSWERED }, "mvc", "save", "stdin", "-").code).toBe(0);

    expect(readDraft(draftAt("agent-tools", "stdin")).body).toBe(ANSWERED);
  });

  test("writes repo, commit, saved and status open above the body", () => {
    const { main } = clone();
    const head = commit(main, "second");

    mt({ cwd: main }, "mvc", "save", "fields", bodyFile("body\n"));

    const { frontMatter } = readDraft(draftAt("agent-tools", "fields"));
    expect(frontMatter).toEqual({ repo: "agent-tools", commit: head, saved: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/), status: "open" });
  });

  test("records HEAD of the worktree it runs in, not of mt's clone or the main clone", () => {
    const { main, worktree } = clone();
    const mainHead = git(main, "rev-parse", "HEAD");
    const worktreeHead = commit(worktree, "on the branch");
    const mtHead = git(join(MT, "..", ".."), "rev-parse", "HEAD");

    mt({ cwd: worktree }, "mvc", "save", "head", bodyFile("body\n"));

    const { frontMatter } = readDraft(draftAt("agent-tools", "head"));
    expect(frontMatter.commit).toBe(worktreeHead);
    expect([mainHead, mtHead]).not.toContain(worktreeHead);
  });

  test("names the draft after the main clone's directory from any worktree of it", () => {
    const { main, worktree } = clone();

    const fromWorktree = mt({ cwd: worktree }, "mvc", "save", "shared", bodyFile("from the worktree\n"));
    const fromMain = mt({ cwd: main }, "mvc", "save", "shared", bodyFile("from the main clone\n"));

    expect(fromWorktree.stdout).toBe(`${draftAt("agent-tools", "shared")}\n`);
    expect(fromMain.stdout).toBe(fromWorktree.stdout);
  });

  test("finds the same draft from a subdirectory of a worktree", () => {
    const { worktree } = clone();
    const sub = join(worktree, "src", "deep");
    mkdirSync(sub, { recursive: true });

    expect(mt({ cwd: sub }, "mvc", "save", "sub", bodyFile("x\n")).stdout).toBe(`${draftAt("agent-tools", "sub")}\n`);
  });

  test("names a bare clone's drafts after the bare clone's directory", () => {
    const { main } = clone("source");
    const bare = join(TMP, "bare", "tools.git");
    git(TMP, "clone", "-q", "--bare", main, bare);
    const worktree = join(TMP, "bare", "feat");
    git(bare, "worktree", "add", "-q", worktree, "main");

    expect(mt({ cwd: worktree }, "mvc", "save", "bare", bodyFile("x\n")).stdout).toBe(`${draftAt("tools.git", "bare")}\n`);
  });

  test("replaces the slug's draft on each save", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "again", bodyFile("first save\n"));

    mt({ cwd: main }, "mvc", "save", "again", bodyFile("second save\n"));

    expect(readDraft(draftAt("agent-tools", "again")).body).toBe("second save\n");
  });

  test("writes under $HOME/.local/state when XDG_STATE_HOME is unset", () => {
    const { main } = clone("home-test");
    const home = join(TMP, "home");

    const result = mt({ cwd: main, env: { XDG_STATE_HOME: undefined, HOME: home } }, "mvc", "save", "home", bodyFile("x\n"));

    const path = join(home, ".local", "state", "mt", "mvc", "home-test", "home", "draft.md");
    expect(result.stdout).toBe(`${path}\n`);
    expect(existsSync(path)).toBe(true);
  });

  test("writes a draft that never passes mt shape check, even when its body is a shape", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "shape-body", SHAPE_FILE);

    expect(mt({ cwd: main }, "shape", "check", draftAt("agent-tools", "shape-body")).code).toBe(1);
  });

  test("exits 1 outside a git repository and writes nothing", () => {
    const outside = join(TMP, "outside");
    mkdirSync(outside, { recursive: true });

    const result = mt({ cwd: outside }, "mvc", "save", "nogit", bodyFile("x\n"));

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("not in a git repository");
    expect(existsSync(join(STATE, "mt", "mvc", "outside"))).toBe(false);
  });

  test("exits 1 in a repository with no commit", () => {
    const empty = join(TMP, "empty-repo");
    mkdirSync(empty, { recursive: true });
    git(empty, "init", "-q");

    const result = mt({ cwd: empty }, "mvc", "save", "nocommit", bodyFile("x\n"));

    expect(result.code).toBe(1);
    expect(existsSync(draftAt("empty-repo", "nocommit"))).toBe(false);
  });

  test("exits 1 naming a body file it cannot read, and leaves the draft as it was", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "kept", bodyFile("kept\n"));

    const result = mt({ cwd: main }, "mvc", "save", "kept", join(TMP, "missing.md"));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("missing.md");
    expect(readDraft(draftAt("agent-tools", "kept")).body).toBe("kept\n");
  });

  test("exits 2 with usage on a slug that breaks mt's name rule", () => {
    const { main } = clone();
    for (const slug of ["../escape", "a/b", ".hidden", "-x", ""]) {
      expect(mt({ cwd: main }, "mvc", "save", slug, bodyFile("x\n"))).toMatchObject({ code: 2, stdout: "" });
    }
    expect(existsSync(join(STATE, "mt", "mvc", "escape"))).toBe(false);
  });

  test("exits 2 with usage without exactly a slug and a file", () => {
    const { main } = clone();
    const file = bodyFile("x\n");
    expect(mt({ cwd: main }, "mvc", "save")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "save", "only-slug")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "save", "slug", file, file)).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "save", "slug", "--force")).toMatchObject({ code: 2, stdout: "" });
  });
});

describe("mt mvc close", () => {
  test("exits 0 and closes the draft when the file is a shape, leaving the rest of the draft as saved", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "done", bodyFile(ANSWERED));
    const saved = readDraft(draftAt("agent-tools", "done"));

    const result = mt({ cwd: main }, "mvc", "close", "done", SHAPE_FILE);

    expect(result).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(readDraft(draftAt("agent-tools", "done"))).toEqual({ frontMatter: { ...saved.frontMatter, status: "closed" }, body: ANSWERED });
  });

  test("exits 1 with the check's violations on stderr and leaves the draft open", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "failing", bodyFile("Q1 open\n"));
    const before = readFileSync(draftAt("agent-tools", "failing"), "utf8");
    const checked = mt({ cwd: main }, "shape", "check", NOT_A_SHAPE);
    expect(checked.code).toBe(1);

    const result = mt({ cwd: main }, "mvc", "close", "failing", NOT_A_SHAPE);

    expect(result).toEqual({ code: 1, stdout: "", stderr: checked.stderr });
    expect(readFileSync(draftAt("agent-tools", "failing"), "utf8")).toBe(before);
    expect(readDraft(draftAt("agent-tools", "failing")).frontMatter.status).toBe("open");
  });

  test("closes a draft parked from another worktree of the same clone", () => {
    const { main, worktree } = clone();
    mt({ cwd: worktree }, "mvc", "save", "across", bodyFile("parked in the worktree\n"));

    expect(mt({ cwd: main }, "mvc", "close", "across", SHAPE_FILE).code).toBe(0);

    expect(readDraft(draftAt("agent-tools", "across")).frontMatter.status).toBe("closed");
  });

  test("exits 1 on a slug with no draft, naming where it looked", () => {
    const { main } = clone();

    const result = mt({ cwd: main }, "mvc", "close", "never-saved", SHAPE_FILE);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(draftAt("agent-tools", "never-saved"));
    expect(existsSync(draftAt("agent-tools", "never-saved"))).toBe(false);
  });

  test("exits 1 on a shape file it cannot read and leaves the draft open", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "unread", bodyFile("x\n"));

    const result = mt({ cwd: main }, "mvc", "close", "unread", join(TMP, "missing.yaml"));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("missing.yaml");
    expect(readDraft(draftAt("agent-tools", "unread")).frontMatter.status).toBe("open");
  });

  test("exits 1 on a draft whose front matter is not mt's, and leaves it alone", () => {
    const { main } = clone();
    mt({ cwd: main }, "mvc", "save", "edited", bodyFile("x\n"));
    writeFileSync(draftAt("agent-tools", "edited"), "no front matter\n");

    const result = mt({ cwd: main }, "mvc", "close", "edited", SHAPE_FILE);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("front matter");
    expect(readFileSync(draftAt("agent-tools", "edited"), "utf8")).toBe("no front matter\n");
  });

  test("exits 2 with usage without exactly a slug and a shape file, or on a bad slug", () => {
    const { main } = clone();
    expect(mt({ cwd: main }, "mvc", "close")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "close", "slug")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "close", "slug", SHAPE_FILE, SHAPE_FILE)).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "close", "slug", "-")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc", "close", "../slug", SHAPE_FILE)).toMatchObject({ code: 2, stdout: "" });
  });
});

describe("mt mvc", () => {
  test("exits 2 with usage on an unknown or missing subcommand", () => {
    const { main } = clone();
    expect(mt({ cwd: main }, "mvc", "resume", "x")).toMatchObject({ code: 2, stdout: "" });
    expect(mt({ cwd: main }, "mvc")).toMatchObject({ code: 2, stdout: "" });
  });
});
