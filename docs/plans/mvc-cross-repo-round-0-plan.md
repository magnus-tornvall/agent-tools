# Reading neighbouring repositories in mvc's round 0

Status: proposed, not implemented. Research and planning only.

The premise under review: *"the pre-grill phase should be able to explore external
dependency codebases to answer questions relating to the change — an API change raises
questions about a web app that consumes the resource it touches."*

## Where the premise holds

**The skill already argues for this and only stops at the repo boundary.** Round 0 exists
because "a question whose answer is in the repo wastes a round". Nothing in that reasoning
turns on the answer being in *this* repo. A consumer's call site is code, it is readable,
and it settles the question with a citation rather than with recollection. The budget
argument is identical; only the search path differs.

**The motivating case is the one that prunes most.** "Does anything still read
`order.total_cents`?" answered *no* kills the whole backward-compatibility branch and every
question hanging off it — versioning, deprecation window, dual-write. That is the largest
prune a single answer can deliver, and it is precisely the class round 0 is supposed to
clear before the ceiling starts binding. Answered from memory in round 1 it costs a slot
and arrives without provenance.

**Round 0's contract already generalises.** The explorer returns, per candidate, either an
answer with a citation or **dark**. Nothing in that contract is repo-specific. A second
subagent pointed at another checkout, returning the same shape, needs no new machinery —
which is the strongest argument for treating this as a scope extension rather than a new
phase.

## Where it does not

**"External dependencies" names the wrong direction.** The example is a *dependent*, not a
dependency. The web app consumes the API; the API does not depend on the web app. These are
different problems with different economics:

- *Downstream (consumers, dependents)* — "who breaks", "is this field actually read". The
  answers are usage sites. Undiscoverable from any manifest, because an HTTP consumer
  declares nothing. This is the user's example and where the value is.
- *Upstream (libraries)* — "does this library support X", "what is the real signature".
  Usually already on disk under `node_modules`/`vendor`, or answerable from the vendor's own
  documentation, which round 0 already admits via the web clause.

Building for "external dependencies" as named would ship the half that is mostly already
covered and miss the half the example is about. The mechanic should be named for what it
reads — neighbouring repositories — not for a dependency direction it does not respect.

**Cross-repo absence is not absence.** In-repo, "searched and not found" is a finding: the
repo is the whole world for the change. Cross-repo it is not. Searching the web app and
finding no caller does not establish that nothing calls the endpoint — there are other
clients, mobile builds, third parties, a deployed revision older than the checkout. Carrying
a negative across the boundary as **determined** manufactures exactly the confident wrong
answer the skill's provenance rules exist to prevent, and it does it in the highest-stakes
place: the branch-killing question.

The polarity has to flip at the boundary. A positive usage finding is determined. A negative
is **dark**, and becomes a question — a much better question than the one that would have
been asked cold, because it arrives with "I read these repos at these revisions and found
none; is there another consumer?" attached.

**Provenance breaks in two places.** `file:line` presumes one implicit root; with two
checkouts the same path resolves twice. Citations need a repo qualifier, and the map needs
one line naming what was read and at what revision — otherwise **dark** is unauditable,
since the reader cannot tell whether a thing was searched for and missing or never in scope.

**The shape has nowhere obvious to put the finding, and the obvious place is wrong.**
`touchpoints` is "the files and symbols it lands on", and the change lands in one repo. A
consumer's call site is not a touchpoint; it is a limit the mechanism must respect —
`constraints`, with repo-qualified provenance. This matters because a cross-repo path in
`touchpoints` reads to whatever implements the change as a file it may edit. If the other
repo genuinely must change too, that is a widening and probably the split signal, not a
touchpoint.

**Discovery is the hard part, and the automatic approaches solve the wrong half.** Manifests
and lockfiles describe upstream. Nothing in an API repo names its HTTP consumers, save weak
and usually-absent signals — a CORS allowlist, a client-generation config, a monorepo
sibling. Any mechanic that leans on discovery works for the case that was already cheap and
fails for the case that motivated it.

**Reading a repo invites changing it.** Once the web app is in context, "and we should update
the client too" is one sentence away, and it arrives looking like a finding rather than like
scope. The skill has a widening mechanic for this, and the new path has to route through it
explicitly rather than by assumption.

**Fan-out is real.** Cross-repo search over an unfamiliar tree is where a context window
goes to die. The existing per-candidate discipline and the returns-citations-not-files
contract are what contain it, and they only contain it if the pass is bounded the way the
web clause is bounded.

## The null option, honestly

