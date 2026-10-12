# mvc

Domain: Intent. Settle the shape of a minimal viable change with the owner: what ships, what does
not and why, and what each decision ruled out. The shape carries the owner's intent to whoever
builds the change, so that they can act on it where the shape is silent, without asking again.
Re-invoked on a settled shape, mvc asks nothing and goes straight to the report, or the file.

## Principles

- **Commander's intent.** A shape states the end state and, when the owner gives it, the purpose
  behind it, never the steps to get there. Whoever builds the change chooses the route; the intent
  tells them which way to lean where the shape is silent.
- **Observable end state.** The outcome is an end state the owner would call done, observable
  whichever way the change is built, with no weasel words. Each requirement is one such end state,
  seen from an input; one that no caller can observe says why, and is judged by reading instead.
- **The MVP deletion test.** What ships is what the outcome needs: remove it and the outcome no
  longer holds. Merely slower, uglier or less pleasant without it makes it a non-goal.
- **Non-goals.** What is excluded is said, so that its absence can be checked: a boundary, never
  this change, with the line between them; or a deferral, not now, with why.
- **Value of information**, from the Decision domain. The owner's attention is the cost. A
  question is worth asking only when its answer could change the shape by more than the attention
  it takes, and a search only while the fact it seeks is still open and could still change it.
- **Reversibility**, from the Decision domain. Which decisions go to the owner, and which mvc
  settles and records, follows the door rule.

## Objectives

- **The owner is asked only what nothing else can answer.** The repo, the conversation and primary
  sources answer first. Everything else reaches the owner as a fact with its citation, or as an
  assumption the owner corrects by its ID. A decision already on record - a shape settled in this
  conversation, a record or shape file the owner points to, the repo's decision docs - is a fact,
  never asked again.
- **The repo is known before anything is asked**, as far as the open questions turn on it:
  precedent for what is being added, which settles a branch rather than a leaf, the touched code
  and its callers, conventions and decision docs, history, the dependency manifest, the test setup.
  The questions drive the search, not a file list. Every finding carries `file:line`, or is
  unknown: looked for and not found, which is itself a finding. A question that is both splits: the
  constraint the repo imposes is a fact, the requirement it cannot know is unknown.
- **An external fact rests on its primary source**: vendor docs, a package's own stated
  requirements, spec text, the publisher of the guidance. Only a fact a question turns on, or
  established guidance on a fork, is looked up; approaches are never compared this way. No primary
  source means unknown.
- **Every one-way door is decided by the owner**, never assumed, however predictable the answer.
  Intent only the owner holds - why the change matters, priorities, constraints from outside the
  repo, direction the code cannot show - is asked too. Every other open decision is an assumption
  that follows from what is settled; one mvc could not predict is marked uncertain, and one about
  an observable outcome is written as given, when, then. With no one-way door and no open intent,
  nothing is asked.
- **The purpose is the owner's own.** When the owner states why the change matters, the shape
  carries it as `purpose`, in their terms. mvc never writes one the owner did not state, and never
  turns it into a requirement: it is the why behind the outcome, not an end state.
- **Every question earns its place.** The question whose answer prunes the most goes first, and a
  Risk or One-way door line can win a place pruning alone would not. A question that rules nothing
  out is never asked. A round is the questions put to the owner together; they are orthogonal, so
  no answer could change whether another in the round is worth asking, and in doubt one waits. A
  round is answered once every question in it has its answer, whichever channel carried it.
- **The rounds fit a budget the owner can see.** The owner may set the round budget for a grill,
  larger or smaller than mvc would choose, and mvc asks up to it. With none stated, mvc chooses
  one that fits the change and states it with the first questions. A round is spent when asked,
  however many answers come back; unspent rounds are not owed. Corrections the owner volunteers,
  and clarifying a question, cost nothing.
- **The owner sees the record without hunting for it.** With the first questions, a map keyed by
  ID, one line each: what is asked, pointing to its question; the assumptions, uncertain first;
  what is ruled out; how many facts. After that a reply opens with its questions, then only what
  changed. Each question a round could not hold is listed in one line until the owner promotes or
  closes it. Sources are shown when the owner asks for them.
- **A skipped question is not an accepted one.** Its cause is known: unclear is clarified and
  asked again within the round, premature stays open, don't-care lets the stance stand. A question
  is withdrawn, with its cause, or stands; it is never quietly replaced.
- **Risks ride on decisions,** never scored. A risk that bears on a question is that question's
  Risk line, and the answer settles it. One that bears on none is an assumption, landing as a
  constraint or an accepted risk. One that would need avoiding is its own question.
- **Every decision is a choice.** It names the real alternatives it rejected; one that rules
  nothing out is a description. Its provenance is the evidence, never a bare question or
  assumption ID, and an assumption nobody corrected is decided by silence. An Either answer is a
  decision naming the input it covers.
- **IDs are stable.** Questions, assumptions, requirements, non-goals, constraints and decisions
  keep their numbers, and a retired number is never reused.
- **The shape closes within the budget, or a decomposition is reported instead.** At close, each
  open question either has the owner's answer or is a deferral with its reason. A question with a
  Risk line is never deferred; one with a One-way door line only on the owner's word, and what it
  blocks becomes a constraint. Anything left means the change is too big to define in the budget:
  its parts are named, and whether they are independent or a strict sequence, so each can be
  shaped on its own.
