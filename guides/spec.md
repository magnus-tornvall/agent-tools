# spec

Domain: Intent. Settles with the owner what only the owner holds about a change, before it is
built, and writes it down as a short spec the owner reads first-hand, so that whoever builds the
change can act where it is silent without asking again, and whoever judges it has something the
builder did not write. A change is to anything: code, a process, pricing or an organisation. It is
started by the owner, or by an agent that finds open what only the owner can settle, such as a
coordinator. It takes intent in any form and returns the spec, a split into parts that are each
specced on their own, or the owner's decision not to commit, to do nothing or to defer, with its
reasons. Planning is downstream of it and is never in it. It reads no config.

## Principles

Each holds for an agent ten times as capable, because capability does not supply what the owner
holds, the right to decide for them, or independence from one's own work.

- **What only the owner holds comes from the owner.** Why the change matters, its appetite (what it
  is worth in money, time and attention), the risk they accept, which side wins when the people the
  change touches want different things, and what it must exclude are the owner's. The agent
  proposes; it never fills them in. Silence accepts an assumption; it never settles one of these.
- **Whoever pays decides** (reversibility, `mt get door-rule`). A one-way door is the owner's,
  however predictable their answer, since a correct guess is not consent. A two-way door is the
  agent's, recorded as an assumption.
- **The spec precedes the build, and the builder never edits it** (test oracle, separation of
  duties). It is the source of the expected result that the work did not write, so the judges have
  something to judge against.
- **Success and stop are fixed in advance** (falsifiability, precommitment). What would show the
  change paid, what would show it did not, and what makes the owner stop, each with when they would
  know, are settled before results arrive, so that neither the owner nor the agent moves them.
- **Attention as the bottleneck.** The owner's attention goes to the four above and nowhere else.
  A question the record could answer, or one whose answer could not change the spec, is not asked.

## Objectives

- **The spec is written for the owner to read first-hand**: short, bottom line first, each claim
  with its source, each in-scope item one line. Its depth follows what the change costs and how
  hard it is to undo.
- **Every in-scope item is an observable end state**: something a judge can see true or false
  whichever way the change is built. One no user can observe says so and is judged by reading.
- **Every decision is a choice**: what it chose, what it rejected, what it costs and who pays.
- **Decisions are append-only.** Each has a stable ID, and the owner ratified it. A decision that
  arises while planning or building, a contradiction with the spec, or anything that would add to
  what is in scope, goes to the owner and is appended once ratified; the spec is never rewritten
  under a Task already working from it.
- **Done is a spec the owner has read and accepted**, a split into parts, or the owner's decision
  not to commit, to do nothing or to defer, reported with its reasons.

## Contract

- **Sections.** The spec has these sections, as `##` headings in this order, so that each judge
  can be given only its own: `Outcome`, `Why`, `Success and stop`, `In scope`, `Out of scope`,
  `Constraints`, `Decisions`, `Assumptions`. `Constraints` holds the appetite, the destination of
  the work (a branch, or a pull request and whether to push) and any other bound. An empty section
  says none. Fixed: changing it is the owner's call.
- **Where it lives.** Outside the repo's tree, where the owner reads it, such as an issue, a doc or
  a file outside the repo, and versioned there. A file in the repo sits in every worktree, where a
  judge would find all of it. Each Task names the version it was given, and a Task is given the
  sections its assignment needs as text, never a path. Fixed: changing it is the owner's call.
- **The door rule** (`mt get door-rule`) says what is the owner's and who pays to undo it.
- **The ask guide** (`mt get ask`) composes every question, and **the brief guide**
  (`mt get brief`) lays out every message to the owner.
