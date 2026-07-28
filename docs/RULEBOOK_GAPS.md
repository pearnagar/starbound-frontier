# Rulebook Gaps

Matters the basic reference rules do not resolve. Each entry below blocks a specific piece of
implementation and is **not** guessed at anywhere in the codebase — where a gap affects the
domain, the affected values are externally configurable instead of hardcoded.

Nothing in this list may be invented. When a gap is closed, record the source and move the
resolved detail into the relevant design document.

## 1. Exact beginner-board coordinate topology

**Status: blocking a playable default board.**

The basic rules specify the beginner layout only as a picture: board sections joined by
numbered connectors, 15 space sectors placed face up into the vacant areas, number discs
placed on the settled home systems "as shown". No coordinate system, adjacency list, or
intersection numbering is published in text.

Consequently the following are unknown:

- absolute positions of the 4 home colony systems, 8 planetary systems, and 4 alien outposts
- which intersections are adjacent to which (the full flight graph)
- which colony sites border which planets
- which two intersections form each Spaceport's pair of spaceport sites
- placement of the 15 space sectors relative to the systems
- the fixed face-up number discs on the home systems

**How the code handles it.** `SpaceBoard` is pure data and `BoardConfiguration` supplies the
whole topology from outside the domain. `validateSpaceBoard` checks internal consistency
(mirrored adjacency, resolvable ids); `validateBoardComposition` checks the published
component counts. No module generates or assumes a layout.

**To close:** a machine-readable transcription of the beginner layout diagram, or the
Almanac's variable set-up rules.

## 2. Beginner starting placements

**Status: blocking default match creation.**

Each player begins with 2 Colonies and 1 Spaceport "as shown in the picture", and 1 Colony
Ship on "the specified spaceport site". The specific sites are diagram-only.

Also unresolved: the exact sites used by the unused fourth colour's blocking pieces in a
3-player game.

**How the code handles it.** `BeginnerStartingPlacement` and `NeutralBlockingPlacement` are
configuration records. `createBeginnerMatch` fails with `MISSING_STARTING_PLACEMENT` rather
than inventing a position for a seat.

**To close:** the same diagram transcription as gap 1.

## 3. Advanced variable set-up

**Status: out of scope by design.**

The basic rules explicitly defer the variable board and the variable home-system build to the
Almanac (referenced there as "Set-up, Variable"). None of it is implemented.

**To close:** the Almanac's set-up section.

## 4. Complete encounter-card behaviour

**Status: deferred to a future milestone.**

32 encounter cards exist. The basic rules describe only the resolution _procedure_ — the
player to the left reads the card, only the reader sees the text, the active player chooses
before results are announced, then the card is discarded — plus two sample cards and a note
that the 2 "Wear and Tear" cards apply to all players in successive order. The other card
texts and their effects are not published in the basic rules.

Also unresolved: the exact trigger conditions requiring the trade-ship tokens that are set
aside "for certain encounter cards".

**How the code handles it.** Not modelled at all. The Flight Phase exists as a phase boundary
with no encounter hook, so there is no placeholder success path.

**To close:** the full encounter deck listing.

## 5. Full friendship-card effects

**Status: deferred to a future milestone.**

20 friendship cards across 4 alien civilisations, 5 each. The basic rules show one example (a
2:1 food exchange) and mention in passing that Scientists cards may add boosters and cannons,
and that "some friendship cards protect against" the roll-of-7 discard. The remaining card
effects are not listed.

**How the code handles it.** Not modelled. The roll-of-7 discard therefore applies to every
player over the limit, with no protection path — noted in `RULEBOOK_ALIGNMENT.md`.

**To close:** the full friendship-card listing.

## 6. Detailed blockade exceptions

**Status: partially specified.**

The basic rules give the general "No Blockade" rules: a ship may not end movement on another
player's spaceport site; a trade ship may never end on a colony site; a colony ship may never
end on a docking point; a trade ship may end on a docking point only when it immediately
builds a trade station; and a colony ship that ends on a colony site without establishing must
either vacate or establish next turn.

What is not resolved is the set of exceptions the rules gesture at with "You are not allowed
to block certain intersections (see page 8, Special Cases)" beyond those listed, and how the
"vacate on your next turn" obligation is enforced if the player cannot legally move.

**How the code handles it.** Movement is not implemented, so no blockade rule is encoded.
`isIntersectionOccupied` models only the one-piece-per-intersection constraint.

**To close:** the Almanac's flight-rules section.

## 7. Explorer variants

**Status: out of scope by design.**

The rules note that explorer variants exist and live in the Almanac, and that exploration
behaves differently under them. Not implemented.

**To close:** the Almanac's explorer-variant section.

## 8. Number-disc icon matching

**Status: minor, affects board setup validation only.**

Face-down discs must be placed so that "the icons on the backs of the number discs match the
icons on the planets". The icon vocabulary and which planets carry which icon are not
enumerated in text, so this constraint cannot be validated.

**How the code handles it.** `Planet.disc` carries a value and a revealed flag only. Disc
distribution is supplied by configuration and not checked against icons.

**To close:** the component listing in the Almanac (pages 4-5) or the board diagram.

## 9. Mothership speed-ball distribution

**Status: deferred to a future milestone.**

Base speed comes from shaking the physical mothership: 5 balls (yellow, red, blue, black, and
one more) fall into an engine cone, and the two that land there sum to a base speed of 3-5,
with any black ball forcing base speed 3 and triggering an encounter. The per-colour ball
values are shown only in a diagram, and the physical probability distribution is obviously not
specified at all.

**How the code handles it.** Not modelled. `MothershipState` tracks upgrades and Fame Medal
pieces only. Any future implementation must choose an explicit, documented probability model
rather than claiming to reproduce the physical one.

**To close:** the ball-value diagram, plus a deliberate design decision on the digital
substitute (record it in `docs/DECISIONS.md`).

## 10. Supply size

**Status: minor, currently a chosen default.**

The rules sort resource cards into a card tray by type but do not state how many cards of each
type exist in total, so the face-up Supply has no published size. The Reserve pile's 8-per-type
composition _is_ specified and is implemented exactly.

**How the code handles it.** `createResourceSupply` takes a per-resource quantity with a
documented default (`DEFAULT_INITIAL_SUPPLY_QUANTITY`). Production already handles a shortage
all-or-nothing per resource, so the exact number changes behaviour only in edge cases.

**To close:** the component listing in the Almanac (pages 4-5).
