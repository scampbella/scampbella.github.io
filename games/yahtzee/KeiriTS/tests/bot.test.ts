// Tests for the Keiri heuristic bot (TypeScript port).
// Run with: node --import tsx --test tests/bot.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  selectAction,
  legalActions,
  score,
  CATEGORY,
} from "../src/bot/index.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create sorted dice from any order of values. */
function dice(...values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** All 13 categories open, nothing filled. */
function emptyScores(): Record<number, number> {
  return {};
}

/** Sheet filled with zeros except for one open category. */
function filledExcept(open: number): Record<number, number> {
  const scores: Record<number, number> = {};
  for (let c = 0; c < 13; c++) {
    if (c !== open) scores[c] = 0;
  }
  return scores;
}

// ── Scoring tests ────────────────────────────────────────────────────────────

describe("scoring", () => {
  it("upper bonus is awarded when threshold is crossed", () => {
    const scores: Record<number, number> = {
      [CATEGORY.Ones]: 3,
      [CATEGORY.Twos]: 6,
      [CATEGORY.Threes]: 9,
      [CATEGORY.Fours]: 12,
      [CATEGORY.Fives]: 15,
    };

    const result = score(CATEGORY.Sixes, dice(6, 6, 6, 6, 6), scores);

    assert.equal(result.baseScore, 30);
    assert.equal(result.upperBonus, 35);
    assert.equal(result.totalDelta, 65);
  });

  it("scoring is bounded for all canonical dice", () => {
    const maxScores: Record<number, number> = {
      [CATEGORY.Ones]: 5,
      [CATEGORY.Twos]: 10,
      [CATEGORY.Threes]: 15,
      [CATEGORY.Fours]: 20,
      [CATEGORY.Fives]: 25,
      [CATEGORY.Sixes]: 30,
      [CATEGORY.ThreeKind]: 30,
      [CATEGORY.FourKind]: 30,
      [CATEGORY.FullHouse]: 25,
      [CATEGORY.SmallStraight]: 30,
      [CATEGORY.LargeStraight]: 40,
      [CATEGORY.Yahtzee]: 50,
      [CATEGORY.Chance]: 30,
    };

    const diceSet = new Set<string>();
    for (let a = 1; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        for (let c = b; c <= 6; c++) {
          for (let d = c; d <= 6; d++) {
            for (let e = d; e <= 6; e++) {
              diceSet.add([a, b, c, d, e].join(","));
            }
          }
        }
      }
    }

    assert.equal(diceSet.size, 252);

    for (const diceStr of diceSet) {
      const d = diceStr.split(",").map(Number);
      for (let cat = 0; cat < 13; cat++) {
        const result = score(cat, d, {}, "hasbro");
        assert.ok(
          result.baseScore <= maxScores[cat],
          `category ${cat} scored ${result.baseScore} for [${d}] (max ${maxScores[cat]})`,
        );
      }
    }
  });

  it("dice scoring computes correct values", () => {
    assert.equal(score(CATEGORY.Ones, [1, 1, 1, 1, 1]).baseScore, 5);
    assert.equal(score(CATEGORY.Ones, [2, 3, 4, 5, 6]).baseScore, 0);

    assert.equal(score(CATEGORY.ThreeKind, [1, 2, 3, 3, 3]).baseScore, 12);
    assert.equal(score(CATEGORY.ThreeKind, [1, 2, 3, 4, 5]).baseScore, 0);

    assert.equal(score(CATEGORY.FullHouse, [2, 2, 3, 3, 3]).baseScore, 25);
    assert.equal(score(CATEGORY.FullHouse, [1, 2, 3, 4, 5]).baseScore, 0);

    assert.equal(score(CATEGORY.SmallStraight, [1, 2, 3, 4, 6]).baseScore, 30);
    assert.equal(score(CATEGORY.SmallStraight, [3, 4, 5, 6, 6]).baseScore, 30);

    assert.equal(score(CATEGORY.LargeStraight, [1, 2, 3, 4, 5]).baseScore, 40);
    assert.equal(score(CATEGORY.LargeStraight, [2, 3, 4, 5, 6]).baseScore, 40);
    assert.equal(score(CATEGORY.LargeStraight, [1, 2, 3, 4, 6]).baseScore, 0);

    assert.equal(score(CATEGORY.Yahtzee, [6, 6, 6, 6, 6]).baseScore, 50);
    assert.equal(score(CATEGORY.Yahtzee, [1, 2, 3, 4, 5]).baseScore, 0);

    assert.equal(score(CATEGORY.Chance, [1, 2, 3, 4, 5]).baseScore, 15);
    assert.equal(score(CATEGORY.Fives, [1, 2, 5, 5, 5]).baseScore, 15);
  });
});

