import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

const MT = new URL("../../cli/mt", import.meta.url).pathname;
const ROOT = realpathSync(dirname(dirname(MT)));
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "mt-triage-")));
const KEY = "test-key-c0ffee";

const FAKEBIN = join(TMP, "fakebin");
const NOGH = join(TMP, "nogh");
const GH_CALLS = join(TMP, "gh-calls");
const GH_CWD = join(TMP, "gh-cwd");
const ISSUES = join(TMP, "issues.json");

mkdirSync(FAKEBIN);
mkdirSync(NOGH);
const BUN = Bun.which("bun");
if (BUN === null) throw new Error("bun is not on PATH");
symlinkSync(BUN, join(FAKEBIN, "bun"));
symlinkSync(BUN, join(NOGH, "bun"));
writeFileSync(
  join(FAKEBIN, "gh"),
  `#!/bin/bash
printf '%s\\n' "$*" >>"${GH_CALLS}"
printf '%s\\n' "$PWD" >"${GH_CWD}"
if [ -n "\${FAKE_GH_FAIL:-}" ]; then printf '\\ngh: HTTP 401: Bad credentials\\nrun gh auth login\\n' >&2; exit 1; fi
/bin/cat "${ISSUES}"
`,
);
chmodSync(join(FAKEBIN, "gh"), 0o755);

interface Pick {
  choice: string;
  probability: number;
  confidence: number;
}

/** What the fake jev answers: same-defect probability per pair, and the two choices per issue. */
interface Script {
  sameDefect: Record<string, number>;
  change: Record<number, Pick>;
  verdict: Record<number, Pick>;
  /** Answer every request with this status and body instead. */
  fail?: { status: number; body: unknown };
  /** Leave this question's answer out. */
  omit?: string;
  /** The model each response names, by the request's number from 1; "jev-fake" when absent. */
  model?: (request: number) => string;
  /**
   * Answer this placement request, counted from 1, with HTTP 400 once a full batch of placement
   * requests is in flight; the other placements are held until the client aborts them.
   */
  failPlacement?: number;
}

const RequestBody = z.object({
  model: z.string().optional(),
  state: z.unknown(),
  questions: z.record(z.string(), z.object({ type: z.string(), instructions: z.unknown().optional(), criteria: z.unknown().optional() })),
});

interface Seen {
  authorization: string | null;
  body: z.infer<typeof RequestBody>;
}

/** The number of the issue a placement request is about. */
function stateNumber({ body }: Seen): number {
  return z.object({ number: z.number() }).parse(body.state).number;
}

let script: Script = { sameDefect: {}, change: {}, verdict: {} };
let seen: Seen[] = [];

const PLACEMENT_BATCH = 4;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface Gate {
  placements: number;
  failed: boolean;
  /** Requests that reached the server after the failing response was sent. */
  late: number;
  /** Held requests the client has aborted. */
  aborted: number;
  batchInFlight: Deferred;
  allAborted: Deferred;
}

function newGate(): Gate {
  return { placements: 0, failed: false, late: 0, aborted: 0, batchInFlight: deferred(), allAborted: deferred() };
}

let gate = newGate();

function choiceAnswer(labels: string[], { choice, probability, confidence }: Pick) {
  const rest = (1 - probability) / (labels.length - 1);
  return {
    type: "choice",
    choice,
    confidence,
    probabilities: Object.fromEntries(labels.map((label) => [label, label === choice ? probability : rest])),
  };
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const received: Seen = { authorization: request.headers.get("authorization"), body: RequestBody.parse(await request.json()) };
    const requestNumber = seen.push(received);
    const { body } = received;
    if (gate.failed) gate.late++;
    if (script.failPlacement !== undefined && "change" in body.questions) {
      const nth = ++gate.placements;
      if (nth === PLACEMENT_BATCH) gate.batchInFlight.resolve();
      await gate.batchInFlight.promise;
      if (nth === script.failPlacement) {
        gate.failed = true;
        return Response.json({ detail: "questions: too many" }, { status: 400 });
      }
      await new Promise<void>((released) => {
        const abandon = () => {
          if (++gate.aborted === PLACEMENT_BATCH - 1) gate.allAborted.resolve();
          released();
        };
        if (request.signal.aborted) abandon();
        else request.signal.addEventListener("abort", abandon, { once: true });
      });
    }
    if (script.fail) return Response.json(script.fail.body, { status: script.fail.status });
    const answers: Record<string, unknown> = {};
    for (const key of Object.keys(body.questions)) {
      if (key === script.omit) continue;
      const pair = /^same_(\d+)_(\d+)$/.exec(key);
      if (pair) {
        answers[key] = { type: "noul", noul: script.sameDefect[`${pair[1]}_${pair[2]}`] ?? 0.05 };
        continue;
      }
      const number = stateNumber(received);
      const pick = key === "change" ? script.change[number] : script.verdict[number];
      if (pick === undefined) throw new Error(`no scripted ${key} for #${number}`);
      const labels = key === "change" ? ["mt_code", "guide", "orca"] : ["no_brainer", "rule_on"];
      answers[key] = choiceAnswer(labels, pick);
    }
    return Response.json({ model: script.model?.(requestNumber) ?? "jev-fake", answers, usage: { input_tokens: 1, output_tokens: 1 } });
  },
});

