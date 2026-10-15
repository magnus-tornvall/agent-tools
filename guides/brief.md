# brief

Domain: Coordination. Lays out every message an agent sends the owner, in a grill, a Run or a
question, so that the owner reads what needs them first, reads nothing they do not need, and gets
any detail left out by asking for it. Which decisions reach the owner is the door rule's
(`mt get door-rule`), how a question is composed the ask guide's (`mt get ask`), and what a
message holds the guide that sends it; this guide says what of that the message shows first, what
it leaves until asked, and how the owner asks. It reads no config.

## Principles

- **Attention as the bottleneck.** The owner's attention is the scarcest thing an agent spends. A
  line earns its place in a message only when the owner needs it to decide something or to notice
  something; every other line costs attention and buys nothing.
- **Bottom line up front.** The reader sees first what they must act on, before the context that
  supports it, so a message read only from the top is still read where it matters.
- **Management by exception.** What went as expected is named, not told; what failed, was dropped,
  rests on a guess or departs from what the owner approved is told, because those are what the
  owner would act on. An agent's account of its own work overclaims, so its exceptions are what is
  worth the owner's reading.
- **Progressive disclosure.** Detail the owner may want is one request away instead of pushed.
  Detail offered on request is mostly never asked for, which is why pushing it costs more than it
  gives.

## Objectives

- **What needs the owner comes first.** A message opens with what the owner must decide or act on:
  its questions, the rulings it asks for, the approval it seeks, each complete where it stands, as
  its guide composes it. What the owner should notice follows, and the context after that.
- **A message holds only what the owner needs to decide or notice.** An exception is one line
  each: what failed, was dropped, has no evidence, departs from what the owner approved, or rests
  on an uncertain assumption. Whatever went as expected, such as a settled fact, a Task's account,
  a commit or a question already answered, is named by its ID, or counted with its IDs, without
  its content.
- **A fact is cited with only the clause the owner needs**: by where it is, with the clause of it
  the decision turns on, never its whole content, whatever its source. The rest of it is one
  request away.
- **A requirement is shown to the owner as one sentence of what is true at the end.** The given,
  when and then split is what the whole shape carries, shown on request.
- **Whatever a message left out is one question away.** The owner asks in their own words; an ID
  is a handle they may use, never one they must. The next message answers it with the full content
  and its sources, read afresh from those sources rather than recalled, and names the IDs of the
  items it draws on, so the owner can ask after any of them again.
- **Detail reaches the owner in a reply.** No file or page is written for the owner to open in
  place of asking; what a question shows for the eye to judge is the ask guide's (`mt get ask`).

## Contract

- **Takes** a message an agent is about to send the owner, with what the guide that sends it says
  it holds; **returns** that message, laid out as the objectives say. Takes a question from the
  owner about something a message left out; returns the answer.
- **The guide that sends a message** says what it holds: the ask guide for a question, the mvc
  guide (`mt get mvc`) for a grill's questions and its close, the coordinate guide
  (`mt get coordinate`) for a Run's plan, messages and hand-off. Where that guide asks for something
  in full, it is shown in full.
- **Not a report between agents.** What a worker or judge reports to its coordinator holds what
  its own guide says, and a report whose guide lists what it holds, such as research's, holds that
  list.
