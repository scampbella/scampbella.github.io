// Keiri Heuristic Bot — TypeScript port of the Rust HeuristicAgent.
// Zero dependencies. Single-file module for static-site Yahtzee bots.
//
// Usage:
//   import { selectAction } from "./bot/index.ts";
//   const action = selectAction(dice, rollsUsed, filledScores, yahtzeeBonuses, "bbg");
//
// dice:        number[] — 5 dice values (1-6), sorted. Empty array if not yet rolled.
// rollsUsed:   number   — rolls already used this turn (0-2).
// filledScores: Record<number, number> — category index (0-12) → score.
// yahtzeeBonuses: number — how many 100-point Yahtzee bonuses earned.
// ruleset:     "hasbro" | "bbg" — defaults to "bbg".
//
// Returns:
//   { type: "roll"; holdMask: number }  — 5-bit mask (bit i=1 → keep die i).
//   { type: "score"; category: number } — category index 0-12 to score in.

// ── Constants ────────────────────────────────────────────────────────────────

const DICE_COUNT = 5;
const YAHTZEE_BONUS = 100;
const UPPER_BONUS = 35;
const UPPER_BONUS_THRESHOLD = 63;

// Category indices (matching Rust ordering).
const CATEGORY = {
  Ones: 0,
  Twos: 1,
  Threes: 2,
  Fours: 3,
  Fives: 4,
  Sixes: 5,
  ThreeKind: 6,
  FourKind: 7,
  FullHouse: 8,
  SmallStraight: 9,
  LargeStraight: 10,
  Yahtzee: 11,
  Chance: 12,
} as const;

type Category = (typeof CATEGORY)[keyof typeof CATEGORY];

