import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { countsOf, describeCounts, isRunId, liveStatus, STATUS_PORT } from "./status.ts";

type Activation = {
  readonly commands: { register(id: string, handler: (args?: unknown) => Promise<unknown>): void };
  readonly host: { call(method: string, params?: unknown): Promise<unknown> };
  readonly log: (message: string) => void;
};

export type Deps = {
  readonly status: (run: string) => Promise<string>;
  /** The command palette passes no arguments, so a Run ID not in args comes from here. */
  readonly storedRun: () => Promise<string>;
  readonly port: number;
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

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const run = url.searchParams.get("run");
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (url.pathname !== "/status" || !isRunId(run)) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("expected /status?run=<run_id>");
        return;
      }
      deps.status(run).then(
        (text) => res.writeHead(200, { "Content-Type": "text/plain" }).end(text),
        (error: unknown) =>
          res.writeHead(500, { "Content-Type": "text/plain" }).end(error instanceof Error ? error.message : String(error)),
      );
    });
    server.on("error", (error) => ctx.log(`status server: ${error.message}`));
    server.listen(deps.port, "127.0.0.1");
  };
}

export default createPlugin({
  status: liveStatus(homedir()),
  storedRun: () => readFile(RUN_FILE, "utf8"),
  port: STATUS_PORT,
});
