# AI Design Notes

Forward-looking notes for the AI milestone (Milestone 21). No AI is implemented yet; this
records how the corrected rules shape what an AI opponent will have to reason about, so the
design is not started from the wrong model.

The rulebook alignment refactor changed several assumptions that an AI would otherwise have
been built around — see `docs/RULEBOOK_ALIGNMENT.md`.

## What the corrected rules change for an AI

### There is no network to extend

The previous model had player-owned route edges and a Longest Network award, which would have
made the core AI problem a graph-expansion one. Neither exists now. Expansion is instead
**ship logistics**: build a ship at a spaceport site, fly it across a shared graph, and convert
it into a Colony or Trade Station at the destination.

The shared flight graph means positions are contested by _timing_, not by ownership — no
opponent can wall off a route, but they can reach a colony site first.

### Production evaluation is flatter

Colonies and Spaceports both produce exactly 1 resource. A Spaceport is therefore **never** a
production upgrade — it is a 1-point score increase plus a launch site. Any evaluation function
carried over from a tiered-production model would badly overvalue it.

Site quality reduces to: how many adjacent planets, what numbers they carry, and what resources
they yield. Disc probability weighting (6 and 8 highest, 2 and 12 lowest) is the main signal.

### Unrevealed information is a first-class factor

Planets in unexplored systems carry face-down discs, and a system's discs are revealed only when
a ship reaches an adjacent intersection. An AI must therefore reason about **expected** value of
an unexplored system, and treat exploration as an information-gathering action with its own
payoff, not merely a step toward settling.

Hazards compound this: a revealed disc may turn out to be a pirate base or ice planet, which
blocks the adjacent colony sites until cleared. Cannon and freight-pod counts gate whether a
given AI can clear them at all.

### The Reserve entitlement creates a catch-up gradient

Draws by victory points (4–7 → 2, 8–9 → 1, 10+ → 0) mean a trailing AI receives a materially
higher income than a leading one. Two consequences:

- Raw resource income is a poor proxy for position; an AI evaluating only its hand will
  misjudge who is winning.
- Crossing from 7 to 8 points, and again from 9 to 10, carries a hidden cost. An AI may
  rationally delay a low-value point when a larger play is one turn away.

### The roll of 7 is a direct-choice problem

No board token, no adjacency constraint. The active player picks any opponent holding cards and
steals one at random. This makes the decision purely about _whose hand to degrade_ — hand size,
inferred contents, and board threat — rather than about board placement.

Note also that every opponent draws a free Reserve card afterward, so rolling a 7 is not purely
advantageous to the roller.

Discard avoidance matters: holding more than 7 cards is a standing risk, so an AI should weigh
spending down against banking for a large purchase.

### Hidden hands require inference, not lookup

Resource hands are hidden, Reserve draws are hidden, and the theft event deliberately omits the
stolen resource. An AI must not read opponents' hands from match state — doing so would be
cheating, and the event stream is deliberately built so that it cannot be done accidentally.

What _is_ observable: hand sizes, public production grants, spending, and trades. An honest AI
should maintain a belief distribution from those.

## Difficulty levels

`AiDifficulty` already exists as `cadet | commander | admiral`. Suggested separation, to be
revisited when the AI is built:

- **cadet** — greedy, one-step lookahead, no opponent modelling, trades naively.
- **commander** — evaluates site quality with disc probabilities, tracks the Reserve gradient,
  models opponent hands coarsely by size.
- **admiral** — plans multi-turn ship logistics, values exploration information, times victory
  point acquisition around the Reserve tiers.

Difficulty must come from depth of reasoning, never from hidden-information access or from
resource bonuses the rules do not grant.

## Blocked on unimplemented systems

An AI cannot be meaningfully built until the systems it plays are in place. In dependency
order: ship movement (Milestone 11), Mothership speed (12), exploration (13), establishing
Colonies (14) and Trade Stations (15). Encounters (19) and Friendship Cards (18) add
significant decision surface and should exist before difficulty is tuned.

## Architectural constraints

- The AI lives in `src/game/domain/ai/`, created when Milestone 21 begins.
- It must be pure: no React, PixiJS, browser APIs, or `Math.random()`. Any randomness threads
  the seeded generator, so an AI turn replays identically from a seed.
- It consumes the same public validators as a human player. An AI must never construct a match
  state directly or bypass `DomainResult` validation — if a move is illegal for a human, it is
  illegal for the AI.
