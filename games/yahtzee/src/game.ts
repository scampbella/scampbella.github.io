// ============================================================
//  Yahtzee — Game Engine (single player)
// ============================================================

class Game {
    dice: Dice;
    scorecard: Scorecard;
    rollsLeft: number;
    round: number;
    gameOver: boolean;
    private onUpdate: (() => void) | null;

    constructor() {
        this.dice = new Dice();
        this.scorecard = new Scorecard();
        this.rollsLeft = 3;
        this.round = 1;
        this.gameOver = false;
        this.onUpdate = null;
    }

    setOnUpdate(cb: () => void): void {
        this.onUpdate = cb;
    }

    private notify(): void {
        if (this.onUpdate) this.onUpdate();
    }

    roll(): void {
        if (this.rollsLeft <= 0 || this.gameOver) return;
        this.dice.roll();
        this.rollsLeft--;
        this.notify();
    }

    toggleLock(index: number): void {
        if (this.rollsLeft === 3) return;
        this.dice.toggleLock(index);
        this.notify();
    }

    isValidCategorySelection(index: number, dice: number[]): boolean {
        if (!this.scorecard.canScore(index)) return false;
        // BBG: all remaining categories are always legal — no forced picks
        return true;
    }

    previewScore(index: number): number | null {
        if (this.rollsLeft === 3) return null;
        if (!this.scorecard.canScore(index)) return null;

        const dice = this.dice.values();
        if (!this.isValidCategorySelection(index, dice)) return null;

        // Joker rule preview
        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        const isMainYahtzeeFilled = this.scorecard.slots[yahtzeeIdx].score !== null;

        if (isYahtzee(dice) && isMainYahtzeeFilled) {
            const upperIdx = dice[0] - 1;
            if (this.scorecard.slots[upperIdx].score !== null) {
                const name = this.scorecard.slots[index].def.name;
                if (name === 'Full House') return 25;
                if (name === 'Sm Straight') return 30;
                if (name === 'Lg Straight') return 40;
            }
        }

        return this.scorecard.slots[index].def.scoreFn(dice);
    }

    selectCategory(index: number): boolean {
        if (this.rollsLeft === 3) return false;
        if (this.gameOver) return false;
        if (!this.isValidCategorySelection(index, this.dice.values())) return false;

        this.scorecard.scoreCategory(index, this.dice.values());

        if (this.scorecard.isComplete()) {
            this.gameOver = true;
            this.dice.lockAll();
            this.notify();
            return true;
        }

        this.round++;
        this.rollsLeft = 3;
        this.dice.unlockAll();
        this.dice.resetValues();
        this.notify();
        return true;
    }

    getSnapshot(): GameStateSnapshot {
        return {
            dice: this.dice.snapshot(),
            rollsLeft: this.rollsLeft,
            round: this.round,
            scorecard: this.scorecard.snapshot(),
            gameOver: this.gameOver,
            finalScore: this.scorecard.grandTotal(),
        };
    }

    reset(): void {
        this.dice.reset();
        this.scorecard.reset();
        this.rollsLeft = 3;
        this.round = 1;
        this.gameOver = false;
        this.notify();
    }
}
