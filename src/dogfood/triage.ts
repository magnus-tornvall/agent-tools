/**
 * `mt dogfood triage`, which cli/mt loads only when it is called. It reads every open issue
 * labelled dogfooding in mt's clone through gh, has jev place each one, and prints the report:
 *
 *   duplicates     issues jev judges to describe the same defect, grouped
 *   no-brainers    defects in mt's own code or tests, where jev's answers that it is mt code and
 *                  that it is a no-brainer each have confidence at or above NO_BRAINER_CONFIDENCE
 *   rule on        everything else: guide wording, Orca's own behaviour, and mt code issues where
 *                  either answer falls short of NO_BRAINER_CONFIDENCE
 *
 * Every issue's line shows its number, its title, and jev's probability and confidence for the
 * placement, and a first line names the jev model that answered. Triage changes nothing on GitHub.
 * jev is reached through @typesafe-ai/sdk, which reads TYPESAFE_API_KEY, TYPESAFE_BASE_URL and
 * TYPESAFE_DEFAULT_MODEL (jev-latest when unset); issue titles and bodies are sent to it.
 *
 * Usage errors exit 2. A missing TYPESAFE_API_KEY, gh missing or failing, and a jev call that
 * fails each print one line on stderr, nothing on stdout, and exit 1.
 */
import { choice, noul, TypeSafeClient, type Logger, type NoulQuestion } from "@typesafe-ai/sdk";
import { z } from "zod";

/** The confidence below which jev's mt-code or no-brainer answer sends the issue to the owner instead. */
export const NO_BRAINER_CONFIDENCE = 0.7;

/** A pair of issues whose same-defect probability is above this is a duplicate. */
const SAME_DEFECT = 0.5;

/** jev answers on many issues at once; each attempt gets this long before the SDK retries. */
const JEV_TIMEOUT_MS = 120_000;

/** Calls to jev in flight at once, under the public endpoint's rate limit. */
const JEV_CONCURRENCY = 4;

const USAGE = "usage: mt dogfood triage\n";

class UsageError extends Error {}

class Failure extends Error {}

const IssueSchema = z.object({ number: z.number().int(), title: z.string(), body: z.string() });
type Issue = z.infer<typeof IssueSchema>;

const NoulAnswer = z.object({ noul: z.number().min(0).max(1) });
const ChoiceAnswer = z.object({
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});

interface Placement {
  issue: Issue;
  /** What the probability and confidence are for, as the report names it. */
  label: string;
  probability: number;
  confidence: number;
}

interface Report {
  /** The models jev's responses name. */
  models: string[];
  duplicates: Placement[][];
  noBrainers: Placement[];
  ruleOn: Placement[];
}

