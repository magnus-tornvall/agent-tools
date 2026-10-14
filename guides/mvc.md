# mvc

Domain: Intent. Settle with the owner the shape of a minimal viable change: what ships, what does
not and why, and what each decision ruled out. The shape carries the owner's intent to whoever
builds the change, so that they can act on it where it is silent without asking again. A grill is
started by the owner, or by an agent that finds decisions open that only the owner can settle. It
takes intent in any form and returns the closed shape, or a decomposition when the change is too
big to settle as one.

## Principles

- **Commander's intent.** A shape states the end state and, when the owner gives it, the purpose
  behind it, never the steps to get there. Whoever builds the change chooses the route; the intent
  tells them which way to lean where the shape is silent.
- **Observable end state.** The outcome is an end state the owner would call done, observable
  whichever way the change is built, with no weasel words. Each requirement is one such end state,
  seen from an input; one that no caller can observe says why, and is judged by reading instead.
- **The MVP deletion test.** What ships is what the outcome needs: remove it and the outcome no
  longer holds. Merely slower, uglier or less pleasant without it makes it a non-goal. Every item
  that ships still passes the test given everything else that ships.
- **Non-goals.** What is excluded is said, so that its absence can be checked: a boundary, never
  this change, saying what still holds; or a deferral, not now, with why.
- **Value of information**, from the Decision domain. The owner's attention is the cost. A
  question is worth asking only when its answer could change the shape by more than the attention
  it takes, and a search only while the fact it seeks is still open and could still change it.
- **Reversibility**, from the Decision domain. Which decisions go to the owner, and which mvc
  settles and records, follows the door rule.
- **Source criticism**, from the Evidence domain. A claim is only as good as its source, and a
  source proving something adjacent is worse than none.

## Objectives

- **The owner is asked only what nothing else can answer.** The repo, the conversation and primary
  sources answer first. What they settle reaches the owner as a fact with its source, or as an
  assumption the owner corrects by its ID. A decision already on record is a fact, never asked
  again, so a shape already settled is reported without a question.
- **The repo and the primary sources are known before anything is asked**, as far as the open
  questions turn on them; the questions drive the search. Every fact cites `file:line`, the owner's
  word or a primary source, and general knowledge is none of these. A fact looked for and not found
  is unknown, which is itself a finding. An assumption cites the settled material it follows from.
- **Every one-way door, and all intent only the owner holds, is the owner's to decide**: why the
  change matters, priorities, constraints from outside the repo, direction the code cannot show.
  However predictable the answer, it is asked. Silence accepts an assumption; it never settles a
  one-way door or that intent. Every other open decision is an assumption that follows from what is
  settled, marked uncertain when mvc could not predict it.
- **The purpose is the owner's own words.** The shape carries `purpose` only as the owner stated
  it, never written for them and never turned into a requirement.
- **Every question earns its place.** One that rules nothing out is never asked; one skipped is not
  accepted, and stands until its cause is known. A risk rides on the decision it bears on, never
  scored; one that would need avoiding is its own question.
- **Every decision is a choice.** It names the real alternatives it rejected; one that rules nothing
  out is a description. Its provenance is the evidence, so a decision resting on an assumption
  nobody confirmed shows it. IDs are stable and a retired one is never reused, so the owner can
  correct by ID.
- **Settled is closed.** Reopening needs new information. Answers that contradict each other or
  the repo go to the owner with both sources; the later never wins quietly. A better option is
  argued once. Once questions are out, scope enters only as a change request: what it is, where it
  came from, why the outcome is unreachable without it, and what it rules out. It is argued once and
  the owner decides; mvc never admits it on its own reasoning.
- **A grill parks on the owner's word, and resumes from what was parked.** Where mvc parks a draft,
  how a draft looks and how a parked draft is told from a closed shape are the agent's judgment or
  the owner's instruction. Workaround for no tool keeping a grill's drafts; remove when `mt` or Orca
  parks and lists them.
- **A resumed grill stands on current facts.** Each fact it cites holds against the repo and the
  sources as they are now, or is named with what changed. A change that bears on a settled
  decision goes to the owner as a contradiction does, before anything new is asked.
- **The shape closes passing `mt shape check`, or a decomposition is reported.** At close each
  open question has the owner's answer or is a deferral with its reason. A question carrying a risk
  is never deferred, and a one-way door only on the owner's word, what it blocks becoming a
  constraint. A change too big to settle with the attention the owner can give is reported as its
  parts instead, independent or a strict sequence, each to be shaped on its own.
- **At close the owner sees the shape in brief**, as the brief guide lays it out, including which
  decisions rest on assumptions nobody confirmed. The whole shape is the owner's on request.
- **mvc writes no code, no plan, no Tasks and no file but the shape**: the closed shape on request,
  once it passes `mt shape check`, and the draft parked on the owner's word. It replaces no other
  existing file without the owner's word.

## Contract

- **The shape** is what mvc hands on, to whoever takes it: one YAML document that passes
  `mt shape check`, with no comments or placeholders, so that it is copied rather than translated.
  Its keys are `outcome`, `purpose`, `requirements`, `non_goals`, `constraints` and `decisions`;
  the schema behind `mt shape check` owns their format, and the example
  (`mt get mvc --ref example`) shows them filled in. What follows is the intent no check can see.
- `outcome`, `requirements` and `non_goals` are what the change does; `constraints` and `decisions`
  are how. A file, symbol, technology or value is how, never a requirement. A mechanism the change
  must use is a decision, with what it rejected. Earlier decision records are constraints.
- Each requirement's `given` sets up its own state, never another requirement passing, so one
  failure never fails two; requirements whose givens are alternatives never overlap.
- An empty `non_goals`, `constraints` or `decisions` is a statement: none. A risk has no key of its
  own: mitigated, it is a constraint; avoided, a non-goal; accepted, a decision that says what
  accepting it costs.
- A scalar containing ` #` is quoted, since YAML otherwise reads the rest as a comment and
  truncates it. Workaround for `mt shape check` not noticing a truncated scalar; remove when it
  does.
- **`mt shape check <file>`** runs on the shape before it is reported or written. A file of `-` is
  read from stdin; mt reads only a whole YAML document. Each line on stderr is `path: message`. A
  fix changes form, never content: a violation only new content would fix goes to the owner.
  Without `mt shape`, the shape is reported marked unchecked and no file is written.
- **The door rule** (`mt get door-rule`) says what is settled, a two-way door or a one-way door,
  and who pays to undo it.
- **The ask guide** (`mt get ask`) composes every question: its form, its channel and what each
  carries.
- **The brief guide** (`mt get brief`) lays out every message to the owner: what it shows first,
  what it leaves until asked, and how the owner asks for it.

## Config

mvc reads no config.
