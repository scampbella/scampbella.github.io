class VersusGame {
    dice: Dice;
    playerScorecard: Scorecard;
    botScorecard: Scorecard;
    rollsLeft: number;
    round: number;
    gameOver: boolean;
    isPlayerTurn: boolean;
    isBotThinking: boolean;
    pendingRollAnimation: boolean;
    onUpdate: (() => void) | null;

    constructor() {
        this.dice = new Dice();
        this.playerScorecard = new Scorecard();
        this.botScorecard = new Scorecard();
        this.rollsLeft = 3;
        this.round = 1;
        this.gameOver = false;
        this.isPlayerTurn = true;
        this.isBotThinking = false;
        this.pendingRollAnimation = false;
        this.onUpdate = null;
    }

    setOnUpdate(cb: () => void): void {
        this.onUpdate = cb;
    }

    private notify(): void {
        if (this.onUpdate) this.onUpdate();
    }

    // ── Player actions ──

    roll(): void {
        if (this.rollsLeft <= 0 || this.gameOver || !this.isPlayerTurn || this.isBotThinking) return;
        this.dice.roll();
        this.rollsLeft--;
        this.notify();
    }

    toggleLock(index: number): void {
        if (this.rollsLeft === 3 || !this.isPlayerTurn || this.isBotThinking) return;
        this.dice.toggleLock(index);
        this.notify();
    }

    isValidCategorySelection(index: number, dice: number[]): boolean {
        const sc = this.isPlayerTurn ? this.playerScorecard : this.botScorecard;
        if (!sc.canScore(index)) return false;
        // BBG Joker forced placement (matching upper → open lower → open upper).
        const forced = sc.jokerForcedCategories(dice);
        if (forced !== null) return forced.includes(index);
        return true;
    }

    previewScore(index: number, forPlayer: boolean = true): number | null {
        if (this.rollsLeft === 3) return null;
        const sc = forPlayer ? this.playerScorecard : this.botScorecard;
        if (!sc.canScore(index)) return null;

        const dice = this.dice.values();
        if (!this.isValidCategorySelection(index, dice)) return null;

        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        const isMainYahtzeeFilled = sc.slots[yahtzeeIdx].score !== null;

        if (isYahtzee(dice) && isMainYahtzeeFilled) {
            const upperIdx = dice[0] - 1;
            if (sc.slots[upperIdx].score !== null) {
                const name = sc.slots[index].def.name;
                if (name === 'Full House') return 25;
                if (name === 'Sm Straight') return 30;
                if (name === 'Lg Straight') return 40;
            }
        }

        return sc.slots[index].def.scoreFn(dice);
    }

    selectCategory(index: number): boolean {
        if (this.rollsLeft === 3 || this.gameOver || !this.isPlayerTurn || this.isBotThinking) return false;
        if (!this.isValidCategorySelection(index, this.dice.values())) return false;

        this.playerScorecard.scoreCategory(index, this.dice.values());
        this.notify();

        // Start bot's turn
        this.isPlayerTurn = false;
        this.isBotThinking = true;
        this.rollsLeft = 3;
        this.dice.unlockAll();
        this.dice.resetValues();
        this.notify();

        // Kick off async bot turn — UI will re-render between steps
        this.executeBotTurn();
        return true;
    }

    // ── Bot helpers ──

    private getBotFilledScores(): Record<number, number> {
        const scores: Record<number, number> = {};
        this.botScorecard.slots.forEach((s, i) => {
            if (s.score !== null) scores[i] = s.score;
        });
        return scores;
    }

    private botDiceSortedWithIndices(): { sorted: number[]; indices: number[] } {
        const vals = this.dice.values();
        const indexed = vals.map((v, i) => ({ v, i }));
        indexed.sort((a, b) => a.v - b.v);
        return {
            sorted: indexed.map(x => x.v),
            indices: indexed.map(x => x.i),
        };
    }

    private botMaskToGameMask(botMask: number, sortedIndices: number[]): number {
        let gameMask = 0;
        for (let i = 0; i < 5; i++) {
            if (botMask & (1 << i)) gameMask |= 1 << sortedIndices[i];
        }
        return gameMask;
    }

    // ── Bot turn execution (async, called after player scores) ──

    private async executeBotTurn(): Promise<void> {
        const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

        try {
            // Roll 1: wait 1s, then roll all dice with animation
            await delay(1000);
            this.pendingRollAnimation = true;
            this.notify();
            await delay(600);
            this.dice.roll();
            this.rollsLeft--;
            this.pendingRollAnimation = false;
            this.notify();
            await delay(800);

            // Rolls 2 and 3 (if bot doesn't score early)
            while (this.rollsLeft > 0) {
                const { sorted, indices } = this.botDiceSortedWithIndices();
                const filledScores = this.getBotFilledScores();
                const yahtzeeBonuses = this.botScorecard.bonusYahtzees;
                const rollsUsed = 3 - this.rollsLeft;

                const action = KeiriBot.selectAction(sorted, rollsUsed, filledScores, yahtzeeBonuses, "bbg");

                if (action.type === "score") {
                    await delay(1500);
                    this.botScorecard.scoreCategory((action as { type: "score"; category: number }).category, this.dice.values());
                    this.isBotThinking = false;
                    this.advanceTurn();
                    return;
                }

                // Roll action: lock dice one at a time
                const gameMask = this.botMaskToGameMask(action.holdMask, indices);
                for (let i = 0; i < 5; i++) {
                    const shouldLock = !!(gameMask & (1 << i));
                    if (shouldLock !== this.dice.dice[i].locked) {
                        this.dice.setLock(i, shouldLock);
                        this.notify();
                        await delay(250);
                    }
                }

                await delay(900);

                // Roll unlocked dice with animation
                this.pendingRollAnimation = true;
                this.notify();
                await delay(600);
                this.dice.roll();
                this.rollsLeft--;
                this.pendingRollAnimation = false;
                this.notify();
                await delay(600);
            }

            // Final roll used — must score
            const { sorted, indices } = this.botDiceSortedWithIndices();
            const filledScores = this.getBotFilledScores();
            const yahtzeeBonuses = this.botScorecard.bonusYahtzees;
            const action = KeiriBot.selectAction(sorted, 3, filledScores, yahtzeeBonuses, "bbg");

            await delay(1500);
            this.botScorecard.scoreCategory((action as { type: "score"; category: number }).category, this.dice.values());
            this.isBotThinking = false;
            this.advanceTurn();
        } catch (e) {
            console.error("Bot turn error:", e);
            this.isBotThinking = false;
            // Fallback: pick first empty category
            const emptyIdx = this.botScorecard.slots.findIndex(s => s.score === null);
            if (emptyIdx >= 0) this.botScorecard.scoreCategory(emptyIdx, this.dice.values());
            this.advanceTurn();
        }
    }

    // Recover from an interrupted bot turn (e.g. the page was reloaded while
    // Keiri was thinking). The bot only writes to its scorecard at the very end
    // of its turn, so if isBotThinking is still set the bot had not scored yet —
    // restart its turn cleanly from a fresh roll instead of soft-locking.
    resumeBotTurnIfNeeded(): void {
        if (this.gameOver || !this.isBotThinking) return;
        this.rollsLeft = 3;
        this.dice.unlockAll();
        this.dice.resetValues();
        this.notify();
        this.executeBotTurn();
    }

    private advanceTurn(): void {
        if (this.playerScorecard.isComplete() && this.botScorecard.isComplete()) {
            this.gameOver = true;
            this.dice.lockAll();
            this.notify();
            return;
        }

        this.round++;
        this.rollsLeft = 3;
        this.isPlayerTurn = true;
        this.dice.unlockAll();
        this.dice.resetValues();
        this.notify();
    }

    getSnapshot(): VersusGameStateSnapshot {
        let turnLabel: string;
        if (this.gameOver) {
            turnLabel = 'Game Over';
        } else if (this.isBotThinking) {
            turnLabel = "Keiri's Turn";
        } else {
            turnLabel = 'Your Turn';
        }

        return {
            dice: this.dice.snapshot(),
            rollsLeft: this.rollsLeft,
            round: this.round,
            playerScorecard: this.playerScorecard.snapshot(),
            botScorecard: this.botScorecard.snapshot(),
            gameOver: this.gameOver,
            isPlayerTurn: this.isPlayerTurn,
            isBotThinking: this.isBotThinking,
            playerFinalScore: this.playerScorecard.grandTotal(),
            botFinalScore: this.botScorecard.grandTotal(),
            turnLabel,
        };
    }
    serialize(): any {
        return {
            rollsLeft: this.rollsLeft,
            round: this.round,
            gameOver: this.gameOver,
            isPlayerTurn: this.isPlayerTurn,
            isBotThinking: this.isBotThinking,
            dice: this.dice.dice.map(d => ({ value: d.value, locked: d.locked })),
            playerSlots: this.playerScorecard.slots.map(s => ({ name: s.def.name, score: s.score })),
            playerBonusYahtzees: this.playerScorecard.bonusYahtzees,
            botSlots: this.botScorecard.slots.map(s => ({ name: s.def.name, score: s.score })),
            botBonusYahtzees: this.botScorecard.bonusYahtzees
        };
    }
    deserialize(data: any): void {
        this.rollsLeft = data.rollsLeft;
        this.round = data.round;
        this.gameOver = data.gameOver;
        this.isPlayerTurn = data.isPlayerTurn;
        this.isBotThinking = data.isBotThinking;
        this.dice.dice = data.dice.map((d: any) => ({ value: d.value, locked: d.locked }));
        data.playerSlots.forEach((savedSlot: any) => {
            const slot = this.playerScorecard.slots.find(s => s.def.name === savedSlot.name);
            if (slot) slot.score = savedSlot.score;
        });
        this.playerScorecard.bonusYahtzees = data.playerBonusYahtzees;
        data.botSlots.forEach((savedSlot: any) => {
            const slot = this.botScorecard.slots.find(s => s.def.name === savedSlot.name);
            if (slot) slot.score = savedSlot.score;
        });
        this.botScorecard.bonusYahtzees = data.botBonusYahtzees;
    }
    reset(): void {
        this.dice.reset();
        this.playerScorecard.reset();
        this.botScorecard.reset();
        this.rollsLeft = 3;
        this.round = 1;
        this.gameOver = false;
        this.isPlayerTurn = true;
        this.isBotThinking = false;
        this.pendingRollAnimation = false;
        this.notify();
    }
}
