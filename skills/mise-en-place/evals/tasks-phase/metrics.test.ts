import { describe, expect, test } from "bun:test";
import { expandContract, globToRe, layersOf, longestChain, workShaped, type Task } from "./metrics.ts";

const t = (id: string, depends_on: string[] = [], scope: string[] = [], goal = "x"): Task => ({
  file: `${id}.md`,
  id,
  goal,
  satisfies: [],
  scope,
  depends_on,
});

describe("globToRe", () => {
  test("a single star stops at a path separator", () => {
    expect(globToRe("src/*.ts").test("src/a.ts")).toBe(true);
    expect(globToRe("src/*.ts").test("src/db/a.ts")).toBe(false);
  });

  test("a double star crosses them", () => {
    expect(globToRe("src/**").test("src/db/a.ts")).toBe(true);
    expect(globToRe("**/*.test.ts").test("packages/api/x.test.ts")).toBe(true);
    // The leading `**/` has to be optional or a root-level test file misses its layer.
    expect(globToRe("**/*.test.ts").test("x.test.ts")).toBe(true);
  });
});

describe("layersOf", () => {
  const spec = {
    layers: { db: ["src/db/**"], api: ["src/api/**"], test: ["**/*.test.ts"] },
    verification: ["test"],
  };

  test("reads the layer off the path under an anchor", () => {
    expect([...layersOf(["src/db/user.ts::UserRow", "src/api/a.ts:12"], spec)].sort()).toEqual(["api", "db"]);
  });

  test("a path in no layer is ignored rather than counted", () => {
    expect([...layersOf(["README.md"], spec)]).toEqual([]);
  });
});

describe("longestChain", () => {
  test("a queue is as deep as it is long", () => {
    expect(longestChain([t("T1"), t("T2", ["T1"]), t("T3", ["T2"])])).toBe(3);
  });

  test("a fan is one deep past its source", () => {
    expect(longestChain([t("T1"), t("T2", ["T1"]), t("T3", ["T1"])])).toBe(2);
  });

  test("a cycle terminates instead of hanging", () => {
    expect(longestChain([t("T1", ["T2"]), t("T2", ["T1"])])).toBeLessThan(4);
  });
});

describe("expandContract", () => {
  const shape = [
    t("T1"),
    t("T2", ["T1"]),
    t("T3", ["T1"]),
    t("T4", ["T2", "T3"]),
  ];

  test("one source, a fan, one sink blocked by all of it", () => {
    expect(expandContract(shape)).toBe(true);
  });

  test("a second source is not the shape - nothing guarantees the old form exists", () => {
    expect(expandContract([...shape.slice(0, 3), t("T4", ["T2", "T3"]), t("T5")])).toBe(false);
  });

  test("a sink missing a batch is not the shape - it contracts over a live caller", () => {
    expect(expandContract([t("T1"), t("T2", ["T1"]), t("T3", ["T1"]), t("T4", ["T2"])])).toBe(false);
  });

  test("a batch chained to another batch is not the shape", () => {
    expect(expandContract([t("T1"), t("T2", ["T1"]), t("T3", ["T2"]), t("T4", ["T2", "T3"])])).toBe(false);
  });
});

describe("workShaped", () => {
  test("names work and no state", () => {
    expect(workShaped("Add a notify_email column to the users table.")).toBe(true);
    expect(workShaped("Wire the toggle through to the send path.")).toBe(true);
  });

  test("names a state that could be observed false", () => {
    expect(workShaped("The account page shows the user's stored setting.")).toBe(false);
    expect(workShaped("Add the column so that a saved setting survives a restart.")).toBe(false);
  });
});
