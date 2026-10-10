# mvc

Settle the shape of a minimal viable change with the owner: what ships, what does not and why,
and what each decision ruled out. The shape is what to-orca, or any other consumer, starts from.
Re-invoked on a settled shape, mvc asks nothing and goes straight to the report, or the file.

## Objectives

- **The owner is asked only what nothing else can answer.** The repo, the conversation and primary
  sources answer first. Everything else reaches the owner as a fact with its citation, or as an
  assumption the owner corrects by its ID. A decision already on record - a shape settled in this
  conversation, a record or shape file the owner points to, the repo's decision docs - is a fact,
  never asked again.
- **The repo is explored before anything is asked.** The open questions drive the search, not a
  file list: precedent for what is being added first, since it settles a branch rather than a
  leaf, then the touched code and its callers, conventions and decision docs, history, the
  dependency manifest, the test setup. Every finding carries `file:line`, or is unknown: looked
  for and not found, which is itself a finding. A question that is both splits: the constraint
  the repo imposes is a fact, the requirement it cannot know is unknown. A subagent can do the
  looking, so its reading stays out of the conversation.
- **An external fact is checked at its primary source**: vendor docs, a package's own stated
  requirements, spec text, the publisher of the guidance. Only for a fact a question turns on, or
  for established guidance on a fork; never to compare approaches. At most two searches per fact;
  no primary source means unknown.
- **Every one-way door is decided by the owner**, never assumed, however predictable the answer.
  Intent only the owner holds - priorities, constraints from outside the repo, direction the code
  cannot show - is asked too. Every other open decision is an assumption that follows from what is
  settled; one mvc could not predict is marked uncertain, and one about an observable outcome is
  written as given, when, then.
- **Every question earns its place.** Asked greedily by information gain: the answer that prunes
  the most goes first, and a Risk or One-way door line can win a place pruning alone would not. A
  question that rules nothing out is never asked. Each round is one batch of up to four
  orthogonal questions, asked together: no answer could change whether another in the batch is
  worth asking, and in doubt it waits. In a round that mixes forms, the stances go in the text
  before the question-tool call, and the round is answered once the picker's answers and the
  owner's next message are both in. With no one-way door and no open intent, nothing is asked.
- **Three rounds at most.** The owner may lower the budget, never raise it, and unspent rounds are
  not owed. A round is spent when asked, however many answers come back. Corrections the owner
  volunteers, and clarifying a question, cost nothing.
- **The owner sees the record without hunting for it.** With the first questions, a map keyed by
  ID, one line each: what is asked, pointing to its question; the assumptions, uncertain first;
  what is ruled out; how many facts. After that a reply opens with its questions, then only what
  changed. Each question the batch could not hold is listed in one line until the owner promotes
  or closes it. Sources are shown when the owner asks for them.
- **A skipped question is not an accepted one.** Ask once why: unclear is clarified and asked
  again within the round, premature stays open, don't-care lets the stance stand. A question is
  withdrawn, with its cause, or stands; it is never quietly replaced.
- **Risks ride on decisions,** never scored. A risk that bears on a question is that question's
  Risk line, and the answer settles it. One that bears on none is an assumption, landing as a
  constraint or an accepted risk. One that would need avoiding is its own question.
- **What ships passes the deletion test**: remove it and the outcome no longer holds. Merely
  slower, uglier or less pleasant without it makes it a non-goal. Everything excluded is a typed
  non-goal: a boundary, never this change, with the line between them; or a deferral, not now,
  with why. What nobody would have asked for is left out.
- **Every decision names what it rejected.** A decision that rules nothing out is a description.
- **IDs are stable.** Questions, assumptions, requirements, non-goals and decisions keep their
  numbers, and a retired number is never reused.
- **The shape closes within the budget, or a decomposition is reported instead.** At close, each
  open question either gets the owner's answer or becomes a deferral with its reason. A question
  with a Risk line is never deferred; one with a One-way door line only on the owner's word, and
  what it blocks becomes a constraint. Anything left means the change is too big to define in the
  budget: name its parts and whether they are independent or a strict sequence, so each can be
  shaped on its own.
- **A grill parks on the owner's word, and only then.** The draft is the shape so far, with a
  top-level `draft` block: the `commit` of the repo it was written in, the `budget`, the
  `rounds_spent`, and each `open` question as it was asked with its stance. Answers, assumptions,
  facts and exclusions are already decisions, their provenance and non-goals. It passes
  `mt shape check --draft` before it is written, and each park writes it whole, replacing the last.
  It goes where the owner's instructions put parked work; with none, to `mvc-<slug>.yaml` in the
  default location, the slug short, made of letters, digits, `.`, `_` and `-`, the same for every
  park of the grill and taken by no other file there. Read back from there, it still passes
  `mt shape check --draft`, and the reply names where it went.
- **The default location** is `${XDG_STATE_HOME:-$HOME/.local/state}/mt/mvc/<repo>/`, where
  `<repo>` is the name of the directory `git rev-parse --path-format=absolute --git-common-dir`
  prints, or of its parent when it is named `.git`, so every worktree of the clone finds the same
  drafts and a draft outlives the worktree it was parked from.
