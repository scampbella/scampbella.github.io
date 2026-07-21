## Ruleset: BBG (BuddyBoardGames)

Last updated: 2026-06-03

---

## Overview

- **Dice**: 5 six-sided dice
- **Turns**: 13 rounds (one per score category)
- **Per turn**: Up to 3 rolls, with the option to lock/unlock individual dice between rolls
- **Scoring**: After rolling (at least once), select one unfilled category to score with the current dice values
- **Goal**: Maximize total score across all 13 categories

---

## Dice Mechanics

| Rule | Detail |
|------|--------|
| Dice count | 5 |
| Rolls per turn | 3 (decrements on each roll) |
| Locking | Click a die to toggle its locked state. Locked dice are not re-rolled |
| Lock restriction | Dice cannot be locked/unlocked until at least one roll has been made (rollsLeft < 3) |
| Turn start | All dice unlock, reset to value 1 (visual only; value doesn't persist) |
| Game over | All dice lock; no further interaction |

---

## Upper Section

All six number categories. Score the **sum** of dice matching that number.

| Category | Scoring |
|----------|---------|
| Ones     | Sum of all 1s |
| Twos     | Sum of all 2s |
| Threes   | Sum of all 3s |
| Fours    | Sum of all 4s |
| Fives    | Sum of all 5s |
| Sixes    | Sum of all 6s |

### Upper Bonus

| Condition | Bonus |
|-----------|-------|
| Upper total ≥ 63 | +35 |
| Upper total < 63 | No bonus |

The bonus tracker in the UI shows:
- **"X points until +35 bonus"** — bonus is still achievable (even with worst-case remaining rolls)
- **"Bonus Missed"** — bonus is mathematically impossible with remaining empty slots
- **"Bonus Secured: +35"** — bonus already earned

---

## Lower Section

Seven categories with fixed or conditional scoring.

| Category | Scoring | Notes |
|----------|---------|-------|
| 3 of a Kind | Sum of all 5 dice if at least 3 match; else 0 | Uses `hasOfAKind(dice, 3)` |
| 4 of a Kind | Sum of all 5 dice if at least 4 match; else 0 | Uses `hasOfAKind(dice, 4)` |
| Full House | 25 if exactly 3 of one value + 2 of another; else 0 | Fixed 25 points |
| Sm Straight | 30 if any 4 dice form a sequence (e.g. 1-2-3-4, 2-3-4-5, 3-4-5-6); else 0 | Fixed 30 points |
| Lg Straight | 40 if all 5 dice form a sequence (1-2-3-4-5 or 2-3-4-5-6); else 0 | Fixed 40 points |
| Yahtzee | 50 if all 5 dice match; else 0 | Fixed 50 points |
| Chance | Sum of all 5 dice | Always scores |

### Straight Detection

- The straight checker sorts unique values, then slides a window of length `len` (4 for small, 5 for large)
- Returns true if any contiguous run of `len` values is found
- Example: `[1,2,3,5,6]` contains the sequence `1-2-3` but needs 4 for a small straight — only `5-6` extends nowhere, so it fails small straight
- Example: `[1,3,4,5,6]` contains `3-4-5-6` → small straight passes

---

## Yahtzee & Joker Rules

### First Yahtzee

- Score in the Yahtzee box → **50 points**
- If scored as 0 (all dice match but player chooses a different category or the Yahtzee box is scored as 0), no bonus is earned

### Joker Activation

Joker rules activate when the Yahtzee box is **filled with any score** — including 0. A zeroed Yahtzee still triggers Joker (but never earns the +100 bonus).

### Subsequent Yahtzees (Joker Rules)

When a Yahtzee is rolled **and** the main Yahtzee box is already filled (any score, including 0):

**Forced placement (BBG wild-card rule).** A wild-card Yahtzee must be scored in a restricted set of categories, checked in order:

1. **Matching upper open** → it **must** go in the matching upper box (e.g. five 4s → Fours = 20). That is the only legal category.
2. **Matching upper filled, some Lower open** → it **must** go in an open **Lower** box, scored as the Joker value below. It may *not* be dumped into another open upper box.
3. **Matching upper filled, all Lower filled** → it is scored (as 0) in any open **Upper** box.

**Joker values (tier 2 — open Lower box).** When a wild-card Yahtzee is scored in a Lower box:

| Lower Category | Joker Scoring |
|----------------|---------------|
| 3 of a Kind, 4 of a Kind, Chance | Sum of all 5 dice |
| Full House | **Always 25** (regardless of dice faces) |
| Sm Straight | **Always 30** (regardless of dice faces) |
| Lg Straight | **Always 40** (regardless of dice faces) |

In tiers 1 and 3 the Yahtzee is scored in an Upper box and scores normally (sum of the matching face — e.g. five 4s in Fours = 20, or five 4s dumped in an open Twos = 0).

The +100 Yahtzee bonus (see below) is awarded independently of where the Yahtzee is scored.

### Yahtzee Bonus

Each **additional** Yahtzee rolled after the main Yahtzee box is filled with **50** earns **+100 bonus points**. A zeroed Yahtzee never earns bonuses.

- The bonus counter increments every time `scoreCategory()` is called with a Yahtzee roll when `slots[yahtzeeIdx].score === 50`
- Bonus is added to the grand total: `grandTotal = upperTotal + upperBonus + lowerTotal + (bonusYahtzees × 100)`

---

## Turn Flow

1. **Start of turn**: All dice unlocked, values reset to 1, rollsLeft = 3
2. **Roll**: Click ROLL DICE. All unlocked dice get new random values. rollsLeft decrements.
3. **Lock/Unlock**: Click individual dice to toggle lock state. Only available after at least one roll.
4. **Roll again** (optional): Up to 2 re-rolls (3 rolls total per turn)
5. **Score**: Click an empty, selectable category row. The turn ends immediately:
   - Category is filled with its score
   - Round increments (unless game over)
   - Dice reset for next turn
6. **Game Over**: After the 13th category is scored, the overlay appears with final score breakdown


### Category Selection Restrictions

- Must have rolled at least once (rollsLeft < 3) before selecting a category
- Once a category is filled, it cannot be changed
- All unfilled categories are normally selectable — **except** under the BBG Joker forced-upper rule: when a Yahtzee is rolled and the Yahtzee box is already filled, if the matching upper box is still open it becomes the only selectable category
- Filled categories, and categories made illegal by the forced-upper rule, are visually disabled

## Scoring Summary

```
Grand Total = Upper Total + Upper Bonus + Lower Total + (Bonus Yahtzees × 100)

Where:
  Upper Total   = sum of all filled Upper Section scores
  Upper Bonus   = 35 if Upper Total ≥ 63, else 0
  Lower Total   = sum of all filled Lower Section scores
  Bonus Yahtzees = count of additional Yahtzees after first is scored as 50
```

---

## High Score

- Persisted in `localStorage` under key `yahtzee_high_score`
- New record triggers "★ NEW RECORD!" display on game-over screen
- Survives page reloads and browser sessions (within same browser/profile)

---

## Implementation Notes

- **Language**: TypeScript, compiled via `build.mjs` → `game.js`
- **Source**: Split across `src/` — see `src/tsconfig.json` and `build.mjs`
- **Dice values**: `1` is the reset/default value shown at turn start
- **RNG**: `Math.random()` — non-cryptographic, sufficient for a casual game
- **No undo**: Category selections are final
- **Zero scores**: A category can be scored as 0 (e.g. 3 of a Kind with no triplet)