# ask

Domain: Decision. Composes a question for whoever owns a decision, so that the answer settles it
at the least cost to the person asked. The door rule (`mt get door-rule`) says what is asked at
all; this guide says how, and what an answer means. It rests on value of information: a question
costs the asked person's attention, so it asks for the fact the decision turns on, the one whose
answer could change what is done. And on falsifiability: a position says what would refute it. It
takes a decision and its live readings and returns the question to put, in a form and channel,
with a position; the answer comes back to the asker, and Answers says what it means. It reads no
config.

## Forms

Pick the form from how the live readings of the decision differ.

- **gwt** (`mt get ask --ref gwt`) - the readings give different observable outcomes for the same
  input. A key example in given, when, then: judging one is cheaper than arguing a proposition,
  and the answer is already an acceptance test.
- **stance** (`mt get ask --ref stance`) - the readings differ only in mechanism, structure or
  cost, nothing an input can show.
- **options** (`mt get ask --ref options`) - the answer set is genuinely closed: every answer the
  owner could give is on the list.

Every form takes a position. A stance states it; gwt and options rank the answers with the
expected pick first. A question without one hands the work back to the person asked.

## Channel

The channel follows the form. Options and gwt go through the asker's own question tool
(`AskUserQuestion` in Claude Code, `orca orchestration ask --options`): each answer one option, the
position's pick first. In gwt, the tool's free answer is **Neither**, or **Either**. A stance goes
in plain text, never a picker, so "you are asking the wrong thing" is as easy to type as an
answer.

Lines the tool has no field for go in the text just before it. Workaround for question tools
lacking a field for a line, such as a position or an option's description; remove when the asker's
question tool carries one.

`orca orchestration ask --options` takes the options as one comma-separated string, so a label
holding a comma splits in two; there each label has none. Workaround for Orca splitting the options
on commas; remove when it takes each option as its own argument.

## Every question

- **One decision.** A position that needs "and", or a Rules out that covers half of it, is two
  questions.
- **The question comes first**, after its ID, with no label or marker before it.
- **Neutral.** It reads as answerable either way without the position. Context in it is fact; the
  argument lives only in the position. It presupposes only what is settled, and when it rests on
  an assumption it restates the few words it needs, with the assumption's ID.
- **Concrete.** Anchored in something the person asked can check: a route, a caller, an input, a
  number. "How important is latency?" invites "very"; "What is the largest tenant this search
  serves?" invites the fact the decision turns on.
- **Answerable without opening anything else.** It carries the content of everything it rests
  on: a commit, file path, ID or file on disk comes with what it names, never in its place.
- **Cited.** Every claim in it carries its source: `file:line`, an earlier answer, or a primary
  source. General knowledge is not a source.
- **Wrong if** - what would refute the position. It refutes this decision; it never opens a second.
- **Rules out** - what agreeing costs.
- **Risk** - only when the question bears on one: the risk and its source, under Rules out.
- **One-way door** - only on a one-way door: who pays to undo it, with its source, under Rules out
  and below Risk.
- **Short.** Each body holds only what the person asked needs to answer.

## Answers

An answer outside what the question offered is still the answer. A question back is not a vague
answer. Asked why the position holds, give the evidence, what it assumes and what would make it
wrong; never restate it louder. Asked what the question means, answer plainly and drop the
position until it lands. A question asked again is asked verbatim: a reworded question is a
different question, with a new ID.
