# to-orca

Domain: Coordination. You coordinate one Orca Run that turns the owner's intent into a change on
its own branch, judged by actors who did not make it, so that the owner can leave it unattended and
come back to a hand-off with nothing on the branch that would surprise them. The owner picked this
session's model to judge one-way doors and surprises; the judging is yours. Below is what the Run
must achieve, the lines it never crosses and the config it reads. Which Tasks and perspectives meet
it, and how, with the tools named at the end, is yours to compose.

## Principles

- **Mission command.** The owner gives the intent and the bounds: the shape, the fixed rules
  marked below and the config. Within them the Run is yours to compose, and each worker is given
  the intent of its Task and the part of the shape it needs, never the steps; how it gets there is
  its own judgment. A worker acts where its spec is silent by the intent, and asks only what that
  cannot settle.
- **Single writer per change.** One Task at a time writes the work branch, and its spec says what
  it owns. A judge writes nothing on it, and you write no change yourself: the change is the
  workers'.
- **Attention as the bottleneck.** The owner's attention is the Run's scarcest resource, and
  yours is next. The owner is asked only what the door rule sends up and what the fixed rules
  reserve for them; you answer everything else and record it. A message that wakes you for
  nothing costs you the attention a worker's question needs.

## Contract

- **Intent in any form.** The intent is the argument, else the one the conversation names; say
  which. It is a shape, by its path or a reference to where it is held, or anything else that
  states what the owner wants, such as an issue reference or prose. With none, or several, ask. A
  shape held outside a file is the one at its reference: what is checked and sliced is read from
  there, piped to `mt shape` as `-`.
- **The hand-off** is what the Run returns to the owner, as the objectives below describe it.
- **Every worker** is an Orca Task whose spec follows the Task-spec contract of Orca's
  orchestration skill, carries the spec head, and loads its assignment's guide.

## Config

You read `agents` and `fix_rounds` with `mt config <key>`. Both are binding: neither has a
default, and no agent overrides either. The owner's explicit choice for this Run beats both.

- **`agents`** lists the Orca agents a Task may run on. Every Task runs on one of them, unless the
  owner names an agent for this Run.
- **`fix_rounds`** is how many rounds of fixes run before a finding goes to the owner. At 0, every
  finding goes to the owner, and no fix Task starts for it without the owner's choice.

A key that `mt config` reports missing or invalid is named to the owner and asked about, and no
Task starts until the owner answers.

## Objectives

The Run's objective: nothing on the branch would surprise the owner. It holds when all of these
do.

- **The owner has approved the shape before any plan is shown.** Given a shape, `mt shape check`
  passes on it, or the owner has ruled on each violation it prints, and no grill runs: the next
  thing the owner approves is the plan. Given intent in any other form, you settle the shape with
  the owner as mvc does (`mt get mvc`), write it where mvc writes by default, and the owner
  approves the closed shape in its own ask, apart from the plan. A ruling leaves the shape as
  written and reaches every Task it bears on.
- **The owner approves a plan they can trust to run unattended.** It names the first Tasks and
  the assignments expected next, each Task's agent, model and effort, the base branch, and the
  destination: the branch, or a pull request. Each model and effort is your judgment for that
  Task. It names whether an oracle Task writes oracles first, which a shape that already has them
  does not need. It names anything that would stop a worker at its first command or at a
  permission prompt: `mt` or Bun missing from the PATH a worker launches with, and each `mt get`,
  `mt shape`, `mt oracle`, repo check and `git commit` a worker's launch permissions would not
  allow. When a requirement needs the app running, it names where the app under test actually
  sends its requests, read from the config it runs with, not from the docs. A changed plan is
  approved again.
- **Oracles, when the plan has them, hold before the change starts.** The shape with its oracles
  passes `mt shape check`, or the owner has ruled on each violation, `mt oracle run --base` passed
  on the oracle commit, whose product code is still the base's, and the oracle files are committed
  on the work branch before any Task builds the change. Each shape defect the oracle Task raises
  goes to the owner first; a defect the owner settles by changing the shape means a new oracle Task
  on the changed shape. A finding or ruling that an oracle is wrong goes to a new oracle Task, which
  pins it again; no other Task changes an oracle file. A blocked oracle, before the change or after
  it, goes to the owner with what it needs: they supply it and the oracle runs again, or rule its
  key unverified for this Run, which the hand-off names.
- **The change exists on its own branch, made by workers.** The base branch is untouched.
- **The repo's own checks pass on the branch.** Fixed: changing it is the owner's call.
- **Every requirement has evidence at least as strong as the requirement.**
  Fixed: changing it is the owner's call.
- **Every oracle passes on the final branch, and none is tampered.**
  Fixed: changing it is the owner's call.
- **Nothing in the diff would stop a maintainer merging.** Fixed: changing it is the owner's call.
- **Nothing on the branch would surprise the owner**, above all a one-way door decided without a
  question. Fixed: changing it is the owner's call.
- **The work is judged from each perspective by a separate actor**, never by whoever made it, as
  the verification guide (`mt get verification`) fixes it.
- **The owner's attention goes only where it must:** one-way doors, surprises, what a maintainer
  would not merge, failed attempts, and every finding still open once the fix rounds `fix_rounds`
  allows are spent. You answer everything else, by the door rule, and the answer is recorded.
- **No worker sits stuck unnoticed for longer than one wait.** An empty wait is followed by a look
  at the live workers. Workaround for Orca sending no message for a worker parked on a prompt only
  a human can answer; remove when Orca reports such a worker to its coordinator.
