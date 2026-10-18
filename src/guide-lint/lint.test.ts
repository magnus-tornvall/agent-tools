import { describe, expect, test } from "bun:test";
import { checkMtMention, checkOrcaMention, checkPlacement, fixedHomes, fixedLines, homeFiles, isPlaceholderMention, isSectionName, parseMtUsage, readOrcaContext, spans, type MtGet, type OrcaTable } from "./lint.ts";

const USAGE = `usage: mt get <tool> [--ref <ref>]   print the guide for a tool
       mt list                       list every tool
       mt pin add <file>             keep a file at hand
       mt pin drop <file> --all
                                     let go of it
       mt --help                     show this usage
`;

const VERBS = parseMtUsage(USAGE);

const exits = (status: number | null, error = ""): MtGet => () => ({ status, error });

function mtMention(text: string, mtGet: MtGet = exits(0)): string | null {
  return checkMtMention(text.split(" "), VERBS, mtGet);
}

function orcaTable(): OrcaTable {
  const table = readOrcaContext({
    schemaVersion: 1,
    commands: [
      { command: "orchestration ask", path: ["orchestration", "ask"], aliases: [], flags: ["help", "options"] },
      { command: "orchestration worker-list", path: ["orchestration", "worker-list"], aliases: [], flags: ["terminal-state"] },
      { command: "skills get", path: ["skills", "get"], aliases: [["skills", "show"]], flags: ["json"] },
    ],
  });
  if (typeof table === "string") throw new Error(table);
  return table;
}

function orcaMention(text: string): string | null {
  return checkOrcaMention(text.split(" "), orcaTable());
}

describe("spans", () => {
  test("gives each span its first line and joins a span wrapped onto the next line", () => {
    const found = spans("# t\n\nRun `mt get\n  ask` then\n`mt list`.\n");
    expect(found).toEqual([
      { line: 3, text: "mt get ask" },
      { line: 5, text: "mt list" },
    ]);
  });

  test("reads a span inside a fenced block and skips the fence lines", () => {
    expect(spans("```md\nRun `mt list`.\n```\n")).toEqual([{ line: 2, text: "mt list" }]);
  });

  test("reads a double-backtick span that holds a backtick", () => {
    expect(spans("Say ``a ` b`` now.")).toEqual([{ line: 1, text: "a ` b" }]);
  });

  test("ignores an unclosed backtick", () => {
    expect(spans("a ` b\n")).toEqual([]);
  });
});

describe("parseMtUsage", () => {
  test("takes the plain words before the column gap, not the description after it", () => {
    expect(VERBS).toEqual([["get"], ["list"], ["pin", "add"], ["pin", "drop"]]);
  });

  test("a command word may hold a digit", () => {
    expect(parseMtUsage("       mt oauth2 login <file>        sign in\n")).toEqual([["oauth2", "login"]]);
  });
});

