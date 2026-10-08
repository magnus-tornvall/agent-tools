import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tick, type Git } from "../../src/orca/tick.ts";
import type { Orca } from "../../src/orca/orca.ts";
import { createPlugin } from "./worker.ts";
import { countsOf, isRunId, statusCommand } from "./status.ts";

const RUN = "run_cb7933432d5b"; // Q2 never answered
const FAILED_RUN = "run_d8de2b7afb55"; // two failures, one crash, a completed parent with no worktree

/** The recorded Run has no worker still in flight; this puts its Dispatch in flight so Q2 is open. */
const IN_FLIGHT = { dispatchStatus: "dispatched", projection: { liveness: { verdict: "live" } } };

function recorded(name: string): unknown {
  const envelope: unknown = JSON.parse(readFileSync(new URL(`../../src/orca/fixtures/tick/${name}.json`, import.meta.url), "utf8"));
  return (envelope as { result: unknown }).result;
}

function withInFlight(run: string, workers: unknown): unknown {
  if (run !== RUN) return workers;
  const result = workers as { workers: Record<string, unknown>[] };
  return {
    ...result,
    workers: result.workers.map((w) =>
      w.dispatchId === "ctx_feb1a69dcedd"
        ? { ...w, dispatchStatus: IN_FLIGHT.dispatchStatus, projection: { ...(w.projection as object), ...IN_FLIGHT.projection } }
        : w,
    ),
  };
}

/** Serves recorded reads and logs every call, so a test can show nothing was written. */
function fakeOrca(run: string) {
  const calls: string[] = [];
  const reads: Record<string, unknown> = {
    "task-list": recorded(`tasks-${run}`),
    "worker-list": withInFlight(run, recorded(`workers-${run}`)),
    "gate-list": recorded(`gates-${run}`),
    inbox: recorded("inbox"),
  };
  const orca: Orca = async (args) => {
    calls.push(args[0] ?? "");
    const result = reads[args[0] ?? ""];
    if (result === undefined) throw new Error(`unexpected Orca call ${args[0]}`);
    return result;
  };
  return { orca, calls };
}

const git: Git = { worktreeExists: () => true, headIsOnMain: async () => false };

function plugin(run: string) {
  const { orca, calls } = fakeOrca(run);
  const handlers = new Map<string, (args?: unknown) => Promise<unknown>>();
  const notifications: unknown[] = [];
  const hostCalls: string[] = [];
  const ctx = {
    commands: { register: (id: string, handler: (args?: unknown) => Promise<unknown>) => void handlers.set(id, handler) },
    host: {
      call: async (method: string, params?: unknown) => {
        hostCalls.push(method);
        notifications.push(params);
        return { delivered: true };
      },
    },
  };
  const activate = createPlugin({
    status: (id) => tick(["status", "--run", id], orca, git),
    storedRun: async () => `${run}\n`,
  });
  return { activate: () => activate(ctx), handlers, notifications, hostCalls, calls };
}

describe("the status command (P1)", () => {
  test("notifies the counts tick status reports, for a Run ID passed with the command", async () => {
    const p = plugin(FAILED_RUN);
    await p.activate();
    const text = await tick(["status", "--run", FAILED_RUN], fakeOrca(FAILED_RUN).orca, git);
    const counts = countsOf(text);
    expect(counts.failed).toBeGreaterThan(0);

    await p.handlers.get("tick-status.show")?.({ runId: FAILED_RUN });

    expect(p.notifications).toEqual([
      {
        title: `Tick status ${FAILED_RUN}`,
        body: `${counts.questions} open questions, ${counts.failed} failed attempts, ${counts.awaitingMerge} awaiting merge`,
      },
    ]);
  });

  test("counts the open question of a Run", async () => {
    const text = await tick(["status", "--run", RUN], fakeOrca(RUN).orca, git);
    expect(countsOf(text)).toEqual({ questions: 1, failed: 0, awaitingMerge: 1 });
  });

  test("reads the Run ID from the stored file when the palette passes none", async () => {
    const p = plugin(RUN);
    await p.activate();
    await p.handlers.get("tick-status.show")?.();
    expect(p.hostCalls).toEqual(["notifications.show"]);
  });

  test("refuses a Run ID that is not one, and shows nothing", async () => {
    const p = plugin(RUN);
    await p.activate();
    await expect(p.handlers.get("tick-status.show")?.({ runId: "run_1; rm -rf ~" })).rejects.toThrow("not a Run ID");
    expect(p.hostCalls).toEqual([]);
  });

  test("changes nothing in the Run: only reads reach Orca", async () => {
    const p = plugin(RUN);
    await p.activate();
    await p.handlers.get("tick-status.show")?.({ runId: RUN });
    expect(p.calls.every((c) => ["task-list", "worker-list", "gate-list", "inbox"].includes(c))).toBe(true);
  });
});

describe("the terminal command (P2)", () => {
  test("is exactly the tick status command for a checked Run ID", () => {
    expect(statusCommand(RUN)).toBe(`bun run tick status --run ${RUN}`);
  });

  test.each(["", "run_", "run_ABCDEF012345", "run_0123456789ab ; ls", "run_0123456789abc"])("rejects %p", (id) => {
    expect(isRunId(id)).toBe(false);
    expect(() => statusCommand(id)).toThrow("not a Run ID");
  });

  test("the panel sends the same command text and checks the same Run ID pattern", () => {
    const panel = readFileSync(new URL("./panel.html", import.meta.url), "utf8");
    expect(panel).toContain('text: "bun run tick status --run " + id');
    expect(panel).toContain("/^run_[0-9a-f]{12}$/");
    expect(panel.match(/terminal\.sendText/g)?.length).toBe(1);
  });
});

describe("the manifest and bundle", () => {
  const manifest = JSON.parse(readFileSync(new URL("./orca-plugin.json", import.meta.url), "utf8"));

  test("lists a command and a panel, and no storage capability", () => {
    expect(manifest.contributes.commands.map((c: { id: string }) => c.id)).toEqual(["tick-status.show"]);
    expect(manifest.contributes.panels.map((c: { id: string }) => c.id)).toEqual(["tick-status"]);
    expect(manifest.capabilities.map((c: { kind: string }) => c.kind)).not.toContain("storage");
  });

  test("the bundled worker does not carry the tick's CLI entry", () => {
    const bundle = readFileSync(new URL("./dist/worker.mjs", import.meta.url), "utf8");
    expect(bundle).not.toContain("process.argv.slice(2)");
  });
});
