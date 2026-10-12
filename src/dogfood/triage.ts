/**
 * `mt dogfood triage`, which cli/mt loads only when it is called. It reads every open issue
 * labelled dogfooding in mt's clone through gh, has jev place each one, and prints the report:
 *
 *   duplicates     issues jev judges to report at least one same problem, grouped
 *   no-brainers    defects in mt's own code or tests, where jev's answers that it is mt code and
 *                  that it is a no-brainer each have confidence at or above the owner's
 *                  triage_confidence
 *   rule on        everything else: guide wording, Orca's own behaviour, and mt code issues where
 *                  either answer falls short of triage_confidence
 *
 * triage_confidence is an advisory key of the owner's config: it only labels items and authorizes
 * nothing. When it is missing or invalid triage still runs, labels nothing a no-brainer, and says
 * so on the report's first line; otherwise that line states it. Every issue's line shows its number,
 * its title, and jev's probability and confidence for each answer it gave, and a line names the jev
 * model that answered. The footer `mt dogfood` appends to a body is not sent to jev. Triage changes
 * nothing on GitHub. The first jev call to fail aborts the calls still in flight and starts no more.
 * jev is reached through @typesafe-ai/sdk, which reads TYPESAFE_API_KEY, TYPESAFE_BASE_URL and
 * TYPESAFE_DEFAULT_MODEL (jev-latest when unset); issue titles and bodies are sent to it.
 *
 * Usage errors exit 2. A missing TYPESAFE_API_KEY, gh missing or failing, and a jev call that
 * fails each print one line on stderr, nothing on stdout, and exit 1.
 */
import { choice, noul, TypeSafeClient, type Logger, type NoulQuestion } from "@typesafe-ai/sdk";
import { z } from "zod";
import { lookup, problem, readConfig } from "../config/config.ts";

/** A pair of issues whose shared-problem probability is above this is a duplicate. */
const SHARED_PROBLEM = 0.6;

/** jev answers on many issues at once; each attempt gets this long before the SDK retries. */
const JEV_TIMEOUT_MS = 120_000;

/** Calls to jev in flight at once, under the public endpoint's rate limit. */
const JEV_CONCURRENCY = 4;

const USAGE = "usage: mt dogfood triage\n";

class UsageError extends Error {}

class Failure extends Error {}

const IssueSchema = z.object({ number: z.number().int(), title: z.string(), body: z.string() });
type Issue = z.infer<typeof IssueSchema>;

/** How the footer cli/mt's seenOn appends to a filed body starts; the footer runs to the body's end. */
const FOOTER = "---\nFiled with `mt dogfood`.\n";

/** The body without that footer, whose commit, session and worktree lines say nothing about the issue. */
function withoutFooter(body: string): string {
  const at = body.lastIndexOf(FOOTER);
  if (at === -1 || (at > 0 && body[at - 1] !== "\n")) return body;
  return body.slice(0, at).trimEnd();
}

const NoulAnswer = z.object({ noul: z.number().min(0).max(1) });
const ChoiceAnswer = z.object({
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});

/** jev's probability for the answer it chose, and its confidence in it. */
interface Score {
  /** Which answer this is, when a line shows more than one. */
  name?: string;
  probability: number;
  confidence: number;
}

interface Placement {
  issue: Issue;
  /** What the scores are for, as the report names it. */
  label: string;
  scores: Score[];
}

interface Report {
  /** The models jev's responses name. */
  models: string[];
  duplicates: Placement[][];
  noBrainers: Placement[];
  ruleOn: Placement[];
}

const CHANGE = choice("Resolving this dogfooding issue would change what?", {
  mt_code: "mt's own code or tests in this repo: cli/mt, src/, test/ or the Makefile",
  guide: "the wording of a guide or skill in this repo",
  orca: "the behaviour of Orca itself, which is not code in this repo",
});

const VERDICT = choice("Can an agent implement this issue's fix without the owner ruling on anything?", {
  no_brainer:
    "Yes: it reports a defect in mt's own code or tests, states the expected behaviour, and leaves one obvious fix",
  rule_on:
    "No: the expected behaviour is unstated or arguable, several fixes are reasonable, or the fix changes how mt is used",
});

