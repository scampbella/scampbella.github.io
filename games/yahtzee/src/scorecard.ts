// ============================================================
//  Yahtzee — Scorecard Class
// ============================================================

class Scorecard {
    slots: ScoreSlot[];
    private yahtzeeCategoryIndex: number;
    bonusYahtzees: number;

    constructor() {
        this.slots = CATEGORIES.map(def => ({ def, score: null }));
        this.yahtzeeCategoryIndex = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        this.bonusYahtzees = 0;
    }

    canScore(index: number): boolean {
        return index >= 0 && index < this.slots.length && this.slots[index].score === null;
    }

    // BBG Joker forced placement: when a Yahtzee is rolled after the Yahtzee box
    // is already filled (any score, including 0), and the matching upper box is
    // still open, it MUST be scored in that upper box. Returns that upper index,
    // or null when the player has a free choice.
    forcedCategoryIndex(dice: number[]): number | null {
        if (!isYahtzee(dice)) return null;
        if (this.slots[this.yahtzeeCategoryIndex].score === null) return null;
        const upperIdx = dice[0] - 1;
        if (upperIdx < 0 || upperIdx > 5) return null;
        if (this.slots[upperIdx].score !== null) return null;
        return upperIdx;
    }

    scoreCategory(index: number, dice: number[]): number {
        if (!this.canScore(index)) return 0;

        let score = this.slots[index].def.scoreFn(dice);

        // Joker rule scoring: subsequent Yahtzee and main Yahtzee box is filled (any score)
        // AND the corresponding upper box is filled
        if (isYahtzee(dice) && this.slots[this.yahtzeeCategoryIndex].score !== null) {
            const upperIdx = dice[0] - 1;
            if (this.slots[upperIdx].score !== null) {
                const name = this.slots[index].def.name;
                if (name === 'Full House') {
                    score = 25;
                } else if (name === 'Sm Straight') {
                    score = 30;
                } else if (name === 'Lg Straight') {
                    score = 40;
                }
            }
        }

        // Yahtzee bonus: main Yahtzee box must be filled with 50 (not 0)
        if (isYahtzee(dice) && this.slots[this.yahtzeeCategoryIndex].score === 50) {
            this.bonusYahtzees++;
        }

        this.slots[index].score = score;
        return score;
    }

    upperTotal(): number {
        return this.slots
            .filter(s => s.def.section === Section.Upper && s.score !== null)
            .reduce((sum, s) => sum + s.score!, 0);
    }

    upperBonus(): number {
        return this.upperTotal() >= 63 ? 35 : 0;
    }

    lowerTotal(): number {
        const slotsTotal = this.slots
            .filter(s => s.def.section === Section.Lower && s.score !== null)
            .reduce((sum, s) => sum + s.score!, 0);
        return slotsTotal + (this.bonusYahtzees * 100);
    }

    grandTotal(): number {
        return this.upperTotal() + this.upperBonus() + this.lowerTotal();
    }

    isComplete(): boolean {
        return this.slots.every(s => s.score !== null);
    }

    reset(): void {
        this.slots.forEach(s => s.score = null);
        this.bonusYahtzees = 0;
    }

    snapshot(): ScoreSlot[] {
        return this.slots.map(s => ({
            def: s.def,
            score: s.score,
        }));
    }
}
