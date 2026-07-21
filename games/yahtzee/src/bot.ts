const KeiriBot = (() => {
    const DICE_COUNT = 5;
    const YAHTZEE_BONUS = 100;
    const UPPER_BONUS = 35;
    const UPPER_BONUS_THRESHOLD = 63;

    const CATEGORY = {
        Ones: 0, Twos: 1, Threes: 2, Fours: 3, Fives: 4, Sixes: 5,
        ThreeKind: 6, FourKind: 7, FullHouse: 8,
        SmallStraight: 9, LargeStraight: 10, Yahtzee: 11, Chance: 12,
    } as const;
    type Category = (typeof CATEGORY)[keyof typeof CATEGORY];

    const ALL_CATEGORIES: Category[] = [0,1,2,3,4,5,6,7,8,9,10,11,12];
    const UPPER_CATEGORIES: Category[] = [0,1,2,3,4,5];

    function upperFace(cat: Category): number | null { return cat <= 5 ? cat + 1 : null; }
    function upperForFace(face: number): Category | null { return face >= 1 && face <= 6 ? (face - 1) as Category : null; }

    function maxBaseScore(cat: Category): number {
        switch (cat) {
            case CATEGORY.Ones: return 5;
            case CATEGORY.Twos: return 10;
            case CATEGORY.Threes: return 15;
            case CATEGORY.Fours: return 20;
            case CATEGORY.Fives: return 25;
            case CATEGORY.Sixes: return 30;
            case CATEGORY.ThreeKind: case CATEGORY.FourKind: case CATEGORY.Chance: return 30;
            case CATEGORY.FullHouse: return 25;
            case CATEGORY.SmallStraight: return 30;
            case CATEGORY.LargeStraight: return 40;
            case CATEGORY.Yahtzee: return 50;
        }
    }

    function isUpper(cat: Category): boolean { return cat <= 5; }

    // ── Dice helpers ──
    function sortDice(dice: number[]): number[] { return [...dice].sort((a, b) => a - b); }

    // ── Dice counts and sum ──
    function diceCounts(dice: number[]): number[] {
        const counts = new Array(7).fill(0);
        for (const v of dice) counts[v] += 1;
        return counts;
    }
    function diceSum(dice: number[]): number { return dice.reduce((s, v) => s + v, 0); }
    function isBotYahtzee(dice: number[]): boolean { return dice.length === DICE_COUNT && dice[0] === dice[DICE_COUNT - 1]; }
    function yahtzeeFace(dice: number[]): number | null { return isBotYahtzee(dice) ? dice[0] : null; }

    // ── Score sheet helpers ──
    function isFilled(filledScores: Record<number, number>, cat: Category): boolean { return cat in filledScores; }
    function remainingCategories(filledScores: Record<number, number>): Category[] { return ALL_CATEGORIES.filter(c => !isFilled(filledScores, c)); }
    function upperSubtotal(filledScores: Record<number, number>): number { return UPPER_CATEGORIES.reduce((sum: number, c) => sum + (filledScores[c] ?? 0), 0); }
    function yahtzeeScored50(filledScores: Record<number, number>): boolean { return filledScores[CATEGORY.Yahtzee] === 50; }

    // ── Scoring ──
    type Ruleset = "hasbro" | "bbg";

    function jokerActive(_ruleset: Ruleset, dice: number[], filledScores: Record<number, number>): boolean {
        if (!isBotYahtzee(dice)) return false;
        const face = yahtzeeFace(dice);
        if (face === null) return false;
        const matching = upperForFace(face);
        if (matching === null) return false;
        // BBG: free-choice Joker — Yahtzee + matching upper both filled
        return isFilled(filledScores, CATEGORY.Yahtzee) && isFilled(filledScores, matching);
    }

    function earnsYahtzeeBonus(dice: number[], filledScores: Record<number, number>): boolean {
        return isBotYahtzee(dice) && yahtzeeScored50(filledScores);
    }

    function baseScore(cat: Category, dice: number[], joker: boolean): number {
        const counts = diceCounts(dice);
        if (joker) {
            if (cat === CATEGORY.FullHouse) return 25;
            if (cat === CATEGORY.SmallStraight) return 30;
            if (cat === CATEGORY.LargeStraight) return 40;
        }
        switch (cat) {
            case CATEGORY.Ones: case CATEGORY.Twos: case CATEGORY.Threes:
            case CATEGORY.Fours: case CATEGORY.Fives: case CATEGORY.Sixes: {
                const face = upperFace(cat)!;
                return counts[face] * face;
            }
            case CATEGORY.ThreeKind: return counts.some(c => c >= 3) ? diceSum(dice) : 0;
            case CATEGORY.FourKind: return counts.some(c => c >= 4) ? diceSum(dice) : 0;
            case CATEGORY.FullHouse: return counts.includes(3) && counts.includes(2) ? 25 : 0;
            case CATEGORY.SmallStraight: return (
                (counts[1] > 0 && counts[2] > 0 && counts[3] > 0 && counts[4] > 0) ||
                (counts[2] > 0 && counts[3] > 0 && counts[4] > 0 && counts[5] > 0) ||
                (counts[3] > 0 && counts[4] > 0 && counts[5] > 0 && counts[6] > 0)
            ) ? 30 : 0;
            case CATEGORY.LargeStraight: return (
                counts.slice(1, 6).every(c => c === 1) || counts.slice(2, 7).every(c => c === 1)
            ) ? 40 : 0;
            case CATEGORY.Yahtzee: return isBotYahtzee(dice) ? 50 : 0;
            case CATEGORY.Chance: return diceSum(dice);
            default: return 0;
        }
    }

    interface ScoreResult { baseScore: number; yahtzeeBonus: number; upperBonus: number; totalDelta: number; }

    function scoreRoll(ruleset: Ruleset, cat: Category, dice: number[], filledScores: Record<number, number>): ScoreResult {
        const yBonus = earnsYahtzeeBonus(dice, filledScores) ? YAHTZEE_BONUS : 0;
        const joker = jokerActive(ruleset, dice, filledScores);
        const bs = baseScore(cat, dice, joker);
        const upperBefore = upperSubtotal(filledScores);
        const uBonus = (isUpper(cat) && upperBefore < UPPER_BONUS_THRESHOLD && upperBefore + bs >= UPPER_BONUS_THRESHOLD) ? UPPER_BONUS : 0;
        return { baseScore: bs, yahtzeeBonus: yBonus, upperBonus: uBonus, totalDelta: bs + yBonus + uBonus };
    }

    // ── Legal score categories (BBG only) ──
    // BBG Joker forced placement: a Yahtzee rolled after the Yahtzee box is
    // filled must be scored in the matching upper box while that box is open.
    function forcedScoreCategory(dice: number[], filledScores: Record<number, number>): Category | null {
        if (!isBotYahtzee(dice)) return null;
        if (!isFilled(filledScores, CATEGORY.Yahtzee)) return null;
        const face = yahtzeeFace(dice);
        if (face === null) return null;
        const matching = upperForFace(face);
        if (matching === null) return null;
        if (isFilled(filledScores, matching)) return null;
        return matching;
    }
    function legalScoreCategories(_ruleset: Ruleset, dice: number[], filledScores: Record<number, number>): Category[] {
        const forced = forcedScoreCategory(dice, filledScores);
        if (forced !== null) return [forced];
        return remainingCategories(filledScores);
    }

    // ── Reroll distributions ──
    type Distribution = [number[], number][];
    function factorial(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
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
                    for (let v = 1; v <= 6; v++) for (let k = 0; k < counts[v]; k++) faces.push(v);
                    output.push([faces, multinomialWeight(diceCount, counts)]);
                }
                return;
            }
            for (let c = 0; c <= remaining; c++) { counts[face] = c; walk(face + 1, remaining - c); }
            counts[face] = 0;
        }
        walk(1, diceCount);
        return output;
    }
    const DISTRIBUTIONS: Distribution[] = [];
    for (let n = 0; n <= DICE_COUNT; n++) DISTRIBUTIONS.push(distributionForCount(n));

    // ── Hold mask generation ──
    function pushUnique(masks: number[], mask: number): void { if (!masks.includes(mask)) masks.push(mask); }
    function maskForFaces(dice: number[], faces: number[]): number {
        let mask = 0;
        for (let i = 0; i < dice.length; i++) if (faces.includes(dice[i])) mask |= 1 << i;
        return mask;
    }
    function maskForOneEach(dice: number[], faces: number[]): number {
        const used = new Set<number>();
        let mask = 0;
        for (let i = 0; i < dice.length; i++) {
            if (faces.includes(dice[i]) && !used.has(dice[i])) { used.add(dice[i]); mask |= 1 << i; }
        }
        return mask;
    }
    function candidateHoldMasks(dice: number[]): number[] {
        const masks = [0, (1 << DICE_COUNT) - 1];
        for (let face = 1; face <= 6; face++) pushUnique(masks, maskForFaces(dice, [face]));
        const runs: number[][] = [[1,2,3,4],[2,3,4,5],[3,4,5,6],[1,2,3,4,5],[2,3,4,5,6]];
        for (const run of runs) pushUnique(masks, maskForOneEach(dice, run));
        let highMask = 0;
        for (let i = 0; i < dice.length; i++) if (dice[i] >= 5) highMask |= 1 << i;
        pushUnique(masks, highMask);
        for (let i = 0; i < DICE_COUNT; i++) pushUnique(masks, 1 << i);
        return masks;
    }

    // ── Dice pattern bonus ──
    function dicePatternBonus(dice: number[]): number {
        const counts = new Array(7).fill(0);
        for (const v of dice) counts[v] += 1;
        let bonus = 0;
        for (let i = 1; i <= 6; i++) { switch (counts[i]) { case 2: bonus += 2; break; case 3: bonus += 6; break; case 4: bonus += 10; break; case 5: bonus += 15; break; } }
        const unique: number[] = []; let last = 0;
        for (const v of [...dice].sort((a, b) => a - b)) { if (v !== last) { unique.push(v); last = v; } }
        let consec = 1;
        for (let i = 1; i < unique.length; i++) {
            if (unique[i] === unique[i-1] + 1) { consec++; if (consec === 4) bonus += 6; if (consec === 5) bonus += 12; }
            else consec = 1;
        }
        return bonus;
    }

    // ── Heuristic evaluator ──
    type BotAction = { type: "roll"; holdMask: number } | { type: "score"; category: number };
    type InternalAction = { kind: "roll"; holdMask: number } | { kind: "score"; category: Category };

    function scoreUtility(ruleset: Ruleset, dice: number[], cat: Category, filledScores: Record<number, number>): number {
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
                const upperFilled = Object.keys(filledScores).length;
                const upperRemaining = 13 - upperFilled;
                const timeRatio = 1 - upperRemaining / 12;
                const subtotalAfter = upperSubtotal(filledScores) + base;
                let maxRemaining = 0;
                for (const u of UPPER_CATEGORIES) { if (u !== cat && !isFilled(filledScores, u)) maxRemaining += maxBaseScore(u); }
                const stillPossible = subtotalAfter + maxRemaining >= UPPER_BONUS_THRESHOLD;
                if (stillPossible) {
                    const slots = Math.max(1, UPPER_CATEGORIES.filter(u => u !== cat && !isFilled(filledScores, u)).length);
                    const bonusPerSlot = UPPER_BONUS * (0.25 + 0.4 * timeRatio) / slots;
                    utility += bonusPerSlot;
                } else {
                    utility -= UPPER_BONUS * (0.1 + 0.25 * timeRatio);
                }
            }
        }
        const remainingF = remainingCategories(filledScores).length;
        const timePressure = 1 - remainingF / 13;
        if (result.baseScore === 0) {
            utility -= (() => { switch (cat) {
                case CATEGORY.Yahtzee: return 45 * (1 + timePressure * 0.3);
                case CATEGORY.LargeStraight: return 18 * (1 + timePressure);
                case CATEGORY.SmallStraight: return 10 * (1 + timePressure);
                case CATEGORY.FullHouse: return 16;
                case CATEGORY.FourKind: return 10;
                case CATEGORY.ThreeKind: return 8;
                case CATEGORY.Chance: return 35;
                default: return 2;
            }})();
        } else {
            utility += (() => { switch (cat) {
                case CATEGORY.Yahtzee: return 18 + 12 * timePressure;
                case CATEGORY.LargeStraight: return 12 + 4 * timePressure;
                case CATEGORY.SmallStraight: return 12 + 4 * timePressure;
                case CATEGORY.FullHouse: return 8 + 2 * timePressure;
                case CATEGORY.FourKind: return (result.baseScore - 18) * 0.5;
                case CATEGORY.ThreeKind: return (result.baseScore - 15) * 0.25;
                case CATEGORY.Chance: return (result.baseScore - 22) * 0.7;
                default: return 0;
            }})();
        }
        return utility;
    }

    function bestScoreValue(ruleset: Ruleset, dice: number[], filledScores: Record<number, number>, cache?: Map<string, number>): number {
        const key = dice.join(",");
        if (cache?.has(key)) return cache.get(key)!;
        const legal = legalScoreCategories(ruleset, dice, filledScores);
        let best: number = -Infinity;
        if (legal.length > 0) {
            const scores = legal.map(c => scoreUtility(ruleset, dice, c, filledScores));
            best = Math.max(...scores);
        }
        if (cache) cache.set(key, best);
        return best;
    }

    function holdUtility(ruleset: Ruleset, dice: number[], holdMask: number, rollsUsed: number, filledScores: Record<number, number>, cache: Map<string, number>): number {
        const kept: number[] = [];
        for (let i = 0; i < dice.length; i++) if (holdMask & (1 << i)) kept.push(dice[i]);
        const rerollCount = DICE_COUNT - kept.length;
        const denominator = 6 ** rerollCount;
        const dist = DISTRIBUTIONS[rerollCount];
        let total = 0;
        for (const [rolled, weight] of dist) {
            const nextDice = sortDice([...kept, ...rolled]);
            const baseScore = bestScoreValue(ruleset, nextDice, filledScores, cache);
            const patternScore = dicePatternBonus(nextDice) * 0.25;
            total += (baseScore + patternScore) * weight;
        }
        return total / denominator;
    }

    function actionValue(ruleset: Ruleset, action: InternalAction, dice: number[], rollsUsed: number, filledScores: Record<number, number>, cache: Map<string, number>): number {
        if (action.kind === "score") return scoreUtility(ruleset, dice, action.category, filledScores);
        return holdUtility(ruleset, dice, action.holdMask, rollsUsed, filledScores, cache);
    }

    function buildCandidateActions(ruleset: Ruleset, dice: number[], rollsUsed: number, filledScores: Record<number, number>): InternalAction[] {
        const actions: InternalAction[] = [];
        if (dice.length === 0) { actions.push({ kind: "roll", holdMask: 0 }); return actions; }
        for (const cat of legalScoreCategories(ruleset, dice, filledScores)) actions.push({ kind: "score", category: cat });
        if (rollsUsed < 3) { for (const mask of candidateHoldMasks(dice)) actions.push({ kind: "roll", holdMask: mask }); }
        return actions;
    }

    function selectAction(dice: number[], rollsUsed: number, filledScores: Record<number, number>, yahtzeeBonuses: number = 0, ruleset: Ruleset = "bbg"): BotAction {
        const sorted = dice.length > 0 ? sortDice(dice) : [];
        const scores = { ...filledScores };
        if (yahtzeeBonuses > 0 && !(CATEGORY.Yahtzee in scores)) scores[CATEGORY.Yahtzee] = 50;
        const candidates = buildCandidateActions(ruleset, sorted, rollsUsed, scores);
        if (candidates.length === 0) throw new Error("No legal actions available — game is complete");
        const cache = new Map<string, number>();
        let best = candidates[0];
        let bestValue = -Infinity;
        for (const action of candidates) {
            const value = actionValue(ruleset, action, sorted, rollsUsed, scores, cache);
            if (value > bestValue) { bestValue = value; best = action; }
        }
        if (best.kind === "score") return { type: "score", category: (best as { kind: "score"; category: Category }).category };
        return { type: "roll", holdMask: best.holdMask };
    }

    return { selectAction, CATEGORY };
})();
