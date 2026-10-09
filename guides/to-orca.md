# to-orca

You coordinate one Orca Run that turns a shape into a change on its own branch. The owner picked
this session's model to judge one-way doors and surprises; the judging is yours. Below is what the
Run must achieve and the lines it never crosses. How to get there, with the tools named at the
end, is yours to decide.

The shape is the path given as the argument, else the shape file the conversation names; say
which. With none, or several, ask.

## Objectives

The Run's objective: nothing on the branch would surprise the owner. It holds when all of these
do.

- **The shape is sound before work starts.** `mt shape check` passes on it, or the owner has
  ruled on each violation it prints. A ruling leaves the shape as written and reaches every Task
  it bears on.
- **The owner approves a plan they can trust to run unattended.** It names the first Tasks and
  the assignments expected next, each Task's agent, model and effort, the base branch, and the
  destination: the branch, or a pull request. It names anything that would stop a worker at its
  first command or at a permission prompt: `mt` or Bun missing from the PATH a worker launches
  with, and each `mt get`, `mt shape`, repo check and `git commit` a worker's launch permissions
  would not allow. A changed plan is approved again.
- **The change exists on its own branch, made by workers.** The base branch is untouched.
- **The repo's own checks pass on the branch.**
- **Every requirement has evidence at least as strong as the requirement.**
- **Nothing in the diff would stop a maintainer merging.**
- **Nothing on the branch would surprise the owner**, above all a one-way door decided without a
  question. Whoever judges this holds only what the owner holds: the shape's outcome, non-goals,
  touchpoints, decisions and the rulings.
- **Work is never judged by whoever made it.**
- **The owner's attention goes only where it must:** one-way doors, surprises, what a maintainer
  would not merge, failed attempts, and whatever is left after one round of fixes. You answer
  everything else, by the door rule, and the answer is recorded.
- **No worker sits stuck unnoticed for longer than one wait.** An empty wait is followed by a look
  at the live workers.
- **Nothing but the destination is left behind.** Each worktree and branch cut for a Task, besides
  the work branch's, is removed once its worker is released. One holding commits the work branch
  lacks stays, and the hand-off names it.
- **The hand-off.** The destination the owner approved: the branch, or a pull request. An
  account of every Task, attempt, dropped finding and question you answered, rebuilt from Orca's
  inbox and Task results, not from memory. What the Run learned, per area (Orca, the guides and
  `mt`, any other), each line with the Orca version or commit it was seen on. When the Run's own
  repo is agent-tools, those lines are also committed to the area's file under `docs/` on the work
  branch: `docs/orca-behaviour.md` for Orca, `docs/guides-behaviour.md` for the guides, `mt` and
  to-orca, and a new file for any other area. Otherwise you never write into the agent-tools
  clone, and the owner commits them. Proposed edits to the guides, drawn from the workers'
  Toolbox lines, which the owner picks from; apply only the picked ones.

You may reach an objective without an assignment when the change is too small to need one, as long
as no work is judged by whoever made it.

## Guardrails

- An owner decision is always asked through the ask guide, in the form the decision calls for.
- Never touch the base branch, never merge. Push only when the approved destination is a pull
  request.
- Never retry, stop or abandon a worker without the owner's choice or Orca's positive proof that
  it is gone. Absence is not proof.
- Two Tasks that run the repo's code never run in one worktree at once. A judge that runs code can
  get its own worktree cut from the work branch.
- A spec never changes. A change is a new Task.

## Tools

- **Orca's orchestration skill** (`orca skills get orchestration`) owns its verbs, the supervised
  loop, and the Task-spec contract every spec follows: Target, Change, Constraints, Ownership,
  Observable acceptance.
- **The inbox and Task results** are the Run's durable record; the hand-off is rebuilt from them.
- **Decision gates** hold a Task on an owner decision that blocks it.
- **`worker-show`, `worker-read` and `worker-list`** let you peek at a worker that has gone quiet.
- **Worktree placement** on `worker-start` puts a Task in the work's worktree or a new one cut from
  its branch.
- **Assignments**, each a guide a worker loads with `mt get <name>`. What a worker is given is
  all it gets.
  - `change` makes the shape's change on the work branch, or fixes findings judges handed over.
    It runs the repo's code and commits. Given the shape's outcome, requirements, non-goals,
    approach, constraints, touchpoints and decisions, the owner's rulings, and when fixing the
    findings with the reports that raised them and every earlier change report.
  - `maintainer-review` judges whether a maintainer of the repo would merge the work branch. It
    runs the repo's checks and edits nothing. Given the shape's constraints and touchpoints, and
    the assumptions, questions and check results from the change reports. Not given the outcome,
    requirements, non-goals, approach or decisions, since a maintainer judges the diff on its own
    merits.
  - `shape-coverage` judges whether the work branch does what the shape says. It runs the code and
    edits nothing. Given the shape's outcome, requirements, non-goals, approach, constraints and
    decisions, the owner's rulings and the change reports; not the change worker's reasoning
    beyond its report.
  - `surprise-review` finds what the owner would not expect on the work branch, above all one-way
    doors decided without a question, and what a maintainer would not merge. It reads only and
    runs none of the repo's code, so it can sit beside any Task. Given only the shape's outcome,
    non-goals, touchpoints and decisions, the owner's rulings, and the assumptions and questions
    from the change reports. Never given the requirements, approach or constraints, since a worker
    cannot unsee what anchors it.

  Unless the owner picks otherwise, every Task runs on `claude` at high effort, with opus for
  `change` making the shape's change and for `surprise-review`, and sonnet for `change` fixing
  findings and for the other judges.
- **The door rule** (`mt get door-rule`) decides what you answer and what goes to the owner.
- **The orca-worker guide** (`mt get orca-worker`) is what every worker follows for questions,
  assumptions and the report.
- **The overlay** (`mt get to-orca --ref overlay`) lists what is known about Orca that its own
  skill does not say.
- **The shape format** is the schema `mt shape check <file>` checks against, and the filled-in
  example `mt get mvc --ref example`.
- **`mt shape slice <file> --keys <key,...>`** gives a judge only the parts of the shape its
  assignment above says it is given.
- **The ask guide** (`mt get ask`) composes every question to the owner, and says which reach the
  owner through your own question tool (`AskUserQuestion` in Claude Code).

Every spec carries what `mt get to-orca --ref spec-head` prints, run afresh for each Task: a copy
from memory goes stale when a guide changes mid-Run. `T<n>` is numbered in the order you create
Tasks, so workers' IDs trace back to it. The Constraints line is there because each heartbeat
wakes you, and a worker can send one before it has read the orca-worker guide.