describe("checkMtMention", () => {
  test("passes a mt get that resolves and names the guide when it does not", () => {
    expect(mtMention("mt get ask")).toBeNull();
    expect(mtMention("mt get ask", exits(1))).toBe("mt get finds no such guide");
  });

  test("names the reference when a --ref does not resolve", () => {
    expect(mtMention("mt get ask --ref stance", exits(1))).toBe("mt get finds no such reference");
  });

  test("passes the mention's arguments to mt get as written", () => {
    const seen: string[][] = [];
    mtMention("mt get ask --ref=stance", (args) => (seen.push([...args]), { status: 2, error: "" }));
    expect(seen).toEqual([["ask", "--ref=stance"]]);
    expect(mtMention("mt get ask --ref=stance", exits(2))).toBe("mt get rejects these arguments");
  });

  test("reports any other exit status of mt get with its first line of stderr", () => {
    expect(mtMention("mt get ask", exits(137, "Killed"))).toBe("mt get exited 137: Killed");
    expect(mtMention("mt get ask", exits(null))).toBe("mt get exited without a status: ");
  });

  test("skips a placeholder in place of a tool, running nothing", () => {
    const run = () => {
      throw new Error("mt get ran");
    };
    expect(mtMention("mt get <name>", run)).toBeNull();
    expect(mtMention("mt get <tool> [--ref <ref>]", run)).toBeNull();
  });

  test("drops a placeholder ref with its flag and still checks the tool", () => {
    const seen: string[][] = [];
    const run = (status: number): MtGet => (args) => (seen.push([...args]), { status, error: "" });
    expect(mtMention("mt get ask --ref <ref>", run(0))).toBeNull();
    expect(mtMention("mt get ask [--ref <ref>]", run(1))).toBe("mt get finds no such guide");
    expect(seen).toEqual([["ask"], ["ask"]]);
  });

  test("counts a mention as a placeholder only when its tool is one", () => {
    const is = (text: string) => isPlaceholderMention(text.split(" "));
    expect(is("mt get <name>")).toBe(true);
    expect(is("mt get <tool> [--ref <ref>]")).toBe(true);
    expect(is("mt get ask --ref <ref>")).toBe(false);
    expect(is("mt pin add <file>")).toBe(false);
  });

  test("matches any other mention against the usage, whole or as a prefix", () => {
    expect(mtMention("mt list")).toBeNull();
    expect(mtMention("mt pin add <file>")).toBeNull();
    expect(mtMention("mt pin")).toBeNull();
    expect(mtMention("mt")).toBeNull();
    expect(mtMention("mt pin lint")).toBe("mt has no command 'mt pin lint' in its usage");
    expect(mtMention("mt frob")).toBe("mt has no command 'mt frob' in its usage");
  });
});

describe("readOrcaContext", () => {
  test("reads schemaVersion 1 only", () => {
    for (const schemaVersion of [2, 0, "1", true, null, undefined]) {
      const result = readOrcaContext({ schemaVersion, commands: [] });
      expect(result).toBe(
        `\`orca agent-context --json\` reports schemaVersion ${JSON.stringify(schemaVersion)}; guide-lint reads only schema version 1`,
      );
    }
    expect(typeof readOrcaContext({ schemaVersion: 1, commands: [] })).toBe("object");
  });

  test("rejects anything that is not a JSON object", () => {
    for (const context of [undefined, null, [], "x", 1]) {
      expect(readOrcaContext(context)).toBe("`orca agent-context --json` did not print a JSON object");
    }
  });

  test("names the drift once when commands is missing or not an array", () => {
    for (const commands of [undefined, null, {}, "x"]) {
      expect(readOrcaContext({ schemaVersion: 1, commands })).toBe("`orca agent-context --json` has no `commands` array");
    }
  });

  test("names the drift once when a command lacks a string command or an array path", () => {
    const drift = "`orca agent-context --json` lists a command without a string `command` and an array `path`";
    const entries = [
      null,
      { path: ["skills", "get"], flags: [] },
      { command: 1, path: ["skills", "get"], flags: [] },
      { command: "skills get", flags: [] },
      { command: "skills get", path: "skills get", flags: [] },
    ];
    for (const entry of entries) {
      expect(readOrcaContext({ schemaVersion: 1, commands: [entry] })).toBe(drift);
    }
  });
});