// ── Joker tests ──────────────────────────────────────────────────────────────

describe("joker rules (Hasbro)", () => {
  it("forces matching upper category when open", () => {
    const scores: Record<number, number> = {
      [CATEGORY.Yahtzee]: 50,
    };

    const legal = legalActions(dice(6, 6, 6, 6, 6), 3, scores, 0, "hasbro");
    const scoreActions = legal.filter(a => a.type === "score");

    assert.equal(scoreActions.length, 1);
    assert.deepEqual(scoreActions[0], { type: "score", category: CATEGORY.Sixes });
  });

  it("allows lower categories when matching upper is filled", () => {
    const scores: Record<number, number> = {
      [CATEGORY.Yahtzee]: 50,
      [CATEGORY.Sixes]: 30,
    };

    const legal = legalActions(dice(6, 6, 6, 6, 6), 3, scores, 0, "hasbro");
    const scoreCats = legal
      .filter(a => a.type === "score")
      .map(a => (a as { type: "score"; category: number }).category);

    assert.ok(scoreCats.includes(CATEGORY.FullHouse));
    assert.ok(scoreCats.includes(CATEGORY.SmallStraight));
    assert.ok(!scoreCats.includes(CATEGORY.Ones));

    const result = score(CATEGORY.LargeStraight, dice(6, 6, 6, 6, 6), scores, "hasbro");
    assert.equal(result.baseScore, 40);
    assert.equal(result.yahtzeeBonus, 100);
  });

  it("zeroed yahtzee does not enable joker", () => {
    const scores: Record<number, number> = {
      [CATEGORY.Yahtzee]: 0,
    };

    const legal = legalActions(dice(6, 6, 6, 6, 6), 3, scores, 0, "hasbro");
    const scoreCats = legal
      .filter(a => a.type === "score")
      .map(a => (a as { type: "score"; category: number }).category);

    assert.ok(scoreCats.includes(CATEGORY.Sixes));
    assert.ok(scoreCats.includes(CATEGORY.Chance));

    const result = score(CATEGORY.FullHouse, dice(6, 6, 6, 6, 6), scores, "hasbro");
    assert.equal(result.baseScore, 0);
  });

  it("falls back to upper categories when lower section is full", () => {
    const scores: Record<number, number> = {
      [CATEGORY.ThreeKind]: 0,
      [CATEGORY.FourKind]: 0,
      [CATEGORY.FullHouse]: 0,
      [CATEGORY.SmallStraight]: 0,
      [CATEGORY.LargeStraight]: 0,
      [CATEGORY.Yahtzee]: 50,
      [CATEGORY.Chance]: 0,
      [CATEGORY.Sixes]: 30,
    };

    const legal = legalActions(dice(6, 6, 6, 6, 6), 3, scores, 0, "hasbro");
    const scoreCats = legal
      .filter(a => a.type === "score")
      .map(a => (a as { type: "score"; category: number }).category);

    assert.deepEqual(scoreCats, [
      CATEGORY.Ones,
      CATEGORY.Twos,
      CATEGORY.Threes,
      CATEGORY.Fours,
      CATEGORY.Fives,
    ]);
  });
});

describe("joker rules (BBG)", () => {
  it("allows zeroed yahtzee wildcard", () => {
    const scores: Record<number, number> = {
      [CATEGORY.Yahtzee]: 0,
    };

    const legal = legalActions(dice(6, 6, 6, 6, 6), 3, scores, 0, "bbg");
    const scoreCats = legal
      .filter(a => a.type === "score")
      .map(a => (a as { type: "score"; category: number }).category);
    assert.equal(scoreCats.length, 12); // everything except Yahtzee

    // Before matching upper filled: no Joker
    let result = score(CATEGORY.FullHouse, dice(6, 6, 6, 6, 6), scores, "bbg");
    assert.equal(result.baseScore, 0);

    // After matching upper filled: Joker active
    const scores2 = { ...scores, [CATEGORY.Sixes]: 0 };
    result = score(CATEGORY.FullHouse, dice(6, 6, 6, 6, 6), scores2, "bbg");
    assert.equal(result.baseScore, 25);
    assert.equal(result.yahtzeeBonus, 0); // No bonus since Yahtzee was 0
  });
});

