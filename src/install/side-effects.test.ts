import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMtUsage } from "../guide-lint/lint.ts";
import { COMMANDS, rules } from "./side-effects.ts";

const MT = new URL("../../cli/mt", import.meta.url).pathname;

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

  test("D9: get and oracle run are local writes, the rest read-only", () => {
    expect(COMMANDS).toEqual({
      get: "local write",
      list: "read-only",
      "shape check": "read-only",
      "shape slice": "read-only",
      "oracle hash": "read-only",
      "oracle run": "local write",
      config: "read-only",
    });
  });

  test("install allows Bash(mt:*) and asks nothing, as no command is external", () => {
    expect(rules()).toEqual({ allow: ["Bash(mt:*)"], ask: [] });
  });

  test("D8: an external command gets its own ask rule unless a shorter external one covers it", () => {
    expect(rules({ list: "read-only", publish: "external", "oracle run": "local write", "publish all": "external", dogfood: "external" })).toEqual({
      allow: ["Bash(mt:*)"],
      ask: ["Bash(mt publish:*)", "Bash(mt dogfood:*)"],
    });
    expect(rules({ dogfoodx: "external", dogfood: "external" }).ask).toEqual(["Bash(mt dogfoodx:*)", "Bash(mt dogfood:*)"]);
    expect(rules({ get: "local write", list: "read-only" })).toEqual({ allow: ["Bash(mt:*)"], ask: [] });
  });
});
