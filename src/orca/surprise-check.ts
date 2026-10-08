/**
 * The surprise check: one Task per item, depending on all of the item's implementation Tasks, that
 * lists what a reader holding only the shape and the answers would not expect. The spec carries a
 * snapshot of the whole shape, taken when the Task is created; rulings made after that reach the
 * check as answers and gates.
 *
 * orca-start's script creates the Task from `surpriseCheckSpec`, passing it as `--spec=<spec>`:
 * Orca reads a separate value starting with `---` as a flag. The tick finds the Task by the `kind`
 * in the spec's frontmatter and opens a gate on it when it fails.
 */

export const SURPRISE_CHECK_KIND = "surprise-check";

export type SurpriseCheck = {
  /** The whole shape, verbatim, whatever produced it. */
  readonly shape: string;
  readonly run: string;
  /** The item's implementation Tasks. */
  readonly checks: readonly string[];
};

export function surpriseCheckSpec(check: SurpriseCheck): string {
  const frontmatter = Bun.YAML.stringify(
    { kind: SURPRISE_CHECK_KIND, run: check.run, checks: check.checks },
    null,
    2,
  );
  const tasks = check.checks.join(", ");
  return `---
${frontmatter.trimEnd()}
---

# Surprise check

Objective: list what a reader holding only the shape and the answers would not expect from the
change made by Tasks ${tasks} of Run ${check.run}.

Follow the orca-worker skill for the starting message and for sending the report, with these
differences: never edit code, never commit, and never ask a question. Anything you cannot settle
goes in the needs-a-decision bin. Never read a worker's transcript or terminal output.

## Inputs

Gather these yourself, with the commands your preamble gives:

- The shape: at the end of this spec. It and the answers are authoritative.
- The questions and answers: \`orca orchestration inbox --full --limit 10000 --json\`, the rows
  with run_id ${check.run}. A question is a row of type question whose payload names one of the
  Tasks above; its answer is the latest other message in its thread.
- The worker reports: \`orca orchestration task-list --run ${check.run} --json\`, the result of
  each Task above.
- The diff: \`orca orchestration worker-list --run ${check.run} --json\` names, for each Task above,
  its completed Dispatch; the worktree is the path after \`::\` in its worktreeId. In that
  worktree, \`git diff main...HEAD\`.
- The rulings on this check: \`orca orchestration gate-list --run ${check.run} --task <your task ID>
  --json\`, the resolution of each resolved gate. A ruling settles the surprise it answers: never
  flag that surprise again.

## Bins

Put each surprise in one bin:

- **Logged assumption**: a decision a worker logged as an assumption; fine, listed in the report.
- **Correctable**: contradicts the shape or an answer where they settle what is right.
- **Needs a decision**: a one-way-door decision no worker logged or asked about, or a
  contradiction the shape and answers do not settle.

## Report

Report \`failed\` when any surprise needs a decision, otherwise \`succeeded\`. The report is the
\`worker_done\` body, in this order:

1. Needs a decision, then correctable: each surprise, with the file and line it is in and the part
   of the shape or the answer it is measured against.
2. Assumptions: each logged assumption (\`S…/A…\`), and whether the diff matches it.
3. Questions and answers (\`S…/Q…\`), each with its answer.
4. Requirements: each requirement in the shape, done or not, with the evidence.

## Shape

Everything below this line is the item's shape, verbatim.

${check.shape}
`;
}