const ALL_CATEGORIES: Category[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const UPPER_CATEGORIES: Category[] = [0, 1, 2, 3, 4, 5];
const LOWER_CATEGORIES: Category[] = [6, 7, 8, 9, 10, 11, 12];

const CATEGORY_NAME: Record<Category, string> = {
  0: "ones", 1: "twos", 2: "threes", 3: "fours", 4: "fives", 5: "sixes",
  6: "three-kind", 7: "four-kind", 8: "full-house", 9: "small-straight",
  10: "large-straight", 11: "yahtzee", 12: "chance",
};

function upperFace(cat: Category): number | null {
  return cat <= 5 ? cat + 1 : null;
}

function upperForFace(face: number): Category | null {
  return face >= 1 && face <= 6 ? (face - 1) as Category : null;
}

function maxBaseScore(cat: Category): number {
  switch (cat) {
    case CATEGORY.Ones: return 5;
    case CATEGORY.Twos: return 10;
    case CATEGORY.Threes: return 15;
    case CATEGORY.Fours: return 20;
    case CATEGORY.Fives: return 25;
    case CATEGORY.Sixes: return 30;
    case CATEGORY.ThreeKind:
    case CATEGORY.FourKind:
    case CATEGORY.Chance: return 30;
    case CATEGORY.FullHouse: return 25;
    case CATEGORY.SmallStraight: return 30;
    case CATEGORY.LargeStraight: return 40;
    case CATEGORY.Yahtzee: return 50;
  }
}

function isUpper(cat: Category): boolean {
  return cat <= 5;
}

// ── Dice helpers ─────────────────────────────────────────────────────────────

function sortDice(dice: number[]): number[] {
  return [...dice].sort((a, b) => a - b);
}

function diceCounts(dice: number[]): number[] {
  const counts = new Array(7).fill(0);
  for (const v of dice) counts[v] += 1;
  return counts;
}

function diceSum(dice: number[]): number {
  return dice.reduce((s, v) => s + v, 0);
}

function isYahtzee(dice: number[]): boolean {
  return dice.length === DICE_COUNT && dice[0] === dice[DICE_COUNT - 1];
}

function yahtzeeFace(dice: number[]): number | null {
  return isYahtzee(dice) ? dice[0] : null;
}

// ── Score sheet helpers ──────────────────────────────────────────────────────

function isFilled(filledScores: Record<number, number>, cat: Category): boolean {
  return cat in filledScores;
}

function remainingCategories(filledScores: Record<number, number>): Category[] {
  return ALL_CATEGORIES.filter(c => !isFilled(filledScores, c));
}

function filledCount(filledScores: Record<number, number>): number {
  return Object.keys(filledScores).length;
}

function upperSubtotal(filledScores: Record<number, number>): number {
  return UPPER_CATEGORIES.reduce((sum, c) => sum + (filledScores[c] ?? 0), 0);
}

function hasUpperBonus(filledScores: Record<number, number>): boolean {
  return upperSubtotal(filledScores) >= UPPER_BONUS_THRESHOLD;
}

function yahtzeeScored50(filledScores: Record<number, number>): boolean {
  return filledScores[CATEGORY.Yahtzee] === 50;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

type Ruleset = "hasbro" | "bbg";

function jokerActive(ruleset: Ruleset, dice: number[], filledScores: Record<number, number>): boolean {
  if (!isYahtzee(dice)) return false;
  const face = yahtzeeFace(dice);
  if (face === null) return false;
  const matching = upperForFace(face);
  if (matching === null) return false;

  if (ruleset === "hasbro") {
    return yahtzeeScored50(filledScores) && isFilled(filledScores, matching);
  }
  // BBG: free-choice Joker — Yahtzee + matching upper both filled
  return isFilled(filledScores, CATEGORY.Yahtzee) && isFilled(filledScores, matching);
}

function forcedJokerActive(ruleset: Ruleset, dice: number[], filledScores: Record<number, number>): boolean {
  // Only Hasbro has forced Joker behavior
  return ruleset === "hasbro" && isYahtzee(dice) && yahtzeeScored50(filledScores);
}

function earnsYahtzeeBonus(dice: number[], filledScores: Record<number, number>): boolean {
  return isYahtzee(dice) && yahtzeeScored50(filledScores);
}

function baseScore(cat: Category, dice: number[], joker: boolean): number {
  const counts = diceCounts(dice);

  if (joker) {
    // Under Joker, fixed-score categories always score their full value
    if (cat === CATEGORY.FullHouse) return 25;
    if (cat === CATEGORY.SmallStraight) return 30;
    if (cat === CATEGORY.LargeStraight) return 40;
  }

  switch (cat) {
    case CATEGORY.Ones:
    case CATEGORY.Twos:
    case CATEGORY.Threes:
    case CATEGORY.Fours:
    case CATEGORY.Fives:
    case CATEGORY.Sixes: {
      const face = upperFace(cat)!;
      return counts[face] * face;
    }
    case CATEGORY.ThreeKind:
      return counts.some(c => c >= 3) ? diceSum(dice) : 0;
    case CATEGORY.FourKind:
      return counts.some(c => c >= 4) ? diceSum(dice) : 0;
    case CATEGORY.FullHouse:
      return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case CATEGORY.SmallStraight:
      return (
        (counts[1] > 0 && counts[2] > 0 && counts[3] > 0 && counts[4] > 0) ||
        (counts[2] > 0 && counts[3] > 0 && counts[4] > 0 && counts[5] > 0) ||
        (counts[3] > 0 && counts[4] > 0 && counts[5] > 0 && counts[6] > 0)
      ) ? 30 : 0;
    case CATEGORY.LargeStraight:
      return (
        counts.slice(1, 6).every(c => c === 1) ||
        counts.slice(2, 7).every(c => c === 1)
      ) ? 40 : 0;
    case CATEGORY.Yahtzee:
      return isYahtzee(dice) ? 50 : 0;
    case CATEGORY.Chance:
      return diceSum(dice);
    default:
      return 0;
  }
}

interface ScoreResult {
  baseScore: number;
  yahtzeeBonus: number;
  upperBonus: number;
  totalDelta: number;
}

function scoreRoll(
  ruleset: Ruleset,
  cat: Category,
  dice: number[],
  filledScores: Record<number, number>,
): ScoreResult {
  const yBonus = earnsYahtzeeBonus(dice, filledScores) ? YAHTZEE_BONUS : 0;
  const joker = jokerActive(ruleset, dice, filledScores);
  const bs = baseScore(cat, dice, joker);
  const upperBefore = upperSubtotal(filledScores);
  const uBonus = (
    isUpper(cat) &&
    upperBefore < UPPER_BONUS_THRESHOLD &&
    upperBefore + bs >= UPPER_BONUS_THRESHOLD
  ) ? UPPER_BONUS : 0;

  return {
    baseScore: bs,
    yahtzeeBonus: yBonus,
    upperBonus: uBonus,
    totalDelta: bs + yBonus + uBonus,
  };
}

// ── Legal actions ────────────────────────────────────────────────────────────

function legalScoreCategories(
  ruleset: Ruleset,
  dice: number[],
  filledScores: Record<number, number>,
): Category[] {
  if (ruleset === "bbg") {
    return remainingCategories(filledScores);
  }

  // Hasbro: forced Joker restricts scoring
  if (!forcedJokerActive(ruleset, dice, filledScores)) {
    return remainingCategories(filledScores);
  }

  const face = yahtzeeFace(dice)!;
  const matching = upperForFace(face)!;
  if (!isFilled(filledScores, matching)) {
    return [matching];
  }

  const lowerOpen = LOWER_CATEGORIES.filter(c => !isFilled(filledScores, c));
  if (lowerOpen.length > 0) return lowerOpen;

  return UPPER_CATEGORIES.filter(c => !isFilled(filledScores, c));
}

// ── Reroll distributions ─────────────────────────────────────────────────────

// Precomputed: for each reroll count (0-5), list of (sorted_faces[], weight).
// Weight = number of ordered outcomes that produce that multiset.
type Distribution = [number[], number][]; // [faces, weight][]

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function multinomialWeight(total: number, counts: number[]): number {
  let denom = 1;
  for (let i = 1; i <= 6; i++) denom *= factorial(counts[i]);
  return factorial(total) / denom;
}

function distributionForCount(diceCount: number): Distribution {
  const output: Distribution = [];
  const counts = new Array(7).fill(0);

  function walk(face: number, remaining: number): void {
    if (face === 7) {
      if (remaining === 0) {
        const faces: number[] = [];
        for (let v = 1; v <= 6; v++) {
          for (let k = 0; k < counts[v]; k++) faces.push(v);
        }
        output.push([faces, multinomialWeight(diceCount, counts)]);
      }
      return;
    }
    for (let c = 0; c <= remaining; c++) {
      counts[face] = c;
      walk(face + 1, remaining - c);
    }
    counts[face] = 0;
  }

  walk(1, diceCount);
  return output;
}

// Precompute once at module load.
const DISTRIBUTIONS: Distribution[] = [];
for (let n = 0; n <= DICE_COUNT; n++) {
  DISTRIBUTIONS.push(distributionForCount(n));
}

// ── Hold mask generation ─────────────────────────────────────────────────────

function pushUnique(masks: number[], mask: number): void {
  if (!masks.includes(mask)) masks.push(mask);
}

function maskForFaces(dice: number[], faces: number[]): number {
  let mask = 0;
  for (let i = 0; i < dice.length; i++) {
    if (faces.includes(dice[i])) mask |= 1 << i;
  }
  return mask;
}

function maskForOneEach(dice: number[], faces: number[]): number {
  const used = new Set<number>();
  let mask = 0;
  for (let i = 0; i < dice.length; i++) {
    if (faces.includes(dice[i]) && !used.has(dice[i])) {
      used.add(dice[i]);
      mask |= 1 << i;
    }
  }
  return mask;
}

function candidateHoldMasks(dice: number[]): number[] {
  const masks = [0, (1 << DICE_COUNT) - 1]; // reroll all, keep all

  for (let face = 1; face <= 6; face++) {
    pushUnique(masks, maskForFaces(dice, [face]));
  }

  // Straight runs
  const runs: number[][] = [
    [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6],
    [1, 2, 3, 4, 5], [2, 3, 4, 5, 6],
  ];
  for (const run of runs) {
    pushUnique(masks, maskForOneEach(dice, run));
  }

  // Keep high dice (face >= 5)
  let highMask = 0;
  for (let i = 0; i < dice.length; i++) {
    if (dice[i] >= 5) highMask |= 1 << i;
  }
  pushUnique(masks, highMask);

  // Keep single dice
  for (let i = 0; i < DICE_COUNT; i++) {
    pushUnique(masks, 1 << i);
  }

  return masks;
}

// ── Dice pattern bonus ───────────────────────────────────────────────────────

function dicePatternBonus(dice: number[]): number {
  const counts = new Array(7).fill(0);
  for (const v of dice) counts[v] += 1;

  let bonus = 0;
  for (let i = 1; i <= 6; i++) {
    switch (counts[i]) {
      case 2: bonus += 2; break;
      case 3: bonus += 6; break;
      case 4: bonus += 10; break;
      case 5: bonus += 15; break;
    }
  }

  // Straight detection on deduplicated sorted values
  const unique: number[] = [];
  let last = 0;
  for (const v of [...dice].sort((a, b) => a - b)) {
    if (v !== last) {
      unique.push(v);
      last = v;
    }
  }

  let consec = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === unique[i - 1] + 1) {
      consec++;
      if (consec === 4) bonus += 6;
      if (consec === 5) bonus += 12;
    } else {
      consec = 1;
    }
  }

  return bonus;
}