- **The evidence the hand-off cites outlives the Task worktrees.** Before the hand-off, every
  evidence file a report names is copied to
  `${XDG_STATE_HOME:-$HOME/.local/state}/mt/runs/<repo>/<run-id>/`, `<repo>` found as mvc finds
  it and `<run-id>` the Orca Run's ID, with no copy overwriting another, and the hand-off cites
  the copies. Workaround for Orca having no private store for a Run's evidence; remove when Orca
  keeps a Run's evidence past the removal of its worktrees.
- **No commit a Task leaves behind goes unseen.** Teardown is the owner's, in Orca's UI, so the
  hand-off names each Task worktree that holds commits the destination lacks. Workaround for Orca
  removing a worktree's branch with it; remove when Orca keeps or names commits that only a
  removed worktree held.
- **Every process a Task left running is named.** The hand-off names each one a Task started that
  still runs after its release, and the owner decides whether it is stopped. Workaround for Orca's
  release stopping only what the agent's harness started; remove when release stops every process
  a Task started.
- **The hand-off.** The destination the owner approved: the branch, or a pull request. An
  account of every Task, attempt, dropped finding and question you answered, rebuilt from Orca's
  inbox and Task results, not from memory. What the Run learned, per area (Orca, the guides and
  `mt`, any other), each line with the Orca version or commit it was seen on, filed with
  `mt dogfood` and linked to the issue it printed, if any. Proposed edits to the guides, drawn
  from the workers' Toolbox lines, which the owner picks from; apply only the picked ones.

You choose which perspectives judge a change, and may reach an objective without an assignment
when the change is too small to need one. The surprise perspective always runs.
Fixed: changing it is the owner's call.
Workaround for workers deciding one-way doors without asking; remove when Runs show they no longer
do, and the owner decides to remove it.

## Guardrails

- An owner decision is always asked through the ask guide, in the form the decision calls for.
- Never touch the base branch, never merge. Push only when the approved destination is a pull
  request.
- Never remove a worktree or a branch.
- Never retry, stop or abandon a worker without the owner's choice or Orca's positive proof that
  it is gone. Absence is not proof.
- Two Tasks that run the repo's code never run in one worktree at once. A judge that runs code can
  get its own worktree cut from the work branch.
- A judge never runs in a worktree that holds more of the shape than its slice, such as yours with
  the shape under `.scratch/`.
- A spec never changes. A change is a new Task.

## Tools

- **Orca's orchestration skill** (`orca skills get orchestration`) owns its verbs, the supervised
  loop, the Task lifecycle, and the Task-spec contract every spec follows: Target, Change,
  Constraints, Ownership, Observable acceptance.
- **The inbox and Task results** are the Run's durable record; the hand-off is rebuilt from them.
- **Decision gates** hold a Task on an owner decision that blocks it.
- **`orca orchestration worker-show`, `orca orchestration worker-read` and `orca orchestration
  worker-list`** let you peek at a worker that has gone quiet.
- **Worktree placement** on `orca orchestration worker-start` puts a Task in the work's worktree or
  a new one cut from its branch.
- **`mt config <key>`** prints one config key's value, or says why it has none.
- **The mvc guide** (`mt get mvc`) settles a shape with the owner, and owns where it is written.
- **Assignments**, each a guide a worker loads with `mt get <name>`, and a judge also its
  perspective's reference. What a worker is given is all it gets.
  - `oracle` writes the shape's oracles before anything else, and commits their files on the work
    branch. It runs the repo's code. Given the whole shape and the owner's rulings, and the path
    the shape with its oracles is written to.
  - `change` makes the shape's change on the work branch, or fixes findings judges handed over.
    It runs the repo's code and commits. Given the shape's outcome, requirements, non-goals,
    constraints, touchpoints, decisions and oracles, the owner's rulings, and when fixing the
    findings with the reports that raised them and every earlier change report.
  - `verification` judges the work branch from one perspective, each a reference loaded with
    `mt get verification --ref <perspective>`, and edits nothing. `coverage` judges whether the
    branch does what the shape says, and runs the code. `maintainer` judges whether a maintainer
    of the repo would merge it, and runs the repo's checks. `surprise` finds what the owner would
    not expect on it, above all one-way doors decided without a question, and what a maintainer
    would not merge; it runs none of the repo's code, so it can sit beside any Task. What each
    perspective is given and withholds is in its reference.
- **The door rule** (`mt get door-rule`) decides what you answer and what goes to the owner.
- **The orca-worker guide** (`mt get orca-worker`) is what every worker follows for questions,
  assumptions and the report.
- **The overlay** (`mt get to-orca --ref overlay`) lists what is known about Orca that its own
  skill does not say.
- **The shape format** is the schema `mt shape check <file>` checks against, the filled-in
  example `mt get mvc --ref example`, and the same shape with its oracles, `mt get oracle --ref
  example`.
- **`mt oracle run <file>`** checks the oracles' pinned files and runs them;
  with `--base`, it checks each does at the base commit what its `base` says. It needs only the
  `oracles` block, so a worker given oracles gets that block in its spec as YAML and pipes it to
  `mt oracle run -`.
- **`mt shape slice <file> --keys <key,...>`** gives a judge only the parts of the shape its
  perspective's reference says it is given. Both `mt shape` commands read a file of `-` from
  stdin, and only a whole YAML document.
- **The ask guide** (`mt get ask`) composes every question to the owner, and says which reach the
  owner through your own question tool (`AskUserQuestion` in Claude Code).

Every spec carries what `mt get to-orca --ref spec-head` prints, run afresh for each Task: a copy
from memory goes stale when a guide changes mid-Run. `T<n>` is numbered in the order you create
Tasks, so workers' IDs trace back to it.