// ── Legal actions ────────────────────────────────────────────────────────────

describe("legal actions", () => {
  it("respects turn phase", () => {
    // Start of turn: only roll action
    const start = legalActions([], 0, {}, 0, "hasbro");
    assert.equal(start.length, 1);
    assert.deepEqual(start[0], { type: "roll", holdMask: 0 });

    // Mid-turn (rolls=2): 32 roll masks + 13 score = 45 actions
    const mid = legalActions(dice(1, 2, 3, 4, 5), 2, {}, 0, "hasbro");
    const midRolls = mid.filter(a => a.type === "roll");
    const midScores = mid.filter(a => a.type === "score");
    assert.equal(midRolls.length, 32);
    assert.equal(midScores.length, 13);

    // Final roll (rolls=3): only score actions
    const finalTurn = legalActions(dice(1, 2, 3, 4, 5), 3, {}, 0, "hasbro");
    assert.ok(finalTurn.every(a => a.type === "score"));
  });
});

// ── Heuristic decision tests ────────────────────────────────────────────────

describe("heuristic agent", () => {
  it("scores obvious endgame (only chance open)", () => {
    const scores = filledExcept(CATEGORY.Chance);

    const action = selectAction(dice(1, 2, 3, 4, 6), 3, scores, 0, "hasbro");
    assert.deepEqual(action, { type: "score", category: CATEGORY.Chance });
  });

  it("prefers yahtzee when rolled", () => {
    const action = selectAction(dice(6, 6, 6, 6, 6), 3, {}, 0, "bbg");
    assert.equal(action.type, "score");
    assert.equal((action as { type: "score"; category: number }).category, CATEGORY.Yahtzee);
  });

  it("rerolls when dice are poor on first roll", () => {
    const action = selectAction(dice(1, 2, 3, 4, 6), 0, {}, 0, "bbg");
    assert.equal(action.type, "roll");
    assert.notEqual((action as { type: "roll"; holdMask: number }).holdMask, 31);
  });

  it("keeps strong scoring dice", () => {
    const action = selectAction(dice(1, 2, 3, 4, 5), 0, {}, 0, "bbg");
    if (action.type === "roll") {
      assert.notEqual(action.holdMask, 0);
    }
  });

  it("keeps high-value dice", () => {
    const action = selectAction(dice(5, 5, 6, 6, 6), 0, {}, 0, "bbg");
    if (action.type === "roll") {
      assert.notEqual(action.holdMask, 0);
    }
  });

  it("returns score action when no rolls remain", () => {
    const action = selectAction(dice(1, 2, 3, 4, 5), 3, {}, 0, "bbg");
    assert.equal(action.type, "score");
  });

  it("does not crash on any canonical state", { timeout: 30000 }, () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        for (let c = b; c <= 6; c++) {
          for (let d = c; d <= 6; d++) {
            for (let e = d; e <= 6; e++) {
              for (const rolls of [0, 1, 2, 3]) {
                const darr = [a, b, c, d, e];
                const action = selectAction(darr, rolls, {}, 0, "bbg");
                assert.ok(action, `no action for [${darr}] rolls=${rolls}`);
                if (rolls === 3) {
                  assert.equal(action.type, "score");
                }
              }
            }
          }
        }
      }
    }
  });

  it("produces consistent results for same state", () => {
    const d = dice(3, 3, 4, 5, 6);
    const scores: Record<number, number> = {
      [CATEGORY.Ones]: 2,
      [CATEGORY.Threes]: 9,
      [CATEGORY.Chance]: 22,
    };

    const a1 = selectAction(d, 1, scores, 0, "bbg");
    const a2 = selectAction(d, 1, scores, 0, "bbg");
    assert.deepEqual(a1, a2);
  });
});

// ── Dice helpers ─────────────────────────────────────────────────────────────

describe("dice handling", () => {
  it("input order does not affect scoring", () => {
    const r1 = score(CATEGORY.Chance, [6, 5, 4, 3, 2]);
    const r2 = score(CATEGORY.Chance, [2, 3, 4, 5, 6]);
    assert.equal(r1.baseScore, r2.baseScore);
    assert.equal(r1.baseScore, 20);
  });
});

// ── Error cases ──────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws on complete sheet", () => {
    const scores: Record<number, number> = {};
    for (let c = 0; c < 13; c++) scores[c] = 0;

    assert.throws(() => selectAction(dice(1, 2, 3, 4, 5), 3, scores, 0, "bbg"));
  });
});
