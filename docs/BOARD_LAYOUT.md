# Default Board Layout

The original default layout Starbound Frontier ships with, produced by
`createDefaultBoardConfiguration()` in `src/game/domain/board/default-board.ts`.

This is an **original design**, not a transcription of any published board. The reference
rules give their beginner layout only as a picture (`docs/RULEBOOK_GAPS.md` gaps 1 and 2), so
no coordinate list exists to copy even in principle. What is reproduced here is the _rule
model_ the codebase already implements — the component counts, the site relationships, the
disc mechanics — arranged into a fresh topology.

## Concept

A **frontier corridor**. The four settled home systems sit in a row along one boundary, and
everything unexplored extends outward from it in bands: near planetary systems, then the alien
outposts, then the far planetary systems at the rim. Every player faces the same direction —
outward — rather than inward toward a shared centre.

```
  y = 8   link-west   far-a    far-b    far-c    far-d   link-east
  y = 7                 deep-1   deep-2   deep-3   deep-4
  y = 6            veyra     thessi     okarun     lumene        (alien outposts)
  y = 5   rim-1      rim-2      rim-3      rim-4      rim-5
  y = 4         near-a    near-b    near-c    near-d
  y = 2   lane-1 .. lane-9                                       (frontier corridor)
  y = 0   home-a      home-b      home-c      home-d             (settled frontier)
```

Positions are **integer logical grid coordinates** used only to make the data readable and to
give a future renderer a deterministic starting arrangement. Nothing in the domain derives
adjacency, identity, or legality from them — the flight graph is an explicit link list. No
floating-point coordinates appear anywhere.

## Object counts

| Object                       | Count | Note                                          |
| ---------------------------- | ----- | --------------------------------------------- |
| Home colony systems          | 4     | `home-a` … `home-d`                           |
| Explorable planetary systems | 8     | `near-a` … `near-d`, `far-a` … `far-d`        |
| Alien outposts               | 4     | `veyra`, `thessi`, `okarun`, `lumene`         |
| Space sectors                | 15    | `sector-01` … `sector-15`                     |
| Planets                      | 36    | 3 per system                                  |
| Colony sites                 | 36    | 3 per system                                  |
| Spaceport sites              | 8     | 2 per home system                             |
| Docking points               | 4     | 1 per outpost                                 |
| Docks                        | 20    | 5 per outpost                                 |
| Intersections                | 68    | 36 colony + 8 spaceport + 4 docking + 20 open |

Each system's three colony sites border planet-slot pairs (0,1), (1,2) and (2,0) — a triangle,
so every site borders exactly two planets and every planet is bordered by exactly two sites.

## Home-system arrangement

Each home system holds 3 planets, 3 colony sites, and 2 spaceport sites. A seat begins with
Colonies on colony sites 0 and 1, a Spaceport on site 2, and its Colony Ship on spaceport
site 0 — the same shape for every seat, in its own home system.

Balance is checked by test rather than asserted here:

- **Production odds are equal.** Every home totals **10/36** across its three discs. The two
  flanks split it 4+4+2 and the two centres 4+3+3, which trades one strong planet for a
  steadier spread without changing the total.
- **Resource variety is equal.** Every home holds 3 distinct resources.
- **Graph access is equal.** Every home's launch site is 5 steps from its nearest outpost,
  2 steps from its nearest planetary-system colony site, and has 3 departure paths.
- `quantumCore` (the 2:1 goods resource) appears on the two flank homes only, on a
  low-probability number, so no seat opens with cheap goods on a hot number.

The remaining asymmetry is a mild flank penalty in _total_ distance to all eight planetary
systems (42–48 steps), which is inherent to a linear frontier and does not favour any seat
enough to dominate.

## Graph organization

Movement runs along three west–east lanes joined by outward links:

- the **corridor** (`lane-1` … `lane-9`) immediately outward of the home frontier,
- the **rim** (`rim-1` … `rim-5`) between the near systems and the outposts,
- **deep space** (`deep-1` … `deep-4`) between the outposts and the far systems,
- plus **flank links** (`link-west`, `link-east`) giving the far band a second way home.

Redundancy is deliberate. Each home reaches the corridor from both of its spaceport sites;
each near system has two corridor entry points and two rim exits; each outpost docking point
is reachable from two different rim nodes. No region depends on a single edge, so the frontier
never collapses into one unavoidable route.

The 15 space sectors group the open intersections and outpost docking points into named
regions. A sector carries no production and no movement rule of its own — it exists to give
the renderer a stable partition and players a way to name a region. System sites belong to
their system, not to a sector.

Docks are Trade Station berths, **not** movement nodes: a dock id is never an intersection id,
which validation enforces.

## Number-disc strategy

All ten legal values (2, 3, 4, 5, 6, 8, 9, 10, 11, 12) are used; 7 never appears.

- **Home discs begin revealed** — those systems are already settled and produce from turn one.
- **Frontier discs begin face down** — they produce nothing until a later exploration milestone
  reveals them.
- **Neither 6 nor 8 appears on a home system.** The two most productive numbers sit in
  unexplored space and must be flown to, which gives exploration a reason to happen.
- The two 6s and two 8s are split across the near and far bands and across opposite flanks, so
  no local area concentrates high-probability production, and no colony site anywhere borders
  two of them at once.

Resource and number are separate fields on `Planet` (`resource` and `disc.value`), so neither
is derivable from the other.

## Three-player neutral setup

Seats 0–2 take `home-a` through `home-c`. The unused fourth colour's pieces — **2 neutral
Colonies and 1 neutral Spaceport** — are placed on `home-d`'s three colony sites through the
existing `neutralBlockingByPlayerCount` configuration, consumed by the same setup code path as
a 4-player game. There is no separate 3-player setup routine.

Neutral pieces are not player structures. They appear only in
`Match.neutralBlockedIntersectionIds`, never in `Match.structures`, so they cannot produce,
move, trade, score, or act — their occupied sites are simply blocked.

## Deferred

Not decided here, and not invented:

- **Pirate-base and ice-planet disc distribution.** The basic rules do not define which
  frontier discs are replaced by hazards on reveal. This board therefore uses ordinary hidden
  discs everywhere. Recorded as gap 11 in `docs/RULEBOOK_GAPS.md`; the `PlanetHazard` model
  already exists, so special discs can be added without reshaping the data.
- **Number-disc icon matching** (`docs/RULEBOOK_GAPS.md` gap 8) — the icon vocabulary is not
  published, so no icon constraint is modelled or validated.
- **Rendering.** Grid coordinates exist in `default-board-layout.ts` but nothing draws them yet.
- **Movement, exploration reveal, Trade Station establishment, and Friendship Cards** are all
  later milestones. This board supplies the topology they will need and nothing more.