describe("checkOrcaMention", () => {
  test("passes a command with the flags it has, an alias, and an argument", () => {
    expect(orcaMention("orca orchestration worker-list --terminal-state reclaimable")).toBeNull();
    expect(orcaMention("orca orchestration ask --options")).toBeNull();
    expect(orcaMention("orca skills show orchestration")).toBeNull();
    expect(orcaMention("orca skills get orchestration")).toBeNull();
  });

  test("passes a group with no flags, and fails a flag on it", () => {
    expect(orcaMention("orca orchestration")).toBeNull();
    expect(orcaMention("orca skills")).toBeNull();
    expect(orcaMention("orca orchestration --json")).toBe("orca orchestration has no flag --json");
  });

  test("fails a command that does not exist, including an argument to a group", () => {
    expect(orcaMention("orca orchestration worker-gone")).toBe("orca has no command 'orchestration worker-gone'");
    expect(orcaMention("orca frob")).toBe("orca has no command 'frob'");
  });

  test("names the command and the flag it lacks, also written --flag=value", () => {
    expect(orcaMention("orca orchestration worker-list --limit")).toBe(
      "orca orchestration worker-list has no flag --limit",
    );
    expect(orcaMention("orca orchestration ask --option=a,b")).toBe("orca orchestration ask has no flag --option");
  });

  test("fails a mention it cannot check: one that opens with a flag or holds a short flag", () => {
    const cannot =
      "guide-lint cannot check a mention that opens with a flag or holds a short flag; write the command path first, then long flags";
    expect(orcaMention("orca --json")).toBe(cannot);
    expect(orcaMention("orca --json orchestration ask")).toBe(cannot);
    expect(orcaMention("orca orchestration worker-list -x")).toBe(cannot);
    expect(orcaMention("orca orchestration ask -h --options")).toBe(cannot);
  });

  test("passes a bare `orca`", () => {
    expect(orcaMention("orca")).toBeNull();
  });
});

describe("checkPlacement", () => {
  const platforms = new Set(["orca"]);

  test("a platform's command in its own reference is in place", () => {
    expect(checkPlacement("guides/coordinate/orca.md", ["orca", "orchestration", "ask"], platforms)).toBeNull();
  });

  test("a platform's command anywhere else is out of place", () => {
    for (const file of ["guides/coordinate.md", "skills/mt-coordinate/SKILL.md", "AGENTS.md"]) {
      expect(checkPlacement(file, ["orca", "orchestration", "ask"], platforms)).toBe(
        "orca commands belong only in its platform reference, guides/coordinate/orca.md",
      );
    }
  });

  test("a word that names no platform with a reference, or a bare platform name, is not checked", () => {
    expect(checkPlacement("guides/coordinate.md", ["mt", "get", "orca"], platforms)).toBeNull();
    expect(checkPlacement("guides/coordinate.md", ["codex", "exec"], platforms)).toBeNull();
    expect(checkPlacement("guides/coordinate.md", ["orca"], platforms)).toBeNull();
  });
});

describe("spec sections", () => {
  test("a title-case phrase is a section name; a command, a guide name or a heading is not", () => {
    expect(isSectionName("In scope")).toBe(true);
    expect(isSectionName("Why")).toBe(true);
    expect(["mt get spec", "coverage", "T<n>", "Observable Acceptance", "--ref"].some(isSectionName)).toBe(false);
  });
});

describe("fixed rules", () => {
  const CHARTER = "# Charter\n\n## Fixed\n\n- One. Home: the door-rule guide (`mt get door-rule`).\n- Two. Home: each perspective (`mt get verification --ref <perspective>`).\n\n## Later\n\nNot a home: `mt get ask`.\n";

  test("names the mt get mentions of the Fixed section only, with their lines", () => {
    expect(fixedHomes(CHARTER)).toEqual([
      { line: 5, text: "mt get door-rule" },
      { line: 6, text: "mt get verification --ref <perspective>" },
    ]);
    expect(fixedHomes("# Charter\n\nNo fixed section, `mt get ask`.\n")).toEqual([]);
  });

  test("resolves a home to its guide, its reference, or every reference for a placeholder", () => {
    const references = (tool: string) => (tool === "verification" ? ["coverage", "surprise"] : []);
    expect(homeFiles("mt get door-rule".split(" "), references)).toEqual(["guides/door-rule.md"]);
    expect(homeFiles("mt get ask --ref stance".split(" "), references)).toEqual(["guides/ask/stance.md"]);
    expect(homeFiles("mt get verification --ref <perspective>".split(" "), references)).toEqual([
      "guides/verification/coverage.md",
      "guides/verification/surprise.md",
    ]);
    expect(homeFiles("mt get <tool>".split(" "), references)).toEqual([]);
  });

  test("finds each line that carries the fixed mark", () => {
    expect(fixedLines("a\nb. Fixed: changing it is the owner's call.\nc\nFixed: changing it is the owner's call. d\n")).toEqual([2, 4]);
  });
});