afterAll(() => {
  server.stop(true);
  rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  seen = [];
  gate = newGate();
  rmSync(GH_CALLS, { force: true });
  rmSync(GH_CWD, { force: true });
});

const BASE_ENV: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("TYPESAFE_")),
);

async function triage(env: Record<string, string | undefined> = {}, ...extra: string[]) {
  const proc = Bun.spawn([MT, "dogfood", "triage", ...extra], {
    cwd: TMP,
    env: {
      ...BASE_ENV,
      PATH: FAKEBIN,
      MT_LOG: join(TMP, "usage.jsonl"),
      XDG_STATE_HOME: join(TMP, "state"),
      TYPESAFE_API_KEY: KEY,
      TYPESAFE_BASE_URL: `http://127.0.0.1:${server.port}`,
      ...env,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, stdout, stderr };
}

function ghCalls(): string[] {
  return existsSync(GH_CALLS) ? readFileSync(GH_CALLS, "utf8").trimEnd().split("\n") : [];
}

function issue(number: number, title: string, body = `Body of #${number}.`) {
  return { number, title, body };
}

const ORCA = issue(39, "orca worktree rm deletes the worktree's branch, asynchronously");
const GUIDE = issue(41, "to-orca: say that a fix round's commits are judged too", "Add to to-orca: a fix round's commits are judged too.");
const DUP_A = issue(50, "mt shape check crashes on an empty file");
const DUP_B = issue(51, "mt shape check throws on a zero-byte shape");
const SURE = issue(52, "mt list pads names to 20 columns, cutting long ones", "Expected: long names are not cut.");
const AT_THRESHOLD = issue(53, "mt get --ref with an empty ref exits 0", "Expected: exit 1.");
const UNSURE = issue(54, "mt mvc save keeps a trailing newline twice", "Expected: one trailing newline.");
const UNSURE_CHANGE = issue(56, "mt dogfood prints the issue number twice", "Expected: once.");
const EDGE_CHANGE = issue(57, "mt list prints an empty line after the last guide", "Expected: no empty line.");
const ARGUABLE = issue(55, "mt dogfood should open the issue in a browser");

const ALL = [ARGUABLE, GUIDE, DUP_A, ORCA, SURE, DUP_B, AT_THRESHOLD, UNSURE];

const FULL: Script = {
  sameDefect: { "50_51": 0.92, "52_53": 0.5 },
  change: {
    39: { choice: "orca", probability: 0.93, confidence: 0.89 },
    41: { choice: "guide", probability: 0.88, confidence: 0.82 },
    52: { choice: "mt_code", probability: 0.97, confidence: 0.95 },
    53: { choice: "mt_code", probability: 0.96, confidence: 0.94 },
    54: { choice: "mt_code", probability: 0.95, confidence: 0.92 },
    55: { choice: "mt_code", probability: 0.9, confidence: 0.85 },
    56: { choice: "mt_code", probability: 0.4, confidence: 0.05 },
    57: { choice: "mt_code", probability: 0.8, confidence: 0.7 },
  },
  verdict: {
    39: { choice: "no_brainer", probability: 0.99, confidence: 0.98 },
    41: { choice: "no_brainer", probability: 0.95, confidence: 0.9 },
    52: { choice: "no_brainer", probability: 0.9, confidence: 0.8 },
    53: { choice: "no_brainer", probability: 0.85, confidence: 0.7 },
    54: { choice: "no_brainer", probability: 0.84, confidence: 0.69 },
    55: { choice: "rule_on", probability: 0.75, confidence: 0.5 },
    56: { choice: "no_brainer", probability: 0.95, confidence: 0.9 },
    57: { choice: "no_brainer", probability: 0.9, confidence: 0.7 },
  },
};

const FULL_REPORT = `jev model: jev-fake
duplicates
  #50, #51
    #50 mt shape check crashes on an empty file  (shares a problem with #51: probability 0.92, confidence 0.84)
    #51 mt shape check throws on a zero-byte shape  (shares a problem with #50: probability 0.92, confidence 0.84)
no-brainers
  #52 mt list pads names to 20 columns, cutting long ones  (no-brainer: change mt code probability 0.97, confidence 0.95; verdict no-brainer probability 0.90, confidence 0.80)
  #53 mt get --ref with an empty ref exits 0  (no-brainer: change mt code probability 0.96, confidence 0.94; verdict no-brainer probability 0.85, confidence 0.70)
rule on
  #39 orca worktree rm deletes the worktree's branch, asynchronously  (Orca: probability 0.93, confidence 0.89)
  #41 to-orca: say that a fix round's commits are judged too  (guide: probability 0.88, confidence 0.82)
  #54 mt mvc save keeps a trailing newline twice  (no-brainer below confidence 0.70: change mt code probability 0.95, confidence 0.92; verdict no-brainer probability 0.84, confidence 0.69)
  #55 mt dogfood should open the issue in a browser  (rule on: change mt code probability 0.90, confidence 0.85; verdict rule on probability 0.75, confidence 0.50)
`;

function section(report: string, heading: string): string {
  const lines = report.split("\n");
  const start = lines.indexOf(heading);
  const end = lines.findIndex((line, i) => i > start && !line.startsWith(" "));
  return lines.slice(start + 1, end).join("\n");
}

describe("mt dogfood triage", () => {
  test("prints every open issue in one of the three groups, each with jev's probability and confidence (R1-R6)", async () => {
    writeFileSync(ISSUES, JSON.stringify(ALL));
    script = FULL;
    const { code, stdout, stderr } = await triage();
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toBe(FULL_REPORT);
  });

  test("R1: two issues that report the same problem are listed together under duplicates", async () => {
    writeFileSync(ISSUES, JSON.stringify(ALL));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "duplicates")).toStartWith("  #50, #51\n    #50 ");
    expect(section(stdout, "no-brainers")).not.toContain("#50");
    expect(section(stdout, "rule on")).not.toContain("#51");

    const [pairs, ...placements] = seen;
    expect(pairs?.body.state).toEqual({ issues: [ORCA, GUIDE, DUP_A, DUP_B, SURE, AT_THRESHOLD, UNSURE, ARGUABLE] });
    const questions = Object.entries(pairs?.body.questions ?? {});
    expect(questions).toHaveLength((8 * 7) / 2);
    expect(pairs?.body.questions.same_50_51).toEqual({
      type: "noul",
      instructions:
        "At least one problem reported in issue #50 is also reported in issue #51: fixing that problem for one issue would fix it for the other.",
    });
    expect(placements.map(stateNumber).sort()).toEqual([39, 41, 52, 53, 54, 55]);
  });

  test("R1: a pair at exactly 0.6 is not grouped, and duplicates chain into one group", async () => {
    writeFileSync(ISSUES, JSON.stringify([DUP_A, DUP_B, SURE, AT_THRESHOLD]));
    script = { ...FULL, sameDefect: { "50_51": 0.9, "51_52": 0.7, "52_53": 0.6 } };
    const { code, stdout } = await triage();
    expect(code).toBe(0);
    expect(section(stdout, "duplicates")).toBe(
      [
        "  #50, #51, #52",
        "    #50 mt shape check crashes on an empty file  (shares a problem with #51: probability 0.90, confidence 0.80)",
        "    #51 mt shape check throws on a zero-byte shape  (shares a problem with #50: probability 0.90, confidence 0.80)",
        "    #52 mt list pads names to 20 columns, cutting long ones  (shares a problem with #51: probability 0.70, confidence 0.40)",
      ].join("\n"),
    );
    expect(section(stdout, "no-brainers")).toContain("#53 ");
  });

  test("R1: duplicates linked only through a later pair's shared issue form one group", async () => {
    const issues = [issue(10, "mt list pads names"), issue(11, "mt list cuts long names"), issue(42, "mt list truncates a guide name")];
    writeFileSync(ISSUES, JSON.stringify(issues));
    script = { ...FULL, sameDefect: { "10_42": 0.9, "11_42": 0.8 } };
    const { code, stdout } = await triage();
    expect(code).toBe(0);
    expect(section(stdout, "duplicates")).toBe(
      [
        "  #10, #11, #42",
        "    #10 mt list pads names  (shares a problem with #42: probability 0.90, confidence 0.80)",
        "    #11 mt list cuts long names  (shares a problem with #42: probability 0.80, confidence 0.60)",
        "    #42 mt list truncates a guide name  (shares a problem with #10: probability 0.90, confidence 0.80)",
      ].join("\n"),
    );
  });

  test("R2: an mt code defect jev calls a no-brainer at or above the threshold is a no-brainer", async () => {
    writeFileSync(ISSUES, JSON.stringify([SURE, AT_THRESHOLD]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "no-brainers")).toBe(
      [
        "  #52 mt list pads names to 20 columns, cutting long ones  (no-brainer: change mt code probability 0.97, confidence 0.95; verdict no-brainer probability 0.90, confidence 0.80)",
        "  #53 mt get --ref with an empty ref exits 0  (no-brainer: change mt code probability 0.96, confidence 0.94; verdict no-brainer probability 0.85, confidence 0.70)",
      ].join("\n"),
    );
    expect(section(stdout, "rule on")).toBe("  none");
  });

  test("R3: issue 41, a guide-wording finding with its fix named, goes to rule on even when jev calls it a no-brainer", async () => {
    writeFileSync(ISSUES, JSON.stringify([GUIDE]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe(
      "  #41 to-orca: say that a fix round's commits are judged too  (guide: probability 0.88, confidence 0.82)",
    );
    expect(section(stdout, "no-brainers")).toBe("  none");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.body.state).toEqual(GUIDE);
    expect(seen[0]?.body.questions.change?.criteria).toEqual({
      mt_code: expect.stringContaining("Makefile"),
      guide: expect.any(String),
      orca: expect.any(String),
    });
  });

  test("R1: the footer mt dogfood appends to a body is not sent to jev, and the rest of the body is", async () => {
    const footer = "---\nFiled with `mt dogfood`.\n- mt commit: `09cff20`\n- session: `34e3cb31`\n";
    const filed = issue(60, "mt list cuts long names", `Seen in a Run.\n\n---\n\nExpected: long names are not cut.\n\n${footer}`);
    const bare = issue(61, "mt list pads names", footer);
    const unfiled = issue(62, "mt list misaligns names", "Seen in a Run.\n\n---\nFiled with a note.");
    writeFileSync(ISSUES, JSON.stringify([filed, bare, unfiled]));
    script = {
      ...FULL,
      change: Object.fromEntries([60, 61, 62].map((n) => [n, { choice: "guide", probability: 0.9, confidence: 0.9 }])),
      verdict: Object.fromEntries([60, 61, 62].map((n) => [n, { choice: "rule_on", probability: 0.9, confidence: 0.8 }])),
    };
    const { code } = await triage();
    expect(code).toBe(0);
    const sent = [
      { ...filed, body: "Seen in a Run.\n\n---\n\nExpected: long names are not cut." },
      { ...bare, body: "" },
      unfiled,
    ];
    const [pairs, ...placements] = seen;
    expect(pairs?.body.state).toEqual({ issues: sent });
    expect(placements.sort((a, b) => stateNumber(a) - stateNumber(b)).map(({ body }) => body.state)).toEqual(sent);
  });

  test("R4: issue 39, about Orca's own behaviour, goes to rule on", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe(
      "  #39 orca worktree rm deletes the worktree's branch, asynchronously  (Orca: probability 0.93, confidence 0.89)",
    );
    expect(section(stdout, "no-brainers")).toBe("  none");
  });

  test("R5: an mt code no-brainer below the confidence threshold goes to rule on", async () => {
    writeFileSync(ISSUES, JSON.stringify([UNSURE]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe(
      "  #54 mt mvc save keeps a trailing newline twice  (no-brainer below confidence 0.70: change mt code probability 0.95, confidence 0.92; verdict no-brainer probability 0.84, confidence 0.69)",
    );
    expect(section(stdout, "no-brainers")).toBe("  none");
  });

  test("the report names the model jev's response names, not the one the request asked for", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA]));
    script = { ...FULL, model: () => "jev-2026-10-01" };
    const { code, stdout } = await triage({ TYPESAFE_DEFAULT_MODEL: "jev-pinned" });
    expect(code).toBe(0);
    expect(seen[0]?.body.model).toBe("jev-pinned");
    expect(stdout.split("\n")[0]).toBe("jev model: jev-2026-10-01");
    expect(stdout.split("\n").filter((line) => line.includes("jev model"))).toHaveLength(1);
  });

  test("when responses name different models the report names each, sorted, in the one line", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA, GUIDE]));
    script = { ...FULL, model: (request) => (request === 1 ? "jev-b" : "jev-a") };
    const { code, stdout } = await triage();
    expect(code).toBe(0);
    expect(stdout.split("\n")[0]).toBe("jev model: jev-a, jev-b");
  });

  test("R5: an mt code answer below the confidence threshold goes to rule on even when jev calls it a no-brainer", async () => {
    writeFileSync(ISSUES, JSON.stringify([UNSURE_CHANGE]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe(
      "  #56 mt dogfood prints the issue number twice  (mt code below confidence 0.70: change mt code probability 0.40, confidence 0.05; verdict no-brainer probability 0.95, confidence 0.90)",
    );
    expect(section(stdout, "no-brainers")).toBe("  none");
  });

  test("R2: an mt code answer at exactly the confidence threshold, with a no-brainer verdict at it, is a no-brainer", async () => {
    writeFileSync(ISSUES, JSON.stringify([EDGE_CHANGE]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "no-brainers")).toBe(
      "  #57 mt list prints an empty line after the last guide  (no-brainer: change mt code probability 0.80, confidence 0.70; verdict no-brainer probability 0.90, confidence 0.70)",
    );
    expect(section(stdout, "rule on")).toBe("  none");
  });

  test("R6: with no open issues every group says none, and jev is not called", async () => {
    writeFileSync(ISSUES, "[]");
    const { code, stdout } = await triage();
    expect(code).toBe(0);
    expect(stdout).toBe("duplicates\n  none\nno-brainers\n  none\nrule on\n  none\n");
    expect(seen).toHaveLength(0);
  });

  test("R6: a title with line breaks stays on its issue's one line", async () => {
    writeFileSync(ISSUES, JSON.stringify([{ ...ORCA, title: "orca worktree rm\n  deletes the branch" }]));
    script = FULL;
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe("  #39 orca worktree rm deletes the branch  (Orca: probability 0.93, confidence 0.89)");
  });

  test("R6: control characters other than whitespace never reach the terminal from a title", async () => {
    writeFileSync(ISSUES, JSON.stringify([{ ...ORCA, title: "orca \u001b[2Jworktree\u0007 rm\u007f\tdeletes\u0000 the branch" }]));
    script = FULL;
    const { stdout } = await triage();
    expect(stdout).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f]/);
    expect(section(stdout, "rule on")).toBe("  #39 orca [2Jworktree rm deletes the branch  (Orca: probability 0.93, confidence 0.89)");
  });

  test("R5: a confidence just under the threshold never prints as the threshold", async () => {
    writeFileSync(ISSUES, JSON.stringify([UNSURE_CHANGE]));
    script = { ...FULL, change: { 56: { choice: "mt_code", probability: 0.6999, confidence: 0.6999 } } };
    const { stdout } = await triage();
    expect(section(stdout, "rule on")).toBe(
      "  #56 mt dogfood prints the issue number twice  (mt code below confidence 0.70: change mt code probability 0.69, confidence 0.69; verdict no-brainer probability 0.95, confidence 0.90)",
    );
  });

  test("R7: gh is asked only to list the open dogfooding issues, in mt's clone", async () => {
    writeFileSync(ISSUES, JSON.stringify(ALL));
    script = FULL;
    const { code } = await triage();
    expect(code).toBe(0);
    expect(ghCalls()).toEqual(["issue list --state open --label dogfooding --json number,title,body --limit 1000"]);
    expect(readFileSync(GH_CWD, "utf8").trim()).toBe(ROOT);
  });

  test("R8: without TYPESAFE_API_KEY it says so in one line on stderr, prints nothing and exits 1", async () => {
    writeFileSync(ISSUES, JSON.stringify(ALL));
    for (const key of [undefined, "", "  "]) {
      const { code, stdout, stderr } = await triage({ TYPESAFE_API_KEY: key });
      expect(code).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe("mt: triage: TYPESAFE_API_KEY is not set; triage needs a jev API key\n");
    }
    expect(ghCalls()).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  test("R9: without gh on PATH it says so in one line on stderr, prints nothing and exits 1", async () => {
    const { code, stdout, stderr } = await triage({ PATH: NOGH });
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: triage: gh is not on PATH\n");
    expect(seen).toHaveLength(0);
  });

  test("R9: when gh fails to list the issues it gives gh's reason in one line, prints nothing and exits 1", async () => {
    const { code, stdout, stderr } = await triage({ FAKE_GH_FAIL: "1" });
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: triage: gh could not list the issues: gh: HTTP 401: Bad credentials\n");
    expect(seen).toHaveLength(0);
  });

  test("R9: when gh lists something other than the issues it says so in one line and exits 1", async () => {
    for (const [listed, reason] of [
      ["not json", "gh listed the issues as something other than JSON"],
      ['[{"number": 1, "title": "t"}]', "gh listed the issues without a number, title and body each"],
    ]) {
      writeFileSync(ISSUES, listed ?? "");
      const { code, stdout, stderr } = await triage();
      expect(code).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe(`mt: triage: ${reason}\n`);
    }
  });

  test("the key reaches jev from TYPESAFE_API_KEY and is never printed, even at debug log level", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA, GUIDE]));
    script = FULL;
    const { code, stdout, stderr } = await triage({ TYPESAFE_LOG_LEVEL: "debug" });
    expect(code).toBe(0);
    expect(seen.map(({ authorization }) => authorization)).toEqual([`Bearer ${KEY}`, `Bearer ${KEY}`, `Bearer ${KEY}`]);
    expect(stdout).toContain("\nduplicates\n");
    expect(stdout).not.toContain(KEY);
    expect(stderr).not.toContain(KEY);
    for (const output of [stdout, stderr]) expect(output).not.toContain(KEY.slice(-4));
    expect(stderr).toContain("-> http://127.0.0.1");
  });

  test("a failing jev call prints one line on stderr, nothing on stdout, and exits 1", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA, GUIDE]));
    script = { ...FULL, fail: { status: 400, body: { detail: "questions: too many" } } };
    const { code, stdout, stderr } = await triage();
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: triage: jev: 400 questions: too many\n");
  });

  test("a failing jev call with a long HTML body prints only the first line of its message, cut at a sensible length", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA, GUIDE]));
    const html = `<html>\n${"<p>upstream is down</p>\n".repeat(60)}</html>`;
    script = { ...FULL, fail: { status: 500, body: html } };
    const { code, stdout, stderr } = await triage();
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr.split("\n")).toHaveLength(2);
    expect(stderr).toMatch(/^mt: triage: jev: .+\n$/);
    expect(stderr).not.toContain("upstream is down");
    expect(stderr.length).toBeLessThan(300);
  });

  test("once a placement call fails, the calls in flight are aborted and no new placement call starts", async () => {
    const issues = Array.from({ length: 10 }, (_, i) => issue(100 + i, `mt list defect ${i}`, "Expected: no defect."));
    writeFileSync(ISSUES, JSON.stringify(issues));
    script = {
      ...FULL,
      change: Object.fromEntries(issues.map(({ number }) => [number, { choice: "mt_code", probability: 0.9, confidence: 0.9 }])),
      verdict: Object.fromEntries(issues.map(({ number }) => [number, { choice: "no_brainer", probability: 0.9, confidence: 0.9 }])),
      failPlacement: 2,
    };
    const { code, stdout, stderr } = await triage();
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: triage: jev: 400 questions: too many\n");
    await gate.allAborted.promise;
    expect(gate.aborted).toBe(PLACEMENT_BATCH - 1);
    expect(gate.late).toBe(0);
    expect(seen).toHaveLength(1 + PLACEMENT_BATCH);
  });

  test("an answer missing from jev's response prints one line on stderr and exits 1", async () => {
    writeFileSync(ISSUES, JSON.stringify([ORCA]));
    script = { ...FULL, omit: "change" };
    const { code, stdout, stderr } = await triage();
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: triage: jev's answer to 'change' is not the shape its question asks for\n");
  });

  test("an argument after triage is a usage error", async () => {
    const { code, stdout, stderr } = await triage({}, "now");
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe("mt: unexpected argument 'now'\nusage: mt dogfood triage\n");
    expect(ghCalls()).toEqual([]);
  });
});
