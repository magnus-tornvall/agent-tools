---
name: orca-tick
description: Run one pass over an Orca Run for its owner - bind the terminal, show what waits on the owner, send their answers and rulings, then advance the Run. Takes the Run ID.
disable-model-invocation: true
compatibility: Requires Bun
---

# orca-tick

One pass over the Run: bind, read, answer, rule, advance, stop. The owner decides; you show
and relay. Every Orca call goes through `scripts/tick.js`, run with `bun` from this skill's root.
Never run `orca` yourself.

The argument is the Run ID. Without one, ask for it.

## The pass

1. `bun scripts/tick.js use --run <run>`. This binds the terminal to the Run and takes it away
   from any other terminal.
2. `bun scripts/tick.js status --run <run>`. Show the owner each section that is not `none`,
   as printed.
3. **Open questions.** For each, show the question and take the owner's answer. Send their
   words unchanged:

   ```bash
   bun scripts/tick.js reply --run <run> --id <message_id> --answer "$(cat <<'EOF'
   <answer>
   EOF
   )"
   ```

   A question the owner skips stays open for the next pass.
4. **Open gates.** Show the gate with its Task's report from Failed attempts, and take the
   owner's ruling. Send it the same way with
   `bun scripts/tick.js gate --run <run> --id <gate_id> --resolution <ruling>`. A resolved surprise
   check is set ready, and step 6 runs it again with the ruling.
5. **Failed attempts** without an open gate. Ask the owner, per Task: retry, cancel or leave. A
   Task shown `ready` crashed; step 6 restarts it on its own, so ask only cancel or leave.
6. `bun scripts/tick.js advance --run <run>`, adding `--retry <task_id>` and
   `--cancel <task_id>` for each choice from step 5 and no other flag. Show its output.

Closed questions, Awaiting merge and Item report are shown, never acted on. Merging is the
owner's.

Then stop. Never loop or wait for the Run; the owner runs the next pass.

## When a command fails

It exits 1 with the reason on stderr; show the reason. A refused `reply` or `gate` sent nothing.
Never work around a refusal with another command.