// ── Heuristic evaluator ──────────────────────────────────────────────────────

export type BotAction =
  | { type: "roll"; holdMask: number }
  | { type: "score"; category: number };

type InternalAction =
  | { kind: "roll"; holdMask: number }
  | { kind: "score"; category: Category };

function scoreUtility(
  ruleset: Ruleset,
  dice: number[],
  cat: Category,
  filledScores: Record<number, number>,
): number {
  const result = scoreRoll(ruleset, cat, dice, filledScores);
  let utility = result.totalDelta;

  if (isUpper(cat)) {
    const face = upperFace(cat)!;
    const base = result.baseScore;
    utility += base / face;

    if (upperSubtotal(filledScores) < UPPER_BONUS_THRESHOLD) {
      const target = face * 3;
      utility += (base - target) * 1.7;
      utility += (base / target) * 5.0;

      // Dynamic upper bonus utility
      const remCats = remainingCategories(filledScores);
      const upperFilled = filledCount(filledScores);
      const upperRemaining = 13 - upperFilled;
      const timeRatio = 1 - upperRemaining / 12;

      // Check if bonus is still possible
      const subtotalAfter = upperSubtotal(filledScores) + base;
      let maxRemaining = 0;
      for (const u of UPPER_CATEGORIES) {
        if (u !== cat && !isFilled(filledScores, u)) {
          maxRemaining += maxBaseScore(u);
        }
      }
      const stillPossible = subtotalAfter + maxRemaining >= UPPER_BONUS_THRESHOLD;

      if (stillPossible) {
        const slots = Math.max(1, UPPER_CATEGORIES.filter(
          u => u !== cat && !isFilled(filledScores, u),
        ).length);
        const bonusPerSlot = UPPER_BONUS * (0.25 + 0.4 * timeRatio) / slots;
        utility += bonusPerSlot;
      } else {
        utility -= UPPER_BONUS * (0.1 + 0.25 * timeRatio);
      }
    }
  }

  // Time-pressure weight
  const remCats = remainingCategories(filledScores);
  const remainingF = remCats.length;
  const timePressure = 1 - remainingF / 13;

  if (result.baseScore === 0) {
    utility -= (() => {
      switch (cat) {
        case CATEGORY.Yahtzee: return 45 * (1 + timePressure * 0.3);
        case CATEGORY.LargeStraight: return 18 * (1 + timePressure);
        case CATEGORY.SmallStraight: return 10 * (1 + timePressure);
        case CATEGORY.FullHouse: return 16;
        case CATEGORY.FourKind: return 10;
        case CATEGORY.ThreeKind: return 8;
        case CATEGORY.Chance: return 35;
        default: return 2;
      }
    })();
  } else {
    const catCry = (() => {
      switch (cat) {
        case CATEGORY.Yahtzee: return 18 + 12 * timePressure;
        case CATEGORY.LargeStraight: return 12 + 4 * timePressure;
        case CATEGORY.SmallStraight: return 12 + 4 * timePressure;
        case CATEGORY.FullHouse: return 8 + 2 * timePressure;
        case CATEGORY.FourKind: return (result.baseScore - 18) * 0.5;
        case CATEGORY.ThreeKind: return (result.baseScore - 15) * 0.25;
        case CATEGORY.Chance: return (result.baseScore - 22) * 0.7;
        default: return 0;
      }
    })();
    utility += catCry;
  }

  return utility;
}