- **A parked grill resumes from its draft.** Invoked with a reference, the draft is read from
  there. Asked to resume with none, the owner picks from the drafts at the default location, each
  shown by slug, its file's modified time and its count of open questions; a file that passes
  `mt shape check` is a closed shape, not a draft, and is left out. Before reporting, the draft
  passes `mt shape check --draft`, each cited file is checked against the draft's commit with
  `git diff <commit> -- <file>`, and each cited source outside the repo is read again. When the
  draft records no commit, or its commit is not in the repo, every cited file counts as changed
  and is read again. Then report the record, the open questions and the rounds left, and ask
  nothing until the owner says go. Each fact whose source changed is named with what changed and
  whether it still holds; a change that bears on a settled decision goes to the owner with both
  sources, as a contradiction does. The budget carries over: parking earns no rounds.
- **A parked grill closes with its shape.** The shape is the draft without its `draft` block, and
  once it passes `mt shape check` it lands where the draft was, replacing it, and read back from
  there it still passes. A parked grill that ends in a decomposition, or that the owner drops, has
  no shape to close with: its draft stays open, and the reply says so.

## Guardrails

- **No citation, no claim.** A fact cites `file:line`, the owner's answer or a primary source.
  General framework knowledge is not a source, and a citation proving something adjacent is worse
  than none. An assumption cites the settled material it follows from, never another assumption.
  A guess never looks like a decision the owner made.
- **The owner decides.** mvc proposes; it never settles the shape, admits an item or avoids a risk
  on the owner's behalf. Silence accepts an assumption; it never settles a one-way door or avoids
  a risk.
- **Settled is closed.** Reopening needs new information; asked to reopen, ask what changed.
  Contradicting answers, or an answer that contradicts the repo, are named with their sources and
  the owner picks; the later one never wins quietly. A better option is argued once, then it is
  the owner's call.
- **Scope enters after round 1 only as a change request**: what it is, where it came from, why the
  outcome is unreachable without it, what it rules out, and whether it competes with a pattern in
  the repo, adds a dependency or challenges the architecture. Argued once; the owner decides; a
  rejected request is closed. Never admitted on mvc's own reasoning, never withheld because the
  idea was not the owner's.
- **No git, no code, no plan, no Tasks.** No git means no git writes; the resume step's git reads
  are allowed. One file, only on request, only once the shape closes
  and passes `mt shape check`; asked earlier, name the open questions and write nothing. The
  draft parked on the owner's word, and the shape that replaces it at close, are the one
  exception. Never replace any other existing file without the owner's word; given a prior shape,
  the owner chooses replace, merge or a new file.

## Tools

- **The door rule** (`mt get door-rule`) says what is settled, a two-way door or a one-way door,
  and who pays to undo it.
- **The ask guide** (`mt get ask`) composes every question: its form, its channel and what each
  carries.
- **The example shape** (`mt get mvc --ref example`) is a filled-in shape.
- **`mt shape check <file>`** runs on the shape before it is reported or written, and
  **`mt shape check --draft <file>`** on a draft before it is parked and when it is resumed. A file
  of `-` is read from stdin, so a document held outside a file needs no temp file; mt reads only a
  whole YAML document, so one held inside other text is taken out of it first. Each line on stderr
  is `path: message`. A fix changes form, never content: a violation only new content would fix
  goes to the owner. Without `mt shape`, the shape is reported marked unchecked and no file is
  written.

## Report

Before reporting, one look at the closed set: has any shipping item become redundant given the
rest? Then the shape, as one YAML document that passes `mt shape check`, with no comments or
placeholders, so a consumer copies it rather than translates it. Or, when the shape cannot close,
the decomposition, and no shape.

- `outcome` is the one scalar, with no weasel words. Every other field is a collection, and an
  empty one is a statement; `requirements` holds at least one.
- `outcome`, `requirements` and `non_goals` are what the change does; `approach`, `constraints`
  and `touchpoints` are how. A file, symbol, technology or value is how, never a requirement.
- A requirement is given, when, then, or a `text` with the `reason` it cannot be observed. A
  settled example lands here as asked.
- `touchpoints` are the expected blast radius, each a path from the repo root or `path:symbol`.
- A risk has no field: mitigated, it is a constraint; avoided, a non-goal; accepted, a decision
  that says what accepting it costs.
- Each decision has its `rejected` alternatives and its `provenance`, the evidence only, never a
  bare question or assumption ID. A one-way door records `who_pays`. `decided_by` is `owner`, with
  the `question` as it was asked, or `silence` for an assumption nobody corrected; a one-way door
  is always the owner's. An Either answer is a decision naming the input it covers.
- Earlier decision records go in `constraints`, not `decisions`.

A shape written to a file is the checked report verbatim. A parked grill's shape goes where its
draft was. Otherwise, with no location given, it goes to `mvc-<slug>.yaml` in `.scratch` at the
repo root, else in the system temp directory.