Do nothing, and the user answers "yes, the web app reads that field" in round 1. That costs
one slot of four and one act of recollection. The mechanic pays when the neighbouring repo
is on hand and the candidate prunes a branch; it does not pay for a leaf, and it does not
pay at all when no checkout is available. Worth stating plainly because it bounds how much
machinery this deserves: the answer is *not much*.

## Options

**A — Scope extension.** Round 0's search covers "the repositories in scope" rather than
"the repository". Repos are named by the user at invocation. One subagent per repo, the
existing contract verbatim. Citations gain a repo qualifier; one absence rule flips the
polarity at the boundary. Roughly ten to fifteen lines of `SKILL.md`, no new section.
Cheapest thing that works. Misses the case where the user did not think to name a repo —
which, given that they invoked the skill to be asked good questions, is most of the time.

**B — A third rung on the evidence ladder.** A, plus: round 0's passes are sequenced
explicitly — this repo, then neighbouring repos, then the web — each running only on what
the previous left dark, each narrower than the last. Plus the free targeted ask: a dark
candidate that is dark *because* it is bounded by this repo says so in the map, and the user
names a repo or does not. Plus one line in the map naming what was consulted and at what
revision. Roughly twenty-five to thirty-five lines, one new subsection under Round 0.

The ask is what makes B worth the extra lines. Correcting the map is already volunteered and
off-budget, so the channel exists and costs nothing; the skill is simply honest about which
darks are unknowable and which are merely out of scope. That distinction is the whole value —
it turns "I don't know" into "point me and I will".

**C — A pre-grill discovery phase.** The skill builds the dependency graph itself: manifests,
lockfiles, OpenAPI specs, org repo listings, attaching and cloning what it finds. Powerful,
and out of character in every direction — unbounded, permission-dependent, and it turns round
0 into a project with its own failure modes. It is also what "add a mechanic to explore
external dependencies" could be read as, which is why it is worth naming and rejecting rather
than leaving implicit. Recommend against.

## Recommendation

**B**, with the reads-nothing-it-was-not-given rule as the hard boundary.

The pieces, in the order they would land in `SKILL.md`:

**Candidate generation gets a third axis.** Round 0 currently requires candidates to span
"what the repo settles, and what only the user can decide". Add what a *neighbouring repo*
settles. This is the actual insertion point: without it nobody generates the cross-repo
candidate and the rest of the mechanic never fires.

**The pass is bounded by an admission test that mirrors one the skill already runs.** The
"open, not asked" list uses branch-or-leaf to decide what survives; the same test decides
what earns a cross-repo lookup. A candidate that would kill a branch gets a subagent; one
that closes a single leaf does not, and stays dark. Consistency with an existing test is
cheaper to hold in the head than a new threshold.

**The skill reads no repository it was not given.** Directly parallel to "does not create a
directory it was not given". The existing budgets cap what the skill spends *unasked* — the
two-search web cap binds because the skill chose to search. Here the user chooses the repos,
so the number of them needs no cap; what needs capping to zero is repos the skill goes and
finds on its own. One pass, one subagent per repo, driven by the dark candidates only. A
partial return is dark, and there is no second dispatch.

**Citations are repo-qualified, and the map names what was read.** `repo:path:line` for
findings; one line per consulted repo with its revision, so that a **dark** is auditable
against the scope that produced it.

**Positive findings are determined; negatives are dark.** Stated as its own rule, because it
is the one place the skill's existing "absence is a finding" instinct produces the wrong
answer, and because the negative is the branch-killing case where being wrong costs most.

**Cross-repo findings land in `constraints`, never `touchpoints`.** With the corollary
spelled out: reading a neighbouring repo does not add it to what ships. A change that must
also land there is a widening and argued as one.

**New prohibitions.** Does not read a repository it was not given. Does not report a
cross-repo absence as determined. Does not put a neighbouring repo's path in `touchpoints`.

## Open decisions

These want the user's call before any of the above is written:

**How a repo is named.** A skill argument at invocation, a line in the reported map, or
both. Both is the honest answer but it is two entry points for one thing, and the skill has
been consistently hostile to that.

**Whether the pass runs before or after the map is reported.** Before means one report and
one correction cycle, but the skill spends subagents on repos the user might not have wanted
read. After means the user sees the scoping dark and opts in, at the cost of a second map.
The B sketch above assumes after; before is defensible and cheaper in round-trips.

**Whether the revision is worth carrying.** It is what makes a stale finding detectable
later, and it is one more field on every citation. Carrying it once per repo in the map
rather than per citation is the compromise assumed above.

**Whether "no consumer found" ever becomes determined.** It should when the user says the
searched repos are the only consumers — but that is the user answering the question, not the
explorer, and the provenance then is the user's answer, not the citation. Worth being
explicit about, since the distinction is exactly what the skill's provenance rules protect.
