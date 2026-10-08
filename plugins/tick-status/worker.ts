import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { countsOf, describeCounts, isRunId, liveStatus } from "./status.ts";

type Activation = {
  readonly commands: { register(id: string, handler: (args?: unknown) => Promise<unknown>): void };
  readonly host: { call(method: string, params?: unknown): Promise<unknown> };
};

export type Deps = {
  readonly status: (run: string) => Promise<string>;
  /** The command palette passes no arguments, so a Run ID not in args comes from here. */
  readonly storedRun: () => Promise<string>;
};

const RUN_FILE = join(homedir(), ".orca", "tick-status-run");

export function createPlugin(deps: Deps): (ctx: Activation) => Promise<void> {
  return async (ctx) => {
    ctx.commands.register("tick-status.show", async (args) => {
      const given = typeof args === "object" && args !== null ? (args as { runId?: unknown }).runId : undefined;
      const run = given ?? (await deps.storedRun()).trim();
      if (!isRunId(run)) throw new Error(`not a Run ID: ${String(run)}`);
      const { title, body } = describeCounts(run, countsOf(await deps.status(run)));
      await ctx.host.call("notifications.show", { title, body });
      return { title, body };
    });
  };
}

export default createPlugin({
  status: liveStatus(homedir()),
  storedRun: () => readFile(RUN_FILE, "utf8"),
});