function bestScoreValue(
  ruleset: Ruleset,
  dice: number[],
  filledScores: Record<number, number>,
  cache?: Map<string, number>,
): number {
  const key = dice.join(",");
  if (cache?.has(key)) return cache.get(key)!;

  const legal = legalScoreCategories(ruleset, dice, filledScores);
  let best = -Infinity;
  if (legal.length > 0) {
    best = Math.max(...legal.map(c => scoreUtility(ruleset, dice, c, filledScores)));
  }

  if (cache) cache.set(key, best);
  return best;
}
function holdUtility(
  ruleset: Ruleset,
  dice: number[],
  holdMask: number,
  rollsUsed: number,
  filledScores: Record<number, number>,
  cache: Map<string, number>,
): number {
  // Get kept dice
  const kept: number[] = [];
  for (let i = 0; i < dice.length; i++) {
    if (holdMask & (1 << i)) kept.push(dice[i]);
  }
  const rerollCount = DICE_COUNT - kept.length;
  const denominator = 6 ** rerollCount;

  const dist = DISTRIBUTIONS[rerollCount];
  let total = 0;
  for (const [rolled, weight] of dist) {
    const nextDice = sortDice([...kept, ...rolled]);
    const nextRolls = rollsUsed + 1;

    const baseScore = bestScoreValue(ruleset, nextDice, filledScores, cache);
    const patternScore = dicePatternBonus(nextDice) * 0.25;
    total += (baseScore + patternScore) * weight;
  }

  return total / denominator;
}

