import { describe, expect, test } from "bun:test";
import { parseMtUsage } from "../guide-lint/lint.ts";
import { ASK_RULES, COMMANDS } from "./side-effects.ts";

const MT = new URL("../../cli/mt", import.meta.url).pathname;

/** The command of each `mt …` line of mt's usage, as guide-lint reads them. */
function usageCommands(): string[] {
  return [...new Set(parseMtUsage(usage()).map((words) => words.join(" ")))].sort();
}

function usage(): string {
  return Bun.spawnSync([MT, "--help"]).stdout.toString();
}

describe("side-effect classes", () => {
  test("every command mt's usage lists has a class, and every class names a command the usage lists", () => {
    expect(usageCommands()).toEqual(Object.keys(COMMANDS).sort());
  });

  test("D2: update is network, the rest read-only", () => {
    expect(COMMANDS).toEqual({
      get: "read-only",
      list: "read-only",
      "shape check": "read-only",
      "shape slice": "read-only",
      config: "read-only",
      update: "network",
    });
  });

  test("D3: install asks before an agent runs mt update, the one network command", () => {
    expect(ASK_RULES).toEqual(["Bash(mt update:*)"]);
  });
});
