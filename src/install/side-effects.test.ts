import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMtUsage } from "../guide-lint/lint.ts";
import { ASK_RULES, COMMANDS, DENY_RULES, OWNER_ONLY } from "./side-effects.ts";

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

  test("D9, D5: get and oracle run are local writes, update network, the rest read-only", () => {
    expect(COMMANDS).toEqual({
      get: "local write",
      list: "read-only",
      "shape check": "read-only",
      "shape slice": "read-only",
      "oracle hash": "read-only",
      "oracle run": "local write",
      config: "read-only",
      update: "network",
    });
  });

  test("D3: install asks before an agent runs mt update, the one network command", () => {
    expect(ASK_RULES).toEqual(["Bash(mt update:*)"]);
  });

  test("R1: install denies agents every mt oracle command and the oracle guide", () => {
    expect(DENY_RULES).toEqual(["Bash(mt oracle:*)", "Bash(mt get oracle:*)"]);
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
});