const CHANGE_LABELS: Record<string, string> = { mt_code: "mt code", guide: "guide", orca: "Orca" };

const VERDICT_LABELS: Record<string, string> = { no_brainer: "no-brainer", rule_on: "rule on" };

const CREDENTIAL_HEADERS = new Set(["authorization", "proxy-authorization", "x-api-key", "cookie", "set-cookie"]);

/** The SDK's debug log keeps the last four characters of a credential header; none of the key may show. */
function withoutCredentials(arg: unknown): unknown {
  if (typeof arg !== "object" || arg === null || !("headers" in arg)) return arg;
  const { headers } = arg;
  if (typeof headers !== "object" || headers === null) return arg;
  const masked = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, CREDENTIAL_HEADERS.has(name.toLowerCase()) ? "***" : value]),
  );
  return { ...arg, headers: masked };
}

/** The SDK logs request summaries on stdout through console; triage keeps stdout for the report. */
function toStderr(message: string, ...args: unknown[]): void {
  console.error(message, ...args.map(withoutCredentials));
}

const STDERR_LOGGER: Logger = { debug: toStderr, info: toStderr, warn: toStderr, error: toStderr };

function openIssues(root: string): Issue[] {
  if (Bun.which("gh") === null) throw new Failure("gh is not on PATH");
  const result = Bun.spawnSync(
    ["gh", "issue", "list", "--state", "open", "--label", "dogfooding", "--json", "number,title,body", "--limit", "1000"],
    { cwd: root, env: { ...process.env, GH_PROMPT_DISABLED: "1" }, stdin: "ignore" },
  );
  if (!result.success) {
    const reason = result.stderr.toString().split("\n").find((line) => line.trim() !== "") ?? "gh failed";
    throw new Failure(`gh could not list the issues: ${reason.trim()}`);
  }
  let listed: unknown;
  try {
    listed = JSON.parse(result.stdout.toString());
  } catch {
    throw new Failure("gh listed the issues as something other than JSON");
  }
  const issues = z.array(IssueSchema).safeParse(listed);
  if (!issues.success) throw new Failure("gh listed the issues without a number, title and body each");
  return issues.data.map((issue) => ({ ...issue, body: withoutFooter(issue.body) })).sort((a, b) => a.number - b.number);
}

function answer<T>(answers: Readonly<Record<string, unknown>>, key: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(answers[key]);
  if (!parsed.success) throw new Failure(`jev's answer to '${key}' is not the shape its question asks for`);
  return parsed.data;
}

/** jev's probability for the label it chose. */
function chosen(key: string, { choice, probabilities }: z.infer<typeof ChoiceAnswer>): number {
  const probability = probabilities[choice];
  if (probability === undefined) throw new Failure(`jev's answer to '${key}' gives no probability for its choice '${choice}'`);
  return probability;
}

/** The documented confidence of a noul: its distance from an even split, on the choice scale. */
function noulConfidence(probability: number): number {
  return Math.abs(2 * probability - 1);
}

/** An error line is one line: the first line of the message, cut at this many characters. */
const MESSAGE_LIMIT = 200;

function firstLine(message: string): string {
  const line = (message.split("\n").find((candidate) => candidate.trim() !== "") ?? "").trim();
  return line.length > MESSAGE_LIMIT ? `${line.slice(0, MESSAGE_LIMIT)}…` : line;
}

async function jev<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(`jev: ${firstLine(error instanceof Error ? error.message : String(error))}`);
  }
}

