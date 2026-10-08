/**
 * Builds the scripts and assets each skill runs into that skill's own folder, so a skill shared
 * through Orca works without this repository:
 *
 *   bun run build-skills
 *
 * A skill's SKILL.md references these files by paths relative to its own root. A test fails while
 * a skill's copy is stale.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Per skill, the entry points bundled into its scripts/ and the files copied into its assets/. */
const SKILLS: Record<string, { readonly scripts: readonly string[]; readonly assets: readonly string[] }> = {
  mvc: { scripts: ["src/shape/shape-check.ts"], assets: ["src/shape/fixtures/example.yaml"] },
};

/** Writes every skill's built files under `<root>/skills/` and returns their paths relative to `root`. */
export async function buildSkills(root: string): Promise<string[]> {
  const written: string[] = [];
  for (const [skill, { scripts, assets }] of Object.entries(SKILLS)) {
    const scriptsDir = join("skills", skill, "scripts");
    const result = await Bun.build({
      entrypoints: scripts.map((script) => join(ROOT, script)),
      outdir: join(root, scriptsDir),
      naming: "[name].[ext]",
      target: "bun",
      minify: true,
    });
    if (!result.success) throw new AggregateError(result.logs, `building ${skill}'s scripts failed`);
    written.push(...result.outputs.map((output) => join(scriptsDir, basename(output.path))));

    const assetsDir = join("skills", skill, "assets");
    if (assets.length > 0) mkdirSync(join(root, assetsDir), { recursive: true });
    for (const asset of assets) {
      copyFileSync(join(ROOT, asset), join(root, assetsDir, basename(asset)));
      written.push(join(assetsDir, basename(asset)));
    }
  }
  return written;
}

if (import.meta.main) {
  await buildSkills(ROOT);
}
