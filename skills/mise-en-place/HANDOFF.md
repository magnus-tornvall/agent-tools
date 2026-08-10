# Handoff contract

The contract between `mise-en-place` (which produces an approved change directory) and the
implementation loop (which executes it). Written for whoever builds that loop. `mise-en-place`
does not implement any of this.

## Gate

The loop may start only when `change.md` has `approvals.tasks: true`.

## Reads

| source | what |
| --- | --- |
| `change.md` → `plan.approach`, `plan.touchpoints` | how and where |
| `change.md` → `plan.constraints` | decisions already made; do not re-decide them |
| `change.md` → `plan.escalate_if` | conditions that stop the loop |
| `change.md` → `plan.acceptance` | the change-level check |
| `tasks/*.md` | the task list; the directory is the list |
| `spec.outcome`, `spec.kill_criterion`, `spec.non_goals` | context for escalation judgement |

Every `open_questions` list is empty at approval, so the loop never reads one.

## Writes

The loop may write exactly two things:

1. `status` in a task file, `todo` → `done`.
2. A `baseline` block in `change.md`, once, at startup.

```yaml
baseline:
  command: "npm test"
  result: pass          # pass | fail
  duration_s: 34
  commit: a1b2c3d
  clean_tree: true
```

The baseline is recorded by the loop, not at design time, because a baseline taken when
the change was planned is stale by the time the loop starts. Without it the loop cannot
tell its own breakage from breakage that was already there.

**The loop may not edit any other field.** Not `goal`, not `verify`, not `scope`, not a
requirement, and never an `open_questions` list - that one records the user's judgement
and is the user's alone to write.

## Order

1. Create the branch. `mise-en-place` deliberately created none, so the loop chooses it.
2. Record the baseline.
3. Execute tasks in `depends_on` order. Every task leaves the tree green.
4. Run each task's `verify` after implementing it. Exit status decides.
5. After the last task, run `plan.acceptance` if it is non-empty.
6. Open the PR.

## Stops

The loop stops and asks the user when any of these is true:

- Any condition in `plan.escalate_if` holds.
- A task's `verify` fails twice in a row.
- A task's `verify_result` is `unrun` and the command still cannot be run.
- Executing a task would require editing a path listed in that task's `forbidden`.
- `plan.acceptance` fails after every task reports `done`.

Stopping means stopping. It does not mean adapting the plan and continuing.

## Back to `mise-en-place`

A task can prove the plan wrong. The loop does not re-plan; it stops. Re-planning is the
user setting `approvals.plan: false` - which cascades to `approvals.tasks: false` - and
`phase: plan`, then invoking `mise-en-place` again. An approval standing downstream of a
revoked one is malformed state.
