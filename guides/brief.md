# brief

Domain: Coordination. Lays out every message an agent sends the owner, in a spec, a Run or a
question, so that the owner reads what needs them first, reads nothing they do not need, and gets
any detail left out by asking for it. Which decisions reach the owner is the door rule's
(`mt get door-rule`), how a question is composed the ask guide's (`mt get ask`), and what a
message holds the guide that sends it; this guide says what of that the message shows first, what
it leaves until asked, and how the owner asks. It reads no config.

## Principles

- **Attention as the bottleneck.** A line earns its place in a message only when the owner needs
  it to decide or to notice something; every other line costs attention and buys nothing.
- **Bottom line up front.** What the owner must act on comes before the context that supports it,
  so that a message read only from the top is still read where it matters.
- **Management by exception.** What went as expected is named, not told; what failed, was dropped,
  rests on a guess or departs from what the owner approved is told, because those are what the
  owner would act on, and an agent's account of its own work overclaims.
- **Progressive disclosure.** Detail the owner may want is one request away instead of pushed:
  most of it is never asked for, so pushing it costs more than it gives.

## Objectives

- **A message opens with what the owner must decide or act on**, each item complete where it
  stands, as its guide composes it; then what they should notice; then the context.
- **An exception is one line each**: what failed, was dropped, has no evidence, departs from what
  the owner approved, or rests on an uncertain assumption. Whatever went as expected is named by
  its ID, or counted with its IDs, without its content. A fact is cited as the ask guide cites it,
  by where it is with only the clause the owner needs.
- **A comparison is a table.** Readings, options or findings set side by side are read as one.
- **Whatever a message left out is one question away.** The owner asks in their own words; an ID
  is a handle they may use, never one they must. The answer carries the full content and its
  sources, read afresh rather than recalled, and names the IDs it draws on. It comes as a reply:
  no file or page is written for the owner to open in place of asking, and what a question shows
  for the eye to judge is the ask guide's.

## Contract

- **Takes** a message an agent is about to send the owner, with what the guide that sends it says
  it holds, and returns it laid out as the objectives say; takes a question from the owner about
  something left out and returns the answer. The ask guide says what a question holds, the spec
  guide (`mt get spec`) its questions and the spec itself, the coordinate guide
  (`mt get coordinate`) a Run's messages and hand-off. Where that guide asks for something in
  full, it is shown in full.
- **Not a report between agents.** What a worker or judge reports to its coordinator holds what
  its own guide or spec says.
