---
name: to-orca
description: Turn a shape into an Orca Run with one implementation Task, then drive the Run from this session - answer workers, add review and fixer Tasks from its task files until the work is clean, and bring the owner, as options, only one-way doors, surprises and what a maintainer would not merge. Takes a shape that follows mvc's example.
disable-model-invocation: true
---

# to-orca

Propose one implementation Task for a shape, start it once the owner approves, then drive the Run
by judgement until the work on its branch is clean. The owner picked this session's model to judge
one-way doors and surprises; the judging is yours. There are no scripts: you read the shape and
the task files and run `orca orchestration` yourself.

## Asking the owner

Whenever you need the owner's attention or decision, give them options to choose from: your
question tool (`AskUserQuestion` in Claude Code), two to four options, your recommendation first,
each saying what choosing it does. Never an open-ended question. An answer outside the options is
still the owner's answer.

## The shape

One YAML document whose format `../mvc/assets/example.yaml` (from this skill's root) shows. Take
its path from the argument, else the shape file the conversation names, and say which. With no
path, or several, ask, offering the candidates you found.

Read it by judgement; no script checks it. Before proposing anything, ask about each part that is
missing or that does not read the way the example does: no outcome, no requirement, a requirement
with neither `given`/`when`/`then` nor a `text` with its `reason`, a non-goal without its `type`, a
decision without a rejected alternative, YAML that does not parse. One question per part; the
options are the readings or fixes you can see. The chosen answer is an owner's ruling: the shape
stays as written, and the answer goes under Owner's rulings in each Task it bears on.

## The task files

Each file in `tasks/` is one kind of Task, named by its file. Its frontmatter:

- `carries` - the shape keys its Task description copies.
- `skills` - skills its worker loads besides orca-worker.
- `agent`, `model`, `effort` - passed to `worker-start`. Its receipt shows `launch.requested` and
  `launch.effective`; when they differ, show the owner with options before you start anything
  else.

Its body is the Task's objective. The usual path is `implement`, then the reviews, then `fixer`
when they find something, then the reviews again. The task files are a toolbox, not a sequence:
each finished Task decides what comes next.

Every Task runs in the one worktree `implement` starts in. Two Tasks that run the repo's
checks or the code there must not run at the same time, or their builds and tests collide: make
the later one depend on the earlier. Tasks that only read can run beside anything. Read each
task file's objective to tell which it does; `diff-review` and `shape-review` both run code,
`surprise-review` only reads.

## A Task description

~~~
# T<n>: <task file name>

<the task file's body>

Branch: <branch>, based on <base>

Shape:
```yaml
<each key the task file carries, copied verbatim from the shape>
```

Reports:
<the report of each Task this one depends on; a review's or fixer's also has the implementer's
report and every earlier fixer's>

Owner's rulings:
<the owner's answers that bear on this Task, verbatim>

Load the <skills> skill. Follow the orca-worker skill for questions, assumptions and the report.
~~~

Leave out a section with nothing in it, and the Load sentence when `skills` is empty; the
implementation Task has no branch line yet. `T<n>` numbers the Run's Tasks in the order you
create them, and workers prefix their question, assumption and finding IDs with it.

Pass the description as `--spec=<text>`: a spec starting with `---` after a plain `--spec` reads as
a flag. Use a quoted heredoc so the shell changes nothing:

```bash
orca orchestration task-create --run <run> --task-title "T1: implement" --spec="$(cat <<'EOF'
<the description>
EOF
)" --json
```

`--deps` takes a JSON array of Task IDs: `--deps '["<task id>"]'`.

## Proposing

Create nothing in Orca yet. Show:

- the implementation Task: its title, that it owns every requirement (list their IDs), the keys
  it carries, its agent, model and effort, and the base branch - the repo's default unless the
  owner says otherwise;
- the task files you expect to use after it, one line each on when it runs;
- whether the workers can run unattended. Find the repo's lint, typecheck, test and build
  commands, and read the permissions a worker launches with: for a `claude` worker, the
  `.claude/settings.json` committed on the base branch, unless the owner's new-agent-tab
  setting skips prompts. Name each command, and `git commit`, that would stop at a prompt.
  A worker stopped at a prompt sends nothing, and the Run waits on it.

Then ask whether to start it, with options. A changed proposal is a new proposal and is asked
again.

## Starting

On approval, go on without another prompt:

1. `run-create --objective "<the shape's outcome>" --json`. This binds this terminal as the Run's
   only inbox reader, and moves it off any Run it coordinated before.
2. Note the base branch's commit (`git rev-parse <base>`).
3. `task-create` the implementation Task.
4. `worker-start --run <run> --task <task> --worktree new-top-level --name <short slug>
   --base-branch <base> --agent <agent> --model <model> --effort <effort> --json`, taking agent,
   model and effort from `tasks/implement.md`. It exits 0 only when the worker is ready. On a
   non-zero exit, never relaunch: show the owner the receipt's `failedStage` and
   `residualResources`, with options.
5. Find the work's branch: `worker-list --run <run> --json` gives the worktree in
   `resource.worktreeId`, its path after the `::`; `git -C <path> branch --show-current` names the
   branch. Every later Task runs in that worktree.

## Driving the Run

Load Orca's orchestration skill (`orca skills get orchestration`) and drive as its supervised loop
says: `check --wait --types "worker_done,escalation,question"`, process every message in the
batch, then ack it. A wait is long, so run it as a background command and end your turn; you wake
when it returns. What follows is what this Run adds to that loop.

### A question

A worker's question arrives as a `question` message. Never open a gate for it; answer with
`reply --id <message id> --body`, through a quoted heredoc.

Reply yourself, and show the owner nothing, when the shape, the owner's rulings and the repo let
you answer it, and the answer is a two-way door, would not surprise the owner, and would not stop
a maintainer merging. Otherwise - you cannot answer it, or it is a one-way door, or it would
surprise the owner, or a maintainer would not merge it - show the owner the question with options,
and reply with the chosen answer verbatim. Keep every question and its answer for the end report.

A worker's ask waits at most 30 minutes and is asked again after each timeout, so a reply reaches
it however long the owner takes, as long as the worker is still running. A reply to a worker that
has ended is refused with `dispatch_inactive` and sends nothing; tell the owner, with options.

### A Task finished

On each `worker_done`:

1. Check it is the Task and Dispatch you expect, and read its report: the message's body, or
   `result.body` in `task-list --run <run> --json`.
2. Release the worker: `worker-release --dispatch <dispatch>`. The worktree and branch stay.
3. If the outcome is `failed`, it is a failed attempt (below); start nothing after that Task until
   the owner chooses.
4. Otherwise add the next Tasks you judge needed from the task files, each depending on the finished
   Task, and start them without asking the owner:
   - **After implement** - the reviews the work calls for.
   - **After a review** - start any review of the round that was waiting for this one. Once every
     review of the round has reported, judge the findings. Drop any you judge wrong or already
     settled by the shape or a ruling, and say so in the end report. Then:
     - none left: the work is clean; end the Run.
     - a finding whose fix is a one-way door: show it to the owner with options before any fixer
       starts.
     - no fixer has run yet: add one fixer Task depending on every review of the round that
       succeeded, carrying their reports and the implementer's report.
     - a fixer has run: show the owner the findings with options - another fixer on some or all
       of them, accept the work as it is, or stop - before another fixer starts.
   - **After a fixer** - the reviews again, depending on the fixer.

   Start each with `worker-start --run <run> --task <task> --worktree branch:<branch> --agent
   <agent> --model <model> --effort <effort> --json`, from its task file's frontmatter.

### A failed attempt

An attempt fails when its worker reports `failed`, or exits without a report: Orca then sends an
escalation, "Agent exited unexpectedly", and puts the Task back to `ready`. Retry only when the
owner chooses it. Show them the report, or the escalation and the end of `worker-read`, with the
options that fit:

- **Retry as it is** - the same spec. A `failed` Task takes `worker-start --run <run> --task
  <task> --retry-of <its latest dispatch> --worktree branch:<branch> --agent <agent> --model
  <model> --effort <effort> --json`; `--retry-of` does not carry placement over, so repeat it. A
  `ready` Task refuses `--retry-of`: start it the same way without it.
- **Retry with a ruling** - a spec never changes, so add a new Task from the same task file, the
  next `T<n>`, with the owner's answer under Owner's rulings and the failed attempt's report
  under Reports, depending on what the failed Task depended on. Start it as above, without
  `--retry-of`.
- **Go on without it**, or **stop the Run**.

Keep each failed attempt, and what the owner chose, for the end report.

### Anything else

An escalation, or anything else you cannot act on by judgement, goes to the owner with options.
Never stop, retry or abandon a worker on absence alone; the orchestration skill says what counts
as proof. When waits come back empty and `worker-list` shows a worker live, `worker-read` it; a
worker stopped at a permission prompt goes to the owner with options.

## Ending the Run

The work is clean when the latest reviews leave no finding, or the owner chose to accept what is
left. Never merge, push or commit to the base branch; the work stays on its branch.

1. Confirm `worker-list --run <run> --terminal-state reclaimable --json` returns no worker, and
   that the base branch is still at the commit you noted.
2. Report to the owner:
   - the branch holding the work, and that the base branch is unchanged;
   - each Task: its task file, outcome, number of attempts and one line;
   - each failed attempt: why it failed, and what the owner chose;
   - findings left open or dropped, and why;
   - the questions you answered without the owner, with your answers.
3. **Toolbox.** Collect the reports' Toolbox lines that are not `none`. Turn each into a concrete
   edit to a file in this skill's `tasks/` - its frontmatter or its objective - and show the
   edits as options the owner can pick several of, or none. Apply only the chosen edits. With no
   Toolbox lines, skip this.