- **Nothing in the closed set is redundant.** Every shipping item still passes the deletion test
  given everything else that ships.
- **A grill parks on the owner's word, and only then.** The draft is the shape so far with its
  `draft` block, with its `commit`, `budget`, `rounds_spent` and `open` questions. Answers,
  assumptions, facts and exclusions are already decisions, their provenance and non-goals. Each
  park replaces the last whole, and what is written still passes `mt shape check --draft` when read
  back. It goes where the owner's instructions put parked work; with none, to `mvc-<slug>.yaml` at
  the default location, the slug safe as a file name, the same for every park of the grill and
  taken by no other file there. The reply names where it went.
- **The default location** is `${XDG_STATE_HOME:-$HOME/.local/state}/mt/mvc/<repo>/`, where
  `<repo>` is the name of the directory `git rev-parse --path-format=absolute --git-common-dir`
  prints, or of its parent when it is named `.git`, so every worktree of the clone finds the same
  drafts and a draft outlives the worktree it was parked from. mvc owns this location; `mt` keeps
  no drafts.
- **A parked grill resumes from its draft.** Invoked with a reference, the draft is the one there.
  Asked to resume with none, the owner is offered the drafts at the default location, each by
  slug, when it was last parked and how many questions it holds open; a closed shape there is not
  a draft and is not offered.
- **A resumed grill stands on current facts.** Every fact it cites holds against the repo and the
  sources as they are now, or is named with what changed and whether it still holds; with no
  recorded commit, or one the repo lacks, every cited file counts as changed. A change that bears
  on a settled decision goes to the owner with both sources, as a contradiction does. The owner
  sees the record, the open questions and the rounds left before anything new is asked, and
  nothing is asked until the owner says go. The budget carries over: parking earns no rounds.
- **A parked grill closes with its shape.** The shape is the draft without its `draft` block; it
  lands where the draft was, replacing it, and read back from there it passes `mt shape check`. A
  parked grill that ends in a decomposition, or that the owner drops, has no shape to close with:
  its draft stays open, and the reply says so.

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
- **Scope enters after the first round only as a change request**: what it is, where it came from,
  why the outcome is unreachable without it, what it rules out, and whether it competes with a
  pattern in the repo, adds a dependency or challenges the architecture. Argued once; the owner
  decides; a rejected request is closed. Never admitted on mvc's own reasoning, never withheld
  because the idea was not the owner's.
- **No git writes, no code, no plan, no Tasks.** One file, only on request, only once the shape
  closes and passes `mt shape check`; asked earlier, name the open questions and write nothing.
  The draft parked on the owner's word, and the shape that replaces it at close, are the one
  exception. Never replace any other existing file without the owner's word; given a prior shape,
  the owner chooses replace, merge or a new file.

## Contract

- **The shape** is what mvc hands on: one YAML document that passes `mt shape check`, with no
  comments or placeholders, so a consumer copies it rather than translates it. Its keys are
  `outcome`, `purpose`, `requirements`, `non_goals`, `constraints`, `touchpoints` and `decisions`;
  the schema behind `mt shape check` owns their format, and the example (`mt get mvc --ref
  example`) shows them filled in. Whatever the schema enforces is left to it; what follows is the
  intent no check can see.
- `outcome`, `requirements` and `non_goals` are what the change does; `constraints`,
  `touchpoints` and `decisions` are how. A file, symbol, technology or value is how, never a
  requirement. A mechanism the change must use is a decision, with what it rejected; one it need
  not use is left out. Earlier decision records are constraints, not decisions.
- Each requirement's `given` sets up its own state, never another requirement passing, so one
  failure never fails two; requirements whose givens are alternatives never overlap, so no input
  fires both. A settled example lands as a requirement as asked.
- A boundary non-goal says what still holds, so its absence can be checked: what is still refused,
  or still unchanged.
- `touchpoints` are the expected blast radius.
- An empty collection, whichever field, is a statement: none.
- A risk has no key of its own: mitigated, it is a constraint; avoided, a non-goal; accepted, a
  decision that says what accepting it costs.
- **to-orca**, or any other consumer, starts from the closed shape as reported or written. A
  shape written to a file is the checked report verbatim, and the reply names where it went.
- **The oracle tool** (`mt get oracle`) adds `oracles` and `unchecked` to the closed shape; mvc
  writes neither. Oracles observe the outcome, requirements, boundary non-goals and constraints,
  so those are written to be observed.
- **`mt shape check <file>`** runs on the shape before it is reported or written, and
  **`mt shape check --draft <file>`** on a draft before it is parked and when it is resumed. A file
  of `-` is read from stdin, so a document held outside a file needs no temp file; mt reads only a
  whole YAML document, so one held inside other text is taken out of it first. Each line on stderr
  is `path: message`. A fix changes form, never content: a violation only new content would fix
  goes to the owner. Without `mt shape`, the shape is reported marked unchecked and no file is
  written.
- **The door rule** (`mt get door-rule`) says what is settled, a two-way door or a one-way door,
  and who pays to undo it.
- **The ask guide** (`mt get ask`) composes every question: its form, its channel and what each
  carries.

## Config

mvc reads no config. A round budget is a limit for one grill, so it lives in that grill's draft.

## Report

The closed shape, as one YAML document, or, when the shape cannot close, the decomposition and no
shape.
