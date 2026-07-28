# Rulebook Alignment

Record of the breaking migration that replaced the mechanics built in Milestones 1-8 with the
mechanics of the reference space-trading rules. This was a deliberate breaking change: the
incompatible systems were removed rather than kept behind compatibility shims.

Terminology and product naming remain original to Starbound Frontier. Only mechanics were
adopted; no rulebook prose, artwork, names, or assets were copied.

## Resource role mapping

Serialized resource identifiers are unchanged, so no data migration layer was required. Each
now carries a documented gameplay role (`src/game/domain/types/resources.ts`):

| Identifier    | Role   | Notes                              |
| ------------- | ------ | ---------------------------------- |
| `alloy`       | ore    |                                    |
| `plasma`      | fuel   |                                    |
| `cryonite`    | carbon |                                    |
| `biofiber`    | food   |                                    |
| `quantumCore` | goods  | carries the special 2:1 trade rate |

`GOODS_RESOURCE_TYPE` derives from the role map, so the 2:1 rate can never drift away from the
mapping.

## Migration table

| Previous mechanic                                                            | Replacement                                                                                                                    | Affected modules                                                              | Status                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Randomized 37-hex board, one resource per hex                                | Data-driven board: 4 home colony systems, 8 planetary systems, 4 alien outposts, 15 space sectors; planets carry the resources | `board/space-board.ts`, `board/board-configuration.ts`                        | Done                                               |
| `generateBoard` + validation + retry                                         | Externally supplied `BoardConfiguration`; `validateSpaceBoard` / `validateBoardComposition`                                    | `board/` (generation deleted)                                                 | Done                                               |
| Axial hex coordinates, vertex/edge lattice identity                          | Intersection-id graph with mirrored adjacency                                                                                  | `board/space-board.ts`, `board/flight-graph.ts`                               | Done — geometry modules deleted                    |
| Hidden outer resource hexes                                                  | Face-down number discs on unexplored planets                                                                                   | `NumberDisc.revealed`                                                         | Done                                               |
| Central-star sector mechanics                                                | Removed; no equivalent                                                                                                         | —                                                                             | Removed                                            |
| Player-owned route edges (`TradeRoute`)                                      | Removed; ships travel a shared graph                                                                                           | `routes/` deleted                                                             | Removed                                            |
| Structures on arbitrary hex vertices                                         | Colonies/Spaceports on colony sites; Trade Stations on outpost docks                                                           | `buildings/structure.ts`                                                      | Done                                               |
| Outpost → Colony → Nexus tiers                                               | Colony, Spaceport (Colony + Shipyard), Trade Station                                                                           | `buildings/structure.ts`                                                      | Done                                               |
| Production 1/2/3 by tier                                                     | Colony **and** Spaceport each receive exactly 1                                                                                | `buildings/structure.ts`, `turns/production.ts`                               | Done                                               |
| Piece supply: 15 routes / 5 outposts / 4 colonies / 2 nexus                  | 9 Colonies / 7 Trade Stations / 3 Transport Ships / 3 Shipyards                                                                | `types/piece-supply.ts`                                                       | Done                                               |
| No composite pieces                                                          | Transport+Colony = Colony Ship; Transport+Trade Station = Trade Ship; Colony+Shipyard = Spaceport                              | `buildings/ship.ts`, `turns/construction.ts`                                  | Done                                               |
| Snake-order setup with per-placement legality                                | Beginner setup: fully deployed from configuration                                                                              | `setup/beginner-setup.ts` (old setup deleted)                                 | Done                                               |
| Setup resources from the second outpost's sectors                            | No production at setup; 3 hidden Reserve cards each                                                                            | `setup/beginner-setup.ts`                                                     | Done                                               |
| First player = seat 0                                                        | Highest two-die roll, ties by seat index                                                                                       | `setup/beginner-setup.ts`                                                     | Done                                               |
| Phases `trade` then `build`                                                  | Single `tradeAndBuild`, freely interleaved                                                                                     | `turns/turn-phase.ts`, `turns/turn-transitions.ts`                            | Done                                               |
| No flight phase                                                              | `flight` phase boundary before `endTurn`                                                                                       | `turns/turn-phase.ts`                                                         | Boundary only — movement is a future milestone     |
| Single `ResourceBank`                                                        | Face-up `ResourceSupply` + face-down `ReservePile`                                                                             | `turns/resource-bank.ts`                                                      | Done                                               |
| No reserve entitlement                                                       | Active player draws by VP: 4-7 → 2, 8-9 → 1, 10+ → 0                                                                           | `rules/rules-config.ts`, `turns/turn-transitions.ts`                          | Done                                               |
| Void Marauder: token, movement, production blocking, adjacency-limited theft | Roll of 7: discard half over 7, direct theft from any chosen opponent, 1 Reserve card to every opponent from the left          | `turns/seven-state.ts`, `turns/seven-transitions.ts` (crisis modules deleted) | Done                                               |
| 4:1 bank trade, 3:1 with a Nexus                                             | 3:1 with the Supply, 2:1 for `quantumCore`                                                                                     | `rules/rules-config.ts`, `trading/supply-trade.ts`                            | Done                                               |
| Costs for Trade Route / Outpost / Colony / Nexus                             | Costs for Spaceport, Colony Ship, Trade Ship, Cannon, Freight Pod, Booster                                                     | `rules/rules-config.ts`                                                       | Done                                               |
| No Mothership                                                                | `MothershipState`: boosters, cannons, freight pods, Fame Medal pieces                                                          | `types/mothership.ts`                                                         | State only — ball simulation is a future milestone |
| No upgrade limits                                                            | Cannon ≤ 6, Freight Pod ≤ 5, Booster ≤ 6                                                                                       | `rules/rules-config.ts`                                                       | Done                                               |
| Victory targets 8/10/14                                                      | Single 15-point target, checked on the holder's own turn                                                                       | `rules/rules-config.ts`, `scoring/scoring.ts`                                 | Done                                               |
| `Player.cachedVictoryPoints` starting at 0                                   | `Player.victoryPoints` starting at 4                                                                                           | `types/player.ts`                                                             | Done                                               |
| Longest Network                                                              | Removed; no equivalent in these rules                                                                                          | —                                                                             | Removed                                            |