function actionValue(
  ruleset: Ruleset,
  action: InternalAction,
  dice: number[],
  rollsUsed: number,
  filledScores: Record<number, number>,
  cache: Map<string, number>,
): number {
  if (action.kind === "score") {
    return scoreUtility(ruleset, dice, action.category, filledScores);
  }
  return holdUtility(ruleset, dice, action.holdMask, rollsUsed, filledScores, cache);
}

function allLegalActions(
  ruleset: Ruleset,
  dice: number[],
  rollsUsed: number,
  filledScores: Record<number, number>,
): InternalAction[] {
  const actions: InternalAction[] = [];

  if (dice.length === 0) {
    actions.push({ kind: "roll", holdMask: 0 });
    return actions;
  }

  // Score actions
  for (const cat of legalScoreCategories(ruleset, dice, filledScores)) {
    actions.push({ kind: "score", category: cat });
  }

  // Roll actions: all 32 hold masks
  if (rollsUsed < 3) {
    for (let mask = 0; mask < 32; mask++) {
      actions.push({ kind: "roll", holdMask: mask });
    }
  }

  return actions;
}

function buildCandidateActions(
  ruleset: Ruleset,
  dice: number[],
  rollsUsed: number,
  filledScores: Record<number, number>,
): InternalAction[] {
  const actions: InternalAction[] = [];

  if (dice.length === 0) {
    actions.push({ kind: "roll", holdMask: 0 });
    return actions;
  }

  // Score actions
  for (const cat of legalScoreCategories(ruleset, dice, filledScores)) {
    actions.push({ kind: "score", category: cat });
  }

  // Roll actions (heuristic subset for performance)
  if (rollsUsed < 3) {
    for (const mask of candidateHoldMasks(dice)) {
      actions.push({ kind: "roll", holdMask: mask });
    }
  }
  return actions;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Select the best action for a game state using heuristic evaluation.
 *
 * @param dice - 5 dice values (1-6), sorted ascending. Empty [] if not yet rolled.
 * @param rollsUsed - Rolls already used this turn (0, 1, or 2).
 * @param filledScores - Map of category index (0-12) to recorded score.
 * @param yahtzeeBonuses - How many 100-point Yahtzee bonuses have been earned.
 *   (Only used to check if Yahtzee was scored as 50; bonuses >0 implies this.)
 * @param ruleset - "hasbro" (forced Joker) or "bbg" (free-choice Joker, default).
 * @returns The recommended action.
 */
export function selectAction(
  dice: number[],
  rollsUsed: number,
  filledScores: Record<number, number>,
  yahtzeeBonuses: number = 0,
  ruleset: Ruleset = "bbg",
): BotAction {
  // Normalize: ensure dice are sorted
  const sorted = dice.length > 0 ? sortDice(dice) : [];

  // If there are yahtzee bonuses, ensure Yahtzee is recorded as 50 for Joker logic
  const scores = { ...filledScores };
  if (yahtzeeBonuses > 0 && !(CATEGORY.Yahtzee in scores)) {
    // A Yahtzee bonus implies Yahtzee was scored as 50 at some point
    scores[CATEGORY.Yahtzee] = 50;
  }

  const candidates = buildCandidateActions(ruleset, sorted, rollsUsed, scores);
  if (candidates.length === 0) {
    // Terminal state — shouldn't happen, but return a no-op
    throw new Error("No legal actions available — game is complete");
  }
  const cache = new Map<string, number>();
  let best = candidates[0];
  let bestValue = -Infinity;
  for (const action of candidates) {
    const value = actionValue(ruleset, action, sorted, rollsUsed, scores, cache);
    if (value > bestValue) {
      bestValue = value;
      best = action;
    }
  }

  if (best.kind === "score") {
    return { type: "score", category: best.category };
  }
  return { type: "roll", holdMask: best.holdMask };
}

/**
 * Get all legal actions for a game state (for display/debugging).
 */
export function legalActions(
  dice: number[],
  rollsUsed: number,
  filledScores: Record<number, number>,
  yahtzeeBonuses: number = 0,
  ruleset: Ruleset = "bbg",
): BotAction[] {
  const sorted = dice.length > 0 ? sortDice(dice) : [];
  const scores = { ...filledScores };
  if (yahtzeeBonuses > 0 && !(CATEGORY.Yahtzee in scores)) {
    scores[CATEGORY.Yahtzee] = 50;
  }

  return allLegalActions(ruleset, sorted, rollsUsed, scores).map(a =>
    a.kind === "score"
      ? { type: "score", category: a.category }
      : { type: "roll", holdMask: a.holdMask },
  );
}

/**
 * Score a specific roll in a category (for display/debugging).
 */
export function score(
  category: number,
  dice: number[],
  filledScores: Record<number, number> = {},
  ruleset: Ruleset = "bbg",
): ScoreResult {
  const sorted = sortDice(dice);
  return scoreRoll(ruleset, category as Category, sorted, filledScores);
}

// Re-export constants for consumer convenience
export { CATEGORY, UPPER_CATEGORIES, LOWER_CATEGORIES, ALL_CATEGORIES, CATEGORY_NAME };
export type { Category, Ruleset, ScoreResult };

// ── PRNG (matches Rust Rng64) ───────────────────────────────────────────────

/** Deterministic PRNG matching the Rust `Rng64` implementation. */
export class Rng64 {
  private state: bigint;

  constructor(seed: number | bigint) {
    this.state = BigInt(seed) || 1n;
  }

  /** Next 64-bit pseudorandom value. */
  nextU64(): bigint {
    const MASK = 0xFFFFFFFFFFFFFFFFn;
    let x = this.state;
    x = (x ^ (x >> 12n)) & MASK;
    x = (x ^ ((x << 25n) & MASK)) & MASK;
    x = (x ^ (x >> 27n)) & MASK;
    this.state = x;
    return (x * 0x2545F4914F6CDD1Dn) & MASK;
  }
  /** Next die value (1-6). */
  nextDie(): number {
    return Number(this.nextU64() % 6n) + 1;
  }
}

// ── Game simulation ─────────────────────────────────────────────────────────

export interface SimulationReport {
  finalScore: number;
  seed: number;
  turnCount: number;
  upperBonus: boolean;
  yahtzeeBonusCount: number;
}

/** Play one full solitaire game using the heuristic bot. */
export function simulate(
  seed: number,
  ruleset: Ruleset = "bbg",
): SimulationReport {
  const rng = new Rng64(seed);
  let dice: number[] = [];
  let rollsUsed = 0;
  const filledScores: Record<number, number> = {};
  let yahtzeeBonuses = 0;
  let turnCount = 0;
  let hasUpperBonus = false;

  while (Object.keys(filledScores).length < 13) {
    turnCount++;

    // Roll phase
    rollsUsed = 0;
    dice = [];

    while (true) {
      const action = selectAction(dice, rollsUsed, filledScores, yahtzeeBonuses, ruleset);

      if (action.type === "roll") {
        // Keep held dice, roll the rest
        const kept: number[] = [];
        for (let i = 0; i < dice.length; i++) {
          if (action.holdMask & (1 << i)) kept.push(dice[i]);
        }
        const rerollCount = DICE_COUNT - kept.length;
        const rolled: number[] = [];
        for (let i = 0; i < rerollCount; i++) {
          rolled.push(rng.nextDie());
        }
        dice = sortDice([...kept, ...rolled]);
        rollsUsed++;
      } else {
        // Score action
        const result = scoreRoll(ruleset, action.category as Category, dice, filledScores);
        filledScores[action.category] = result.baseScore;
        if (result.yahtzeeBonus > 0) yahtzeeBonuses++;
        if (result.upperBonus > 0) hasUpperBonus = true;
        break;
      }
    }
  }

  // Compute final score
  let total = 0;
  for (const score of Object.values(filledScores)) total += score;
  if (hasUpperBonus) total += UPPER_BONUS;
  total += yahtzeeBonuses * YAHTZEE_BONUS;

  return {
    finalScore: total,
    seed,
    turnCount,
    upperBonus: hasUpperBonus,
    yahtzeeBonusCount: yahtzeeBonuses,
  };
}

export interface EvaluateResult {
  games: number;
  mean: number;
  min: number;
  max: number;
  p05: number;
  p50: number;
  p95: number;
  upperBonusRate: number;
  yahtzeeBonusRate: number;
}

/** Run N simulation games and return summary statistics. */
export function evaluate(
  games: number,
  seed: number = 1,
  ruleset: Ruleset = "bbg",
): EvaluateResult {
  const scores: number[] = [];
  let upperBonuses = 0;
  let yahtzeeBonuses = 0;

  for (let i = 0; i < games; i++) {
    const report = simulate(seed + i, ruleset);
    scores.push(report.finalScore);
    if (report.upperBonus) upperBonuses++;
    yahtzeeBonuses += report.yahtzeeBonusCount;
  }

  scores.sort((a, b) => a - b);

  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const min = scores[0];
  const max = scores[scores.length - 1];

  const pctl = (p: number) => {
    const idx = Math.ceil((p / 100) * scores.length) - 1;
    return scores[Math.max(0, idx)];
  };

  return {
    games,
    mean: Math.round(mean * 100) / 100,
    min,
    max,
    p05: pctl(5),
    p50: pctl(50),
    p95: pctl(95),
    upperBonusRate: Math.round((upperBonuses / games) * 10000) / 100,
    yahtzeeBonusRate: Math.round((yahtzeeBonuses / games) * 100) / 100,
  };
}
