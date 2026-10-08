import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkills } from "./build-skills.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Each file's hash by path, so a stale bundle fails without printing half a megabyte. */
function hashes(root: string, paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(paths.map((path) => [path, Bun.hash(readFileSync(join(root, path))).toString(16)]));
}

describe("skills' built files", () => {
  test("are a fresh build of src/; run `bun run build-skills` when this fails", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "build-skills-"));
    const written = await buildSkills(fresh);
    const committed = [...new Set(written.map(dirname))].flatMap((dir) =>
      readdirSync(join(ROOT, dir)).map((file) => join(dir, file)),
    );

    expect(hashes(ROOT, committed)).toEqual(hashes(fresh, written));
  });

  test("mvc's bundled shape-check passes mvc's bundled example", () => {
    const skill = join(ROOT, "skills", "mvc");
    const result = Bun.spawnSync(["bun", "scripts/shape-check.js", "assets/example.yaml"], { cwd: skill });

    expect({ code: result.exitCode, stderr: result.stderr.toString() }).toEqual({ code: 0, stderr: "" });
  });
});
