# ask

Domain: Decision. Composes a question for whoever owns a decision, so that the answer settles it
at the least cost to the person asked. The door rule (`mt get door-rule`) says what is asked at
all; this guide says how, and what an answer means. It rests on value of information: a question
costs the asked person's attention, so it asks for the fact the decision turns on, the one whose
answer could change what is done. And on falsifiability: a position says what would refute it. It
takes a decision and its live readings and returns the question to put, in a form and channel,
with a position; the answer comes back to the asker, and Answers says what it means. A question
to the owner sits in its message as the brief guide (`mt get brief`) lays it out. It reads no
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
- **visual** - only the eye can tell the readings apart. The question gives the exhibit the owner
  sees, what to judge in it and the answers. What carries the exhibit is the platform's, named in
  its reference; when no view can reach the owner, a screenshot, described and named by its path,
  stands in for it.

Every form takes a position. A stance states it; gwt, options and visual rank the answers with the
expected pick first. A question without one hands the work back to the person asked.

## Channel

The channel follows the form. Options, gwt and visual go through the asker's own question tool
(`AskUserQuestion` in Claude Code; on a platform, the verb its reference names): each answer one
option, the position's pick first. In gwt, the tool's free answer is **Neither**, or **Either**. A
stance goes in plain text, never a picker, so "you are asking the wrong thing" is as easy to type
as an answer.

When a message holds more than the tool's questions, such as a line the tool has no field for or
a grill's map, each question the tool carries is written out complete in the text, with its lines,
in the order the questions are asked and before anything else the message holds; the tool only
repeats the question and its options. Workaround for question tools showing after the message's
text and lacking a field for a line, such as a position or an option's description; remove when
the asker's question tool shows first and carries every line.

## Every question

- **One decision.** A position that needs "and", or a Rules out that covers half of it, is two
  questions.
- **The question comes first**, after its ID, with no label or marker before it.
- **Complete in one block.** The question, its position, and its Wrong if, Rules out and any Risk
  or One-way door lines stand together, with nothing from another question between them.
- **Neutral.** It reads as answerable either way without the position. Context in it is fact; the
  argument lives only in the position. It presupposes only what is settled, and when it rests on
  an assumption it restates the few words it needs, with the assumption's ID.
- **Concrete.** Anchored in something the person asked can check: a route, a caller, an input, a
  number. "How important is latency?" invites "very"; "What is the largest tenant this search
  serves?" invites the fact the decision turns on.
- **Answerable without opening anything else.** It carries what it needs of everything it rests
  on: a fact from the repo cited by where it is, with only the clause of it the question needs,
  and a commit, file path, ID or file on disk with what of it the question needs, never in its
  place. What only the eye can judge reaches the person asked as the visual form says.
- **Cited.** Every claim in it carries its source: where it is in the repo, an earlier answer, or a
  primary source. General knowledge is not a source.
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
