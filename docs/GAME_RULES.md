# Game Rules

Paraphrased statement of the mechanics Starbound Frontier implements. Source alignment and the
migration history are in `docs/RULEBOOK_ALIGNMENT.md`; unresolved questions are in
`docs/RULEBOOK_GAPS.md`.

## Objective

Reach **15 victory points**. The game ends the moment a player is at or above 15 during their
own turn — an opponent cannot win on someone else's turn.

## Resources

Five resources, each produced by a type of planet. Identifiers are the serialized names used
throughout the code; roles describe the gameplay function.

| Identifier    | Role   | Special                       |
| ------------- | ------ | ----------------------------- |
| `alloy`       | ore    |                               |
| `plasma`      | fuel   |                               |
| `cryonite`    | carbon |                               |
| `biofiber`    | food   |                               |
| `quantumCore` | goods  | trades with the Supply at 2:1 |

Resource cards in hand are hidden from other players.

### Supply and Reserve

Two distinct stores:

- **Supply** — face up. Players trade with it, pay build costs into it, and discard to it.
- **Reserve pile** — face down, built from 8 cards of each of the 5 resources, shuffled
  deterministically. Draws from it are hidden. When it empties it is rebuilt the same way.

## Board

- 4 settled **home colony systems** where players begin
- 8 **planetary systems** that begin unexplored
- 4 **alien outposts**, each with a central docking point and 5 docks
- 15 **space sectors** of empty traversable space
- **Intersections** form a connected graph; ships move between them

Each system has **3 colony sites**, each sitting between two planets. Each Spaceport has
**2 spaceport sites** — the intersections adjacent to it — from which ships launch.

Planets in unexplored systems carry **face-down number discs**, revealed when a ship reaches an
adjacent intersection. A face-down disc never produces. A planet blocked by a pirate base or an
ice planet carries no ordinary production number until the hazard is cleared.

The exact physical layout is supplied as configuration — see `docs/RULEBOOK_GAPS.md`.

## Pieces

Each player has 9 Colonies, 7 Trade Stations, 3 Transport Ships, and 3 Shipyards.

Composite pieces:

- Transport Ship + Colony = **Colony Ship**
- Transport Ship + Trade Station = **Trade Ship**
- Colony + Shipyard = **Spaceport**

A Spaceport keeps its Colony; upgrading adds a Shipyard around it. When a Colony Ship
establishes a Colony, its Transport Ship returns to supply and the Colony stays on the board;
a Trade Ship establishing a Trade Station works the same way.

## Setup (beginner)

Each player starts with:

- 2 Colonies and 1 Spaceport on their home system
- 1 Colony Ship on the specified spaceport site
- 4 victory points
- 3 cards drawn from the Reserve pile (hidden)
- 1 Fame Medal piece
- 1 Booster on their Mothership

The starting player is the highest roller on two dice. In a 3-player game, the unused fourth
colour's pieces are placed as blockers and take no further part.

No starting resources are produced from adjacent planets.

## Turn structure

1. **Production Phase** — roll two dice; all players collect; the roller draws their Reserve
   entitlement.
2. **Trade & Build Phase** — trade and build in any order, repeatedly.
3. **Flight Phase** — determine speed and move ships.
4. **End Turn** — pass to the player on the left.

### Production

Every revealed planet showing the rolled number produces. Each **Colony** adjacent to it
receives 1 matching resource, and each **Spaceport** adjacent to it also receives exactly 1 —
a Spaceport does not produce more than a Colony. Trade Stations receive no planetary
production.

If total demand for a resource exceeds the Supply, that resource is withheld from everyone
this roll; other resources still resolve.

### Reserve entitlement

After an ordinary production roll, **only the active player** draws from the Reserve pile,
based on their current victory points:

| Victory points | Cards drawn |
| -------------- | ----------- |
| 4-7            | 2           |
| 8-9            | 1           |
| 10+            | 0           |

### Rolling a 7

No planet produces. Then, in order:

1. Every player holding more than 7 resource cards discards half, rounded down, to the Supply.
   Requirements are fixed at the moment the 7 is rolled.
2. The active player chooses any other player and steals 1 random card from their hand. There
   is no board token and no adjacency requirement. A player holding no cards is not a legal
   target.
3. Every opponent draws 1 card from the Reserve pile, starting with the player to the active
   player's left.

## Trading

### With the Supply

- 3 identical resources → 1 different resource
- 2 `quantumCore` → 1 different resource

The improved rate belongs to the resource itself, not to any structure a player owns.

### With players

Only during the active player's turn. The active player may trade with anyone; other players
may trade only with the active player, never with each other or with the Supply. Only the
active player may finalize a deal.

## Building

Repeatable and freely interleaved with trading during Trade & Build.

| Action      | Cost                                         | Notes                                         |
| ----------- | -------------------------------------------- | --------------------------------------------- |
| Spaceport   | 3 cryonite + 2 biofiber                      | Upgrades an owned Colony; consumes 1 Shipyard |
| Colony Ship | 1 alloy + 1 plasma + 1 cryonite + 1 biofiber | Consumes 1 Transport Ship + 1 Colony          |
| Trade Ship  | 1 alloy + 1 plasma + 2 quantumCore           | Consumes 1 Transport Ship + 1 Trade Station   |
| Cannon      | 2 cryonite                                   | Maximum 6                                     |
| Freight Pod | 2 alloy                                      | Maximum 5                                     |
| Booster     | 2 plasma                                     | Maximum 6                                     |

Ships may only be built on one of the player's own **unoccupied spaceport sites**, and may move
during the Flight Phase of the same turn.

## Scoring

| Source                                  | Points                              |
| --------------------------------------- | ----------------------------------- |
| Colony                                  | 1                                   |
| Spaceport                               | 2 in total, inclusive of its Colony |
| Friendship Marker                       | 2                                   |
| Defeated pirate base token              | 1                                   |
| Terraformed ice planet token            | 1                                   |
| Each complete pair of Fame Medal pieces | 1                                   |

Trade Stations do not score directly; their value is the Friendship Marker they can win and
retain.

## Not yet implemented

See `docs/IMPLEMENTATION_PLAN.md` for scheduling and `docs/RULEBOOK_ALIGNMENT.md` for the full
list: ship movement, Mothership speed, encounters, Friendship Cards, alien-outpost majority,
pirate bases, ice planets, exploration reveal, and establishing Colonies and Trade Stations.
