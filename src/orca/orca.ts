/**
 * Running `orca orchestration` from a script: one command with `--json`, its `result` returned,
 * its refusal thrown as an `OrcaRefusal`.
 */
import { sh } from "../shell.ts";

/** Runs one `orca orchestration` command with `--json` and returns its `result`. */
export type Orca = (args: readonly string[]) => Promise<unknown>;

/** How `orcaCli` runs a command; `sh` outside tests. */
export type Run = (cmd: string, args: string[], cwd: string) => Promise<string>;

/**
 * Orca's refusal of one command. `requestId` is set when Orca does not know whether a mutation
 * took effect and reported the UUID to retry it with `--retry-request`.
 */
export class OrcaRefusal extends Error {
  constructor(
    message: string,
    readonly requestId: string | undefined,
  ) {
    super(message);
    this.name = "OrcaRefusal";
  }
}

export function orcaCli(cwd: string, run: Run = sh): Orca {
  return async (args) => {
    const output = await run("orca", ["orchestration", ...args, "--json"], cwd).catch(
      (error: unknown) => {
        throw orcaRefusal(args, error);
      },
    );
    return orcaResult(args, output);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function envelope(args: readonly string[], output: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(output);
  if (!isRecord(parsed)) throw new Error(`Orca returned a orca ${args[0]} reply that is not an object`);
  return parsed;
}

function orcaResult(args: readonly string[], output: string): unknown {
  const reply = envelope(args, output);
  if (reply.ok !== true) throw orcaError(args, reply.error);
  return reply.result;
}

/** Orca exits 1 on a refusal and puts the reason in the JSON it still prints to stdout. */
function orcaRefusal(args: readonly string[], error: unknown): unknown {
  if (!isRecord(error) || typeof error.stdout !== "string" || !error.stdout.startsWith("{")) {
    return error;
  }
  return orcaError(args, envelope(args, error.stdout).error);
}

function orcaError(args: readonly string[], error: unknown): OrcaRefusal {
  const detail = isRecord(error) ? `${String(error.code)}: ${String(error.message)}` : "no error given";
  const data = isRecord(error) && isRecord(error.data) ? error.data : {};
  const requestId = typeof data.orchestrationRequestId === "string" ? data.orchestrationRequestId : undefined;
  return new OrcaRefusal(`orca orchestration ${args[0]} refused: ${detail}`, requestId);
}
