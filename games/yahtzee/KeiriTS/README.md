# Keiri Bot

Heuristic Yahtzee bot — zero dependencies, single-file module for static sites.

Plays at ~75–85% of optimal. Supports both Hasbro (forced Joker) and
BuddyBoardGames (free-choice Joker) rulesets.

## Quick Start

```ts
import { selectAction, CATEGORY } from "./src/bot/index.ts";

const action = selectAction(
  [1, 2, 3, 4, 6], // dice (sorted, 1–6; empty [] if not rolled)
  0,                // rolls used (0–2)
  { 0: 3, 1: 6 },  // filledScores: category index → score
  0,                // yahtzee bonus count
  "bbg",            // ruleset: "bbg" | "hasbro"
);

// → { type: "roll", holdMask: 15 }
// or { type: "score", category: 10 }
```

## API

### `selectAction(dice, rollsUsed, filledScores, yahtzeeBonuses?, ruleset?)`

Returns the bot's recommended action. `dice` must be sorted ascending. Empty
array means dice not yet rolled.

### `legalActions(dice, rollsUsed, filledScores, yahtzeeBonuses?, ruleset?)`

Returns all legal actions for a game state. Includes all 32 hold masks (not
just the heuristic subset).

### `score(category, dice, filledScores?, ruleset?)`

Scores a roll in a category. Returns `{ baseScore, yahtzeeBonus, upperBonus,
totalDelta }`.

### Categories

```ts
import { CATEGORY } from "./src/bot/index.ts";

CATEGORY.Ones        // 0
CATEGORY.Twos        // 1
CATEGORY.Threes      // 2
CATEGORY.Fours       // 3
CATEGORY.Fives       // 4
CATEGORY.Sixes       // 5
CATEGORY.ThreeKind   // 6
CATEGORY.FourKind    // 7
CATEGORY.FullHouse   // 8
CATEGORY.SmallStraight // 9
CATEGORY.LargeStraight // 10
CATEGORY.Yahtzee     // 11
CATEGORY.Chance      // 12
```

### Simulation

```ts
import { simulate, evaluate } from "./src/bot/index.ts";

// Play one game
const report = simulate(42, "bbg");
// { finalScore: 271, turnCount: 13, upperBonus: true, yahtzeeBonusCount: 0 }

// Run many games
const stats = evaluate(1000, 1, "bbg");
// { mean: 227, min: 111, max: 539, p50: 216, ... }
```

## Commands

```bash
# Run tests
npm test

# Benchmark
npm run benchmark -- games=500 seed=1
npm run benchmark -- games=500 seed=1 csv > scores.csv
```

## Rulesets

| Ruleset | Joker Behavior |
|---|---|
| `"bbg"` (default) | Free-choice Joker. Yahtzee can score any open category once both Yahtzee and matching upper are filled. |
| `"hasbro"` | Forced Joker. Yahtzee must score matching upper if open; falls back to lower, then any upper. |

## How It Works

The heuristic bot evaluates each legal action by computing an expected-value
heuristic:

- **Score actions**: Base score plus utility adjustments for upper bonus
  pressure, time-pressure weighting, zero-score penalties, and category-specific
  bonuses.
- **Roll actions**: Expected value over the reroll distribution (252 canonical
  sorted-dice outcomes, weighted by multinomial count).

The bot precomputes reroll distributions once at module load. A per-decision
cache of best-score values avoids recomputation across hold-mask evaluations.

## License

MIT