/** Runs `work` over the items, `limit` at a time. The first failure aborts the calls in flight and starts no more. */
async function pool<T, R>(items: readonly T[], limit: number, work: (item: T, signal: AbortSignal) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items.entries()];
  const abort = new AbortController();
  async function worker(): Promise<void> {
    for (let next = queue.shift(); next !== undefined && !abort.signal.aborted; next = queue.shift()) {
      const [index, item] = next;
      try {
        results[index] = await work(item, abort.signal);
      } catch (error) {
        abort.abort();
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Groups of issues jev judges to report at least one same problem, each member placed by its strongest link. */
async function duplicates(client: TypeSafeClient, issues: Issue[], models: Set<string>): Promise<Placement[][]> {
  if (issues.length < 2) return [];
  const pairs: [Issue, Issue][] = [];
  const questions: Record<string, NoulQuestion> = {};
  for (const [i, a] of issues.entries()) {
    for (const b of issues.slice(i + 1)) {
      pairs.push([a, b]);
      questions[`same_${a.number}_${b.number}`] = noul(
        `At least one problem reported in issue #${a.number} is also reported in issue #${b.number}: fixing that problem for one issue would fix it for the other.`,
      );
    }
  }
  const { answers, model } = await jev(() => client.systemOne({ state: { issues }, questions }));
  models.add(model);

  const parent = new Map(issues.map((issue) => [issue.number, issue.number]));
  const find = (n: number): number => {
    const p = parent.get(n) ?? n;
    return p === n ? n : find(p);
  };
  const strongest = new Map<number, { other: number; probability: number }>();
  for (const [a, b] of pairs) {
    const { noul: probability } = answer(answers, `same_${a.number}_${b.number}`, NoulAnswer);
    if (probability <= SHARED_PROBLEM) continue;
    parent.set(find(b.number), find(a.number));
    for (const [self, other] of [[a.number, b.number], [b.number, a.number]] as const) {
      if ((strongest.get(self)?.probability ?? -1) < probability) strongest.set(self, { other, probability });
    }
  }

  const groups = new Map<number, Placement[]>();
  for (const issue of issues) {
    const link = strongest.get(issue.number);
    if (link === undefined) continue;
    const root = find(issue.number);
    const group = groups.get(root) ?? [];
    const scores = [{ probability: link.probability, confidence: noulConfidence(link.probability) }];
    group.push({ issue, label: `shares a problem with #${link.other}`, scores });
    groups.set(root, group);
  }
  return [...groups.values()];
}

/** The fewest decimal places, at least two, that write `value` exactly. */
function placesIn(value: number): number {
  let places = 2;
  while (places < 20 && Number(value.toFixed(places)) !== value) places++;
  return places;
}

/** The threshold as the owner wrote it, with at least two places. */
function threshold(value: number): string {
  return value.toFixed(placesIn(value));
}

/**
 * Where one issue that duplicates nothing goes, and jev's numbers for each of its answers. Without
 * a confidence threshold no mt code issue is labelled, and each goes to rule on.
 */
async function place(
  client: TypeSafeClient,
  issue: Issue,
  confidence: number | null,
  models: Set<string>,
  signal: AbortSignal,
): Promise<{ bucket: "noBrainers" | "ruleOn"; placement: Placement }> {
  const { answers, model } = await jev(() =>
    client.systemOne({ state: issue, questions: { change: CHANGE, verdict: VERDICT } }, { signal }),
  );
  models.add(model);
  const change = answer(answers, "change", ChoiceAnswer);
  const changeLabel = CHANGE_LABELS[change.choice];
  if (changeLabel === undefined) throw new Failure(`jev chose '${change.choice}', which the change question does not offer`);
  const verdict = answer(answers, "verdict", ChoiceAnswer);
  const verdictLabel = VERDICT_LABELS[verdict.choice];
  if (verdictLabel === undefined) throw new Failure(`jev chose '${verdict.choice}', which the verdict question does not offer`);
  const scores = [
    { name: `change ${changeLabel}`, probability: chosen("change", change), confidence: change.confidence },
    { name: `verdict ${verdictLabel}`, probability: chosen("verdict", verdict), confidence: verdict.confidence },
  ];
  if (change.choice !== "mt_code") return { bucket: "ruleOn", placement: { issue, label: changeLabel, scores } };
  if (confidence === null) return { bucket: "ruleOn", placement: { issue, label: `${changeLabel}, no threshold`, scores } };
  const below = `below confidence ${threshold(confidence)}`;
  if (change.confidence < confidence) {
    return { bucket: "ruleOn", placement: { issue, label: `${changeLabel} ${below}`, scores } };
  }
  if (verdict.choice !== "no_brainer") return { bucket: "ruleOn", placement: { issue, label: verdictLabel, scores } };
  if (verdict.confidence < confidence) {
    return { bucket: "ruleOn", placement: { issue, label: `${verdictLabel} ${below}`, scores } };
  }
  return { bucket: "noBrainers", placement: { issue, label: verdictLabel, scores } };
}

async function triage(client: TypeSafeClient, issues: Issue[], confidence: number | null): Promise<Report> {
  const models = new Set<string>();
  const groups = await duplicates(client, issues, models);
  const grouped = new Set(groups.flat().map(({ issue }) => issue.number));
  const placed = await pool(
    issues.filter((issue) => !grouped.has(issue.number)),
    JEV_CONCURRENCY,
    (issue, signal) => place(client, issue, confidence, models, signal),
  );
  return {
    models: [...models].sort(),
    duplicates: groups,
    noBrainers: placed.filter(({ bucket }) => bucket === "noBrainers").map(({ placement }) => placement),
    ruleOn: placed.filter(({ bucket }) => bucket === "ruleOn").map(({ placement }) => placement),
  };
}

/** A probability or confidence cut, not rounded, to `places`, so a value under the threshold never prints as the threshold. */
function cut(value: number, places: number): string {
  return value.toFixed(places + 6).slice(0, -6);
}

function line({ issue, label, scores }: Placement, indent: string, places: number): string {
  const title = issue.title
    .replace(/(?!\s)\p{Cc}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const shown = scores
    .map(({ name, probability, confidence }) => `${name === undefined ? "" : `${name} `}probability ${cut(probability, places)}, confidence ${cut(confidence, places)}`)
    .join("; ");
  return `${indent}#${issue.number} ${title}  (${label}: ${shown})\n`;
}

/** The report: a first line on the threshold, then the model line and the three groups, scores cut to the threshold's `places`. */
function render(first: string, { models, duplicates, noBrainers, ruleOn }: Report, places: number): string {
  let out = `${first}\n`;
  if (models.length > 0) out += `jev model: ${models.join(", ")}\n`;
  out += "duplicates\n";
  if (duplicates.length === 0) out += "  none\n";
  for (const group of duplicates) {
    out += `  ${group.map(({ issue }) => `#${issue.number}`).join(", ")}\n`;
    for (const placement of group) out += line(placement, "    ", places);
  }
  out += "no-brainers\n";
  if (noBrainers.length === 0) out += "  none\n";
  for (const placement of noBrainers) out += line(placement, "  ", places);
  out += "rule on\n";
  if (ruleOn.length === 0) out += "  none\n";
  for (const placement of ruleOn) out += line(placement, "  ", places);
  return out;
}

/** Runs `mt dogfood triage` with the words after it, against the issues of mt's clone at `root`. */
export async function runTriage(args: readonly string[], root: string): Promise<number> {
  try {
    if (args.length > 0) throw new UsageError(`unexpected argument '${args[0]}'`);
    if (!process.env.TYPESAFE_API_KEY?.trim()) throw new Failure("TYPESAFE_API_KEY is not set; triage needs a jev API key");
    const config = readConfig();
    const found = lookup(config, "triage_confidence");
    const confidence = found.ok ? found.value : null;
    const first = found.ok
      ? `triage_confidence: ${threshold(found.value)}`
      : `triage_confidence: ${problem(config, found)}; nothing is labelled a no-brainer`;
    const issues = openIssues(root);
    const client = new TypeSafeClient({ logger: STDERR_LOGGER, timeout: JEV_TIMEOUT_MS });
    process.stdout.write(render(first, await triage(client, issues, confidence), found.ok ? placesIn(found.value) : 2));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`mt: ${error.message}\n${USAGE}`);
      return 2;
    }
    if (error instanceof Failure) {
      process.stderr.write(`mt: triage: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
