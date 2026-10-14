# mvc follow-up (change 2b)

Input, not a part. Settled with the owner on 2026-10-14, after change 2 (7177702, 04b9c34). To
run as its own change after change 3 closes and before change 4, since change 3's consumers read
mvc and change 4 renames and rewrites the stub.

## Owner's goal

The mvc skill is a forcing function for the owner to stop and think before committing to an
idea of any kind, not only a code change: get agents to find what the owner needs to know, stay
on topic, spend attention on what matters, align with the agent, and record what the owner
decided. The owner's named flaw: getting excited about a change without a clear why or end
state, especially the business side, the costs it drives and the value it captures.

## Approved changes (owner agreed to all seven)

1. **Purpose is what the grill cannot close without.** It stays in the owner's own words, but the
   grill does not close while purpose is absent or is the outcome restated. A purpose names who
   gains, what they would do differently, and how that would show. Purpose becomes required in
   the schema (owner's call on a fixed-rule home; approved). Owner's reading of purpose, to carry
   into the guide: it is the test every requirement and decision is judged against during the
   grill (deletion test against purpose, not only outcome), the tie-breaker for the builder where
   the shape is silent, and the record of why the owner committed, re-read when the change costs
   more than expected. Required alone yields filler; the guide's objective is the real change.
2. **Doing nothing is the first rejected alternative.** Every shape carries a decision to proceed,
   with "do nothing" and "defer" as rejected alternatives and the reason. Its provenance is the
   cost and value evidence. No schema change: decision, rejected, provenance, door already carry
   it. Principles: opportunity cost, cost of delay.
3. **The cost side is on record.** What the change drives in money, attention, running cost and
   maintenance, and who bears each. A cost nobody estimated is an assumption with an ID. A budget
   the owner holds is a constraint.
4. **Value is falsifiable.** A value claim names what would show it false and when the owner would
   know. A value nobody could observe is a hope, recorded as an assumption, never as the purpose.
   Falsifiability is already a charter principle (Verification).
5. **The idea meets its strongest opponent before close.** The grill argues the failure case once
   with its best evidence; the owner answers it or accepts it as a recorded risk. Principles:
   pre-mortem, separation of duties. No list of perspectives in the guide; which to take
   (customer, payer, operator, skeptic) is the agent's judgment. The objective: no decision
   closes having heard only its advocate.
6. **Strip the code wording.** "A source one can open at the line" for `file:line`; "the record"
   (repo, documents, numbers, prior decisions) for "the repo"; "produces nothing but the shape"
   for "writes no code". One sentence saying a change is to anything: code, process, pricing, an
   organisation. Name stays mvc. First paragraph becomes: settle whether an idea is worth
   committing to, and what the commitment is.
7. **Charter.** The Decision row gains opportunity cost and pre-mortem; Intent row unchanged. The
   stub description becomes a trigger ("before committing to an idea of any kind, before you are
   sure why"); that part folds into change 4.

## Owner ruling on requirements' given/when/then

The split serves the verifier (a judge or test writer checks one state, trigger and result
without reading the code; one failure never fails two), not the owner at decision time. The owner
finds it hard to read. Ruling: keep the form in the shape, hide it in the brief. The brief guide
shows a requirement as one sentence of what is true at the end; the given/when/then split is what
the whole shape carries on request. Revisit making requirements prose end states, the verifier
deriving the split, when a Run shows a verifier doing that reliably.

## Untouched

The search objectives (no question reaches the owner that a source could answer), value of
information, scope as a change request, parking and resume.
