import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMtUsage } from "../guide-lint/lint.ts";
import { COMMANDS, OWNER_ONLY, rules } from "./side-effects.ts";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const GUIDES = new URL("../../guides/", import.meta.url).pathname;

/** The command of each `mt …` line of mt's usage, as guide-lint reads them. */
function usageCommands(): string[] {
  return [...new Set(parseMtUsage(usage()).map((words) => words.join(" ")))].sort();
}

function usage(): string {
  const scratch = mkdtempSync(join(tmpdir(), "mt-side-effects-"));
  try {
    const result = Bun.spawnSync([MT, "--help"], { env: { ...process.env, MT_LOG: join(scratch, "usage.jsonl"), XDG_STATE_HOME: scratch } });
    return result.stdout.toString();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

describe("side-effect classes", () => {
  test("every command mt's usage lists has a class, and every class names a command the usage lists", () => {
    expect(usageCommands()).toEqual(Object.keys(COMMANDS).sort());
  });

  test("D9: get and oracle run are local writes, dogfood and its triage external, the rest read-only", () => {
    expect(COMMANDS).toEqual({
      get: "local write",
      list: "read-only",
      "shape check": "read-only",
      "shape slice": "read-only",
      "oracle hash": "read-only",
      "oracle run": "local write",
      dogfood: "external",
      "dogfood triage": "external",
      config: "read-only",
    });
  });

  test("C3: install allows Bash(mt:*) and asks only Bash(mt dogfood:*), which covers dogfood triage", () => {
    expect(rules().allow).toEqual(["Bash(mt:*)"]);
    expect(rules().ask).toEqual(["Bash(mt dogfood:*)"]);
  });

  test("R1: install denies agents every mt oracle command and the oracle guide", () => {
    expect(rules().deny).toEqual(["Bash(mt oracle:*)", "Bash(mt get oracle:*)"]);
  });

  test("every owner-only prefix covers a command mt's usage lists, or names a guide get serves", () => {
    const commands = usageCommands();
    for (const prefix of OWNER_ONLY) {
      const [first, guide] = prefix.split(" ");
      const served = first === "get" && guide !== undefined && existsSync(join(GUIDES, `${guide}.md`));
      const listed = commands.some((command) => command === prefix || command.startsWith(`${prefix} `));
      expect({ prefix, found: served || listed }).toEqual({ prefix, found: true });
    }
  });

  test("D8: an external command gets its own ask rule unless a shorter external one covers it", () => {
    expect(rules({ list: "read-only", publish: "external", "oracle run": "local write", "publish all": "external", dogfood: "external" }, [])).toEqual({
      allow: ["Bash(mt:*)"],
      ask: ["Bash(mt publish:*)", "Bash(mt dogfood:*)"],
      deny: [],
    });
    expect(rules({ dogfoodx: "external", dogfood: "external" }).ask).toEqual(["Bash(mt dogfoodx:*)", "Bash(mt dogfood:*)"]);
    expect(rules({ get: "local write", list: "read-only" }, [])).toEqual({ allow: ["Bash(mt:*)"], ask: [], deny: [] });
  });
});