## Build costs

Held in `src/game/domain/rules/rules-config.ts`; no resource literals appear elsewhere.

| Action      | Cost                                         |
| ----------- | -------------------------------------------- |
| Spaceport   | 3 cryonite + 2 biofiber                      |
| Colony Ship | 1 alloy + 1 plasma + 1 cryonite + 1 biofiber |
| Trade Ship  | 1 alloy + 1 plasma + 2 quantumCore           |
| Cannon      | 2 cryonite (max 6)                           |
| Freight Pod | 2 alloy (max 5)                              |
| Booster     | 2 plasma (max 6)                             |

## Scoring

| Source                                  | Points                               |
| --------------------------------------- | ------------------------------------ |
| Colony                                  | 1                                    |
| Spaceport                               | 2 in total (inclusive of its Colony) |
| Friendship Marker                       | 2                                    |
| Defeated pirate base token              | 1                                    |
| Terraformed ice planet token            | 1                                    |
| Each complete pair of Fame Medal pieces | 1                                    |

A Spaceport is stored as a single structure, so a site can never be counted as a Colony and a
Spaceport at once. Trade Stations score nothing directly.

## Deliberately not implemented

Extension points exist; none has a placeholder success path.

- Ship movement and the flight rules (the `flight` phase is a boundary only)
- Mothership speed determination (the physical ball mechanism)
- Encounters
- Friendship Cards and Marker transfer, including roll-of-7 discard protection
- Alien-outpost trade-station majority and Friendship Marker loss
- Pirate-base combat and ice-planet terraforming (the `PlanetHazard` model exists, and a
  hazard already suppresses production)
- Planetary-system exploration and disc reveal
- Establishing Colonies and Trade Stations from ships
- Advanced variable set-up

## Decisions taken during migration

Points where the reference rules are silent and a choice was required:

1. **Theft target with an empty hand is rejected.** The rules say to choose a player and draw
   a random card; they do not say what happens if that player holds nothing. Targets holding
   no cards are excluded from `eligibleTargetIds` and rejected with `INVALID_TARGET`.
   `skipSteal` covers the case where no opponent holds a card.
2. **Weighted theft.** Selection builds one entry per card held and draws with the seeded
   generator, so probability is exactly proportional to hand composition and fully replayable.
3. **Starting-player ties** break by seat index rather than re-rolling, keeping setup
   deterministic for a given seed.
4. **Supply size** is a documented default, not a rulebook value — see
   `docs/RULEBOOK_GAPS.md` gap 10.
5. **Hidden information** never enters events: Reserve draws record a count, and a theft
   records the two players but not the resource.
