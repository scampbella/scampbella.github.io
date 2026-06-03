// ============================================================
//  Yahtzee — Dice Class
// ============================================================

class Dice {
    dice: DieState[];

    constructor() {
        this.dice = this.freshSet();
    }

    private freshSet(): DieState[] {
        return [1, 2, 3, 4, 5].map(() => ({ value: 1, locked: false }));
    }

    private randomValue(): number {
        return Math.floor(Math.random() * 6) + 1;
    }

    roll(): void {
        for (const die of this.dice) {
            if (die.locked) continue;
            die.value = this.randomValue();
        }
    }

    toggleLock(index: number): void {
        if (index < 0 || index >= this.dice.length) return;
        this.dice[index].locked = !this.dice[index].locked;
    }

    setLock(index: number, locked: boolean): void {
        if (index < 0 || index >= this.dice.length) return;
        this.dice[index].locked = locked;
    }

    unlockAll(): void {
        for (const die of this.dice) die.locked = false;
    }

    lockAll(): void {
        for (const die of this.dice) die.locked = true;
    }

    values(): number[] {
        return this.dice.map(d => d.value);
    }

    reset(): void {
        this.dice = this.freshSet();
    }

    resetValues(): void {
        for (const die of this.dice) {
            die.value = 1;
        }
    }

    snapshot(): DieState[] {
        return this.dice.map(d => ({ ...d }));
    }
}
