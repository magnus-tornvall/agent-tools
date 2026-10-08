import { tick, gitCli } from "../../src/orca/tick.ts";
import { orcaCli } from "../../src/orca/orca.ts";

export const STATUS_PORT = 47821;

const RUN_ID = /^run_[0-9a-f]{12}$/;

export function isRunId(value: unknown): value is string {
  return typeof value === "string" && RUN_ID.test(value);
}

/** The only text the plugin ever sends to a terminal. */
export function statusCommand(run: string): string {
  if (!isRunId(run)) throw new Error(`not a Run ID: ${run}`);
  return `bun run tick status --run ${run}`;
}

export type Counts = { readonly questions: number; readonly failed: number; readonly awaitingMerge: number };

/** Each entry of a section is a line indented by exactly two spaces; its detail is indented deeper. */
export function countsOf(statusText: string): Counts {
  const entries = (heading: string): number => {
    const start = statusText.split("\n").findIndex((line) => line.startsWith(`${heading}:`));
    if (start === -1) throw new Error(`status text has no "${heading}" section`);
    const lines = statusText.split("\n").slice(start + 1);
    const end = lines.findIndex((line) => line !== "" && !line.startsWith(" "));
    return (end === -1 ? lines : lines.slice(0, end)).filter((line) => /^ {2}\S/.test(line)).length;
  };
  return {
    questions: entries("Open questions"),
    failed: entries("Failed attempts"),
    awaitingMerge: entries("Awaiting merge"),
  };
}

export function describeCounts(run: string, counts: Counts): { title: string; body: string } {
  return {
    title: `Tick status ${run}`,
    body: `${counts.questions} open questions, ${counts.failed} failed attempts, ${counts.awaitingMerge} awaiting merge`,
  };
}

/** What `bun run tick status --run R` prints, run in this process against the real Orca. */
export function liveStatus(cwd: string): (run: string) => Promise<string> {
  return (run) => tick(["status", "--run", run], orcaCli(cwd), gitCli());
}
