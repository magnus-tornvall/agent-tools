/**
 * An implementation Task's spec: that Task's slice of the item's shape, self-contained, with no
 * pointer to the shape. The slice keeps the shape's own field names and IDs, so the surprise check
 * reads a spec against the shape key by key.
 *
 * orca-start's script creates the Task from `taskSpec`, passing it as `--spec=<spec>`: Orca reads
 * a separate value starting with `---` as a flag.
 */

import type { Shape } from "../shape/shape.ts";

export const IMPLEMENTATION_KIND = "implementation";

export type TaskSlice = {
  readonly shape: Shape;
  readonly run: string;
  /** The Task's S ID, which prefixes its questions and assumptions. */
  readonly slice: string;
  readonly title: string;
  /** The requirement IDs the Task owns. */
  readonly owns: readonly string[];
  /** The non-goal and decision IDs that bear on the Task. */
  readonly bears: readonly string[];
};

export function taskSpec(task: TaskSlice): string {
  const frontmatter = Bun.YAML.stringify(
    { kind: IMPLEMENTATION_KIND, run: task.run, slice: task.slice },
    null,
    2,
  );
  return `---
${frontmatter.trimEnd()}
---

# ${task.slice}: ${task.title}

Follow the orca-worker skill. Number this Task's questions and assumptions with the prefix
${task.slice}: ${task.slice}/Q1, ${task.slice}/A1.

The slice below is all of the item's shape this Task carries: the item's outcome, the requirements
this Task owns, the non-goals and decisions that bear on it with the alternatives each decision
rejected, and the item's constraints and touchpoints. Report each requirement in it by its ID.

## Slice

Everything below this line is the slice, in YAML.

${Bun.YAML.stringify(slice(task), null, 2)}`;
}

function slice(task: TaskSlice) {
  const { shape } = task;
  return {
    outcome: shape.outcome,
    requirements: pick(shape.requirements, task.owns),
    non_goals: pick(shape.non_goals, task.bears),
    constraints: shape.constraints,
    touchpoints: shape.touchpoints,
    decisions: Object.fromEntries(
      Object.entries(pick(shape.decisions, task.bears)).map(([id, { decision, rejected }]) => [
        id,
        { decision, rejected },
      ]),
    ),
  };
}

function pick<T>(record: Record<string, T>, ids: readonly string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => ids.includes(id)));
}
