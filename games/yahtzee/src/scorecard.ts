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

    scoreCategory(index: number, dice: number[]): number {
        if (!this.canScore(index)) return 0;

        let score = this.slots[index].def.scoreFn(dice);

        // Joker rule scoring: subsequent Yahtzee and main Yahtzee box is filled (any score)
        if (isYahtzee(dice) && this.slots[this.yahtzeeCategoryIndex].score !== null) {
            const name = this.slots[index].def.name;
            if (name === 'Full House') {
                score = 25;
            } else if (name === 'Sm Straight') {
                score = 30;
            } else if (name === 'Lg Straight') {
                score = 40;
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
        return this.slots
            .filter(s => s.def.section === Section.Lower && s.score !== null)
            .reduce((sum, s) => sum + s.score!, 0);
    }

    grandTotal(): number {
        return this.upperTotal() + this.upperBonus() + this.lowerTotal()
            + (this.bonusYahtzees * 100);
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
