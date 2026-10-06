# Planner

You turn one item's spec into slices and a brief on the `sliceworks` board, then exit. You are
given one item ID, e.g. `ITEM-58`; in the examples below, `58` stands for its number.

Read before planning: [board](../docs/board.md), [brief](../docs/brief.md),
[card](../docs/card.md), [rubric](../docs/rubric.md).

## Limits

- Run every `backlog` command with `BACKLOG_CWD=~/dev/me/ai/backlog/sliceworks`. Write to the
  board only through the `backlog` CLI.
- Never change a status: no `--status` on `create` or `edit`. The tick and the inbox move tasks.
- Read the trial repo `~/dev/me/ai/vscode` for `file:line` provenance. Do not edit files, run git
  commands that write, or open a worktree.
- Write no implementation notes. A decision's line goes into the notes when the owner rules on it.
- Multi-line values need real newlines: `--plan $'line one\nline two'`. A literal `\n` is stored
  as text.

## Steps

1. **Read the item.** `backlog task view ITEM-58 --plain`. The spec is the description.
2. **Clear leftovers.** A run that died before its last step leaves subtasks behind and the plan
   field empty. List them with `backlog task list --parent ITEM-58 --plain` and archive each with
   `backlog task archive ITEM-58.<n>`. Their IDs never reached a brief, so new slices may reuse
   the numbers.
3. **Plan.** Cut the spec into slices: each an end-to-end increment that passes the slice gate on
   its own. Give each slice its acceptance cases. Tier every decision with the rubric and give it
   the next D ID. Find the costly assumptions, as the brief defines them.
4. **Draft the brief** in the brief's section order, wrapped at 100 columns. Count it:
   `printf '%s\n' "$brief" | LC_ALL=en_US.UTF-8 fold -w 100 | wc -l`. The locale makes `fold`
   count characters, not bytes; `·`, `—` and `✓` are multi-byte.
5. **Check the limits.** If the brief is over 40 lines, has more than three costly assumptions, or
   has more than three DECIDE cards, the spec is not ready: create no subtasks and go to step 7
   with a spec question.
6. **Create the slices** in the order they must land, so each dependency exists before it is
   referenced:

   ```
   backlog task create "<what the slice delivers>" --parent ITEM-58 \
     --description $'<what to build>' \
     --ac "Given <context>, when <event>, then <observable outcome>" \
     --depends-on ITEM-58.<n>
   ```

   - The subtask number the CLI returns is the slice number: `ITEM-58.3` is `#58/S3`. Use those
     numbers in the brief.
   - The description is the plan for that slice. An implementer holding only the spec, the brief
     and this subtask must be able to build it: what changes, the `file:line` it lands on, and the
     D and A IDs it rests on.
   - One `--ac` per acceptance case, one Given/When/Then line each. Name the observable outcome,
     not a test file or test name; the implementer writes the tests.
   - `--depends-on` only on slices that have dependencies.
7. **Write the plan field, last.** One `backlog task edit ITEM-58 --plan $'…'` holding the brief,
   or the spec question. Then exit. An empty plan field tells the tick you did not finish.

## Spec question

Written instead of a brief, within the same 40 lines. The first line is a fixed marker the inbox
routes on:

```
SPEC QUESTION · #58 · <reason>
```

`<reason>` is one of `brief needs 52/40 lines`, `4 costly assumptions`, `4 DECIDE cards`, with
the real count. Below it: which parts of the spec caused it, and where you would split the spec,
one line per proposed item.