const CHANGE = choice("Resolving this dogfooding issue would change what?", {
  mt_code: "mt's own code or tests in this repo: cli/mt, src/ or test/",
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
  return issues.data.sort((a, b) => a.number - b.number);
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

async function jev<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(`jev: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function pool<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items.entries()];
  let failed = false;
  async function worker(): Promise<void> {
    for (let next = queue.shift(); next !== undefined && !failed; next = queue.shift()) {
      const [index, item] = next;
      try {
        results[index] = await work(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Groups of issues jev judges to describe the same defect, each member placed by its strongest link. */
async function duplicates(client: TypeSafeClient, issues: Issue[], models: Set<string>): Promise<Placement[][]> {
  if (issues.length < 2) return [];
  const pairs: [Issue, Issue][] = [];
  const questions: Record<string, NoulQuestion> = {};
  for (const [i, a] of issues.entries()) {
    for (const b of issues.slice(i + 1)) {
      pairs.push([a, b]);
      questions[`same_${a.number}_${b.number}`] = noul(`Issues #${a.number} and #${b.number} describe the same defect.`);
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
    if (probability <= SAME_DEFECT) continue;
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
    group.push({ issue, label: `same defect as #${link.other}`, probability: link.probability, confidence: noulConfidence(link.probability) });
    groups.set(root, group);
  }
  return [...groups.values()];
}

/** Where one issue that duplicates nothing goes, and jev's numbers for that placement. */
async function place(
  client: TypeSafeClient,
  issue: Issue,
  models: Set<string>,
): Promise<{ bucket: "noBrainers" | "ruleOn"; placement: Placement }> {
  const { answers, model } = await jev(() => client.systemOne({ state: issue, questions: { change: CHANGE, verdict: VERDICT } }));
  models.add(model);
  const change = answer(answers, "change", ChoiceAnswer);
  const changeLabel = CHANGE_LABELS[change.choice];
  if (changeLabel === undefined) throw new Failure(`jev chose '${change.choice}', which the change question does not offer`);
  if (change.choice !== "mt_code") {
    const probability = chosen("change", change);
    return { bucket: "ruleOn", placement: { issue, label: changeLabel, probability, confidence: change.confidence } };
  }
  if (change.confidence < NO_BRAINER_CONFIDENCE) {
    const label = `${changeLabel} below confidence ${NO_BRAINER_CONFIDENCE.toFixed(2)}`;
    return { bucket: "ruleOn", placement: { issue, label, probability: chosen("change", change), confidence: change.confidence } };
  }
  const verdict = answer(answers, "verdict", ChoiceAnswer);
  const probability = chosen("verdict", verdict);
  if (verdict.choice === "no_brainer") {
    const placement = { issue, label: "no-brainer", probability, confidence: verdict.confidence };
    if (verdict.confidence >= NO_BRAINER_CONFIDENCE) return { bucket: "noBrainers", placement };
    return { bucket: "ruleOn", placement: { ...placement, label: `no-brainer below confidence ${NO_BRAINER_CONFIDENCE.toFixed(2)}` } };
  }
  if (verdict.choice === "rule_on") {
    return { bucket: "ruleOn", placement: { issue, label: "rule on", probability, confidence: verdict.confidence } };
  }
  throw new Failure(`jev chose '${verdict.choice}', which the verdict question does not offer`);
}

async function triage(client: TypeSafeClient, issues: Issue[]): Promise<Report> {
  const models = new Set<string>();
  const groups = await duplicates(client, issues, models);
  const grouped = new Set(groups.flat().map(({ issue }) => issue.number));
  const placed = await pool(
    issues.filter((issue) => !grouped.has(issue.number)),
    JEV_CONCURRENCY,
    (issue) => place(client, issue, models),
  );
  return {
    models: [...models].sort(),
    duplicates: groups,
    noBrainers: placed.filter(({ bucket }) => bucket === "noBrainers").map(({ placement }) => placement),
    ruleOn: placed.filter(({ bucket }) => bucket === "ruleOn").map(({ placement }) => placement),
  };
}

function line({ issue, label, probability, confidence }: Placement, indent: string): string {
  const title = issue.title.replace(/\s+/g, " ").trim();
  return `${indent}#${issue.number} ${title}  (${label}: probability ${probability.toFixed(2)}, confidence ${confidence.toFixed(2)})\n`;
}

function render({ models, duplicates, noBrainers, ruleOn }: Report): string {
  let out = models.length === 0 ? "" : `jev model: ${models.join(", ")}\n`;
  out += "duplicates\n";
  if (duplicates.length === 0) out += "  none\n";
  for (const group of duplicates) {
    out += `  ${group.map(({ issue }) => `#${issue.number}`).join(", ")}\n`;
    for (const placement of group) out += line(placement, "    ");
  }
  out += "no-brainers\n";
  if (noBrainers.length === 0) out += "  none\n";
  for (const placement of noBrainers) out += line(placement, "  ");
  out += "rule on\n";
  if (ruleOn.length === 0) out += "  none\n";
  for (const placement of ruleOn) out += line(placement, "  ");
  return out;
}

/** Runs `mt dogfood triage` with the words after it, against the issues of mt's clone at `root`. */
export async function runTriage(args: readonly string[], root: string): Promise<number> {
  try {
    if (args.length > 0) throw new UsageError(`unexpected argument '${args[0]}'`);
    if (!process.env.TYPESAFE_API_KEY?.trim()) throw new Failure("TYPESAFE_API_KEY is not set; triage needs a jev API key");
    const issues = openIssues(root);
    const client = new TypeSafeClient({ logger: STDERR_LOGGER, timeout: JEV_TIMEOUT_MS });
    process.stdout.write(render(await triage(client, issues)));
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
