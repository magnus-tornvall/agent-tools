import { describe, expect, test } from "bun:test";
import { claims, findings } from "./check.ts";

const NO_FILES = new Map<string, string>();

describe("claims", () => {
  test("reads both claim kinds in report order, indented or as list items, and ignores prose", () => {
    const report = [
      "Outcome: succeeded. I Changed: nothing mid-line.",
      "Changed: src/a.ts",
      "  - Added test: src/a.test.ts::rejects an empty key",
      "* Changed: src/b.ts  ",
    ].join("\n");
    expect(claims(report)).toEqual([
      { kind: "changed", path: "src/a.ts" },
      { kind: "test", path: "src/a.test.ts", name: "rejects an empty key" },
      { kind: "changed", path: "src/b.ts" },
    ]);
  });

  test("splits a test claim at its first ::", () => {
    expect(claims("Added test: src/d.test.ts::Foo::bar rejects")).toEqual([{ kind: "test", path: "src/d.test.ts", name: "Foo::bar rejects" }]);
  });

  test("a claim line with no path, or a test claim without both path and name, is malformed", () => {
    expect(claims("Changed:\nAdded test: src/d.test.ts\nAdded test: ::name").map((claim) => claim.kind)).toEqual(["malformed", "malformed", "malformed"]);
  });
});

describe("findings", () => {
  test("none when the claims match the touched paths and the named tests", () => {
    const report = "Changed: src/a.ts\nChanged: src/a.test.ts\nAdded test: src/a.test.ts::parses";
    const files = new Map([["src/a.test.ts", 'test("parses", () => {});']]);
    expect(findings(report, "T4", { touched: ["src/a.test.ts", "src/a.ts"], files })).toEqual([]);
  });

  test("none for an empty report on an untouched branch", () => {
    expect(findings("", "T4", { touched: [], files: NO_FILES })).toEqual([]);
  });

  test("continues after the highest finding the report keys under the task, whatever their order", () => {
    const report = "T4/F2: a judge's finding\nT4/F1: another\nChanged: src/b.ts";
    expect(findings(report, "T4", { touched: [], files: NO_FILES })).toEqual(["T4/F3: claimed but untouched: src/b.ts"]);
  });

  test("ignores keys under another task, or one that only ends in the task's name", () => {
    const report = "T14/F9 and T5/F7 and XT4/F8\nChanged: src/b.ts";
    expect(findings(report, "T4", { touched: [], files: NO_FILES })).toEqual(["T4/F1: claimed but untouched: src/b.ts"]);
  });

  test("lists the claims' mismatches in report order, then each touched path no Changed line claims", () => {
    const report = "Added test: src/d.test.ts::rejects an empty key\nChanged: src/b.ts";
    expect(findings(report, "T4", { touched: ["src/c.ts", "src/e.ts"], files: NO_FILES })).toEqual([
      "T4/F1: named test not found: src/d.test.ts::rejects an empty key",
      "T4/F2: claimed but untouched: src/b.ts",
      "T4/F3: touched but unclaimed: src/c.ts",
      "T4/F4: touched but unclaimed: src/e.ts",
    ]);
  });

  test("a path claimed twice is one claim", () => {
    expect(findings("Changed: src/b.ts\nChanged: src/b.ts", "T4", { touched: [], files: NO_FILES })).toEqual(["T4/F1: claimed but untouched: src/b.ts"]);
  });

  test("a malformed claim line is a finding", () => {
    expect(findings("Added test: src/d.test.ts", "T4", { touched: [], files: NO_FILES })).toEqual(["T4/F1: malformed claim: Added test: src/d.test.ts"]);
  });
});
