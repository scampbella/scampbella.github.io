// ============================================================
//  Yahtzee — Full Game Engine (TypeScript)
//  Modular architecture: ScoreCategory, Scorecard, Dice, Game
// ============================================================

// --- Die ---------------------------------------
interface DieState {
    value: number;
    locked: boolean;
}

// --- Score Category ---------------------------
enum Section { Upper, Lower }

interface CategoryDef {
    name: string;
    section: Section;
    scoreFn: (dice: number[]) => number;
}

// --- Scorecard Slot ---------------------------
interface ScoreSlot {
    def: CategoryDef;
    score: number | null;
}

// --- Game State for UI ------------------------
interface GameStateSnapshot {
    dice: DieState[];
    rollsLeft: number;
    round: number;
    scorecard: ScoreSlot[];
    gameOver: boolean;
    finalScore: number;
}

// ============================================================
//  SCORING LOGIC
// ============================================================

function sumOf(dice: number[], value: number): number {
    return dice.filter(d => d === value).reduce((a, b) => a + b, 0);
}

function sumAll(dice: number[]): number {
    return dice.reduce((a, b) => a + b, 0);
}

function countMap(dice: number[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const d of dice) map.set(d, (map.get(d) ?? 0) + 1);
    return map;
}

function hasOfAKind(dice: number[], n: number): boolean {
    const counts = countMap(dice);
    for (const c of counts.values()) {
        if (c >= n) return true;
    }
    return false;
}

function isFullHouse(dice: number[]): boolean {
    const counts = countMap(dice);
    const vals = [...counts.values()].sort();
    return vals.length === 2 && vals[0] === 2 && vals[1] === 3;
}

function isStraight(dice: number[], len: number): boolean {
    const unique = [...new Set(dice)].sort((a, b) => a - b);
    if (unique.length < len) return false;
    // small straight: any 4 in sequence
    // large straight: all 5 in sequence
    for (let i = 0; i <= unique.length - len; i++) {
        let seq = true;
        for (let j = 1; j < len; j++) {
            if (unique[i + j] !== unique[i] + j) { seq = false; break; }
        }
        if (seq) return true;
    }
    return false;
}

function isYahtzee(dice: number[]): boolean {
    return new Set(dice).size === 1;
}

// ============================================================
//  CATEGORY DEFINITIONS
// ============================================================

const CATEGORIES: CategoryDef[] = [
    // Upper Section
    { name: 'Ones', section: Section.Upper, scoreFn: d => sumOf(d, 1) },
    { name: 'Twos', section: Section.Upper, scoreFn: d => sumOf(d, 2) },
    { name: 'Threes', section: Section.Upper, scoreFn: d => sumOf(d, 3) },
    { name: 'Fours', section: Section.Upper, scoreFn: d => sumOf(d, 4) },
    { name: 'Fives', section: Section.Upper, scoreFn: d => sumOf(d, 5) },
    { name: 'Sixes', section: Section.Upper, scoreFn: d => sumOf(d, 6) },
    // Lower Section
    { name: '3 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 3) ? sumAll(d) : 0 },
    { name: '4 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 4) ? sumAll(d) : 0 },
    { name: 'Full House', section: Section.Lower, scoreFn: d => isFullHouse(d) ? 25 : 0 },
    { name: 'Sm Straight', section: Section.Lower, scoreFn: d => isStraight(d, 4) ? 30 : 0 },
    { name: 'Lg Straight', section: Section.Lower, scoreFn: d => isStraight(d, 5) ? 40 : 0 },
    { name: 'Yahtzee', section: Section.Lower, scoreFn: d => isYahtzee(d) ? 50 : 0 },
    { name: 'Chance', section: Section.Lower, scoreFn: d => sumAll(d) },
];

// ============================================================
//  DICE CLASS
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

// ============================================================
//  SCORECARD CLASS
// ============================================================

class Scorecard {
    slots: ScoreSlot[];
    private yahtzeeCategoryIndex: number;
    private bonusYahtzees: number;

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

// ============================================================
//  GAME ENGINE
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
        if (this.rollsLeft === 3) return; // cannot lock dice unless we have rolled at least once
        this.dice.toggleLock(index);
        this.notify();
    }

    isValidCategorySelection(index: number, dice: number[]): boolean {
        // Must be an empty slot
        if (!this.scorecard.canScore(index)) return false;

        // BBG: all remaining categories are always legal — no forced picks
        return true;
    }

    previewScore(index: number): number | null {
        if (this.rollsLeft === 3) return null; // no preview before rolling
        if (!this.scorecard.canScore(index)) return null;

        const dice = this.dice.values();
        if (!this.isValidCategorySelection(index, dice)) return null;

        // Joker rule preview
        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        const isMainYahtzeeFilled = this.scorecard.slots[yahtzeeIdx].score !== null;

        if (isYahtzee(dice) && isMainYahtzeeFilled) {
            const name = this.scorecard.slots[index].def.name;
            if (name === 'Full House') return 25;
            if (name === 'Sm Straight') return 30;
            if (name === 'Lg Straight') return 40;
        }

        return this.scorecard.slots[index].def.scoreFn(dice);
    }

    selectCategory(index: number): boolean {
        if (this.rollsLeft === 3) return false; // must roll at least once
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
        this.dice.resetValues(); // reset dice to 1 at start of new turn
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

// ============================================================
//  UI RENDERER
// ============================================================

class UI {
    el: Record<string, HTMLElement>;

    constructor() {
        this.el = {};
        this.cache();
    }

    private cache(): void {
        const ids = [
            'dice-tray', 'roll-btn', 'round-num', 'rolls-left',
            'upper-scores', 'lower-scores',
            'upper-total', 'upper-bonus', 'lower-total', 'grand-total',
            'game-over-overlay', 'final-score', 'score-breakdown',
            'play-again-btn', 'high-score-display', 'bonus-tracker',
        ];
        for (const id of ids) {
            this.el[id] = document.getElementById(id)!;
        }
    }

    private pipPositions(value: number): number[] {
        const patterns: Record<number, number[]> = {
            1: [4],
            2: [2, 6],
            3: [2, 4, 6],
            4: [0, 2, 6, 8],
            5: [0, 2, 4, 6, 8],
            6: [0, 2, 3, 5, 6, 8],
        };
        return patterns[value] || [];
    }

    private createDieHTML(value: number, locked: boolean, index: number, gameOver: boolean, rollStart: boolean): string {
        const pips = this.pipPositions(value);
        const dots = [];
        for (let p = 0; p < 9; p++) {
            const hidden = pips.includes(p) ? '' : 'hidden';
            dots.push(`<div class="pip-dot ${hidden}"></div>`);
        }

        const lockClass = locked ? ' locked' : '';
        const gameOverClass = gameOver ? ' filled' : '';
        const unrollableClass = rollStart ? ' unrolled' : '';

        return `<div class="die${lockClass}${gameOverClass}${unrollableClass}" data-index="${index}">
            <div class="pip-grid">${dots.join('')}</div>
        </div>`;
    }

    private createScoreRow(
        slot: ScoreSlot,
        index: number,
        previewScore: number | null,
        gameOver: boolean,
        selectable: boolean,
    ): string {
        const filled = slot.score !== null;
        const canSelect = selectable && !filled && !gameOver;
        const cls = filled
            ? 'score-row filled'
            : (canSelect ? 'score-row empty' : 'score-row empty disabled');
        const data = canSelect ? `data-category="${index}"` : '';

        let scoreDisplay: string;
        if (filled) {
            scoreDisplay = `<span class="category-score">${slot.score}</span>`;
        } else if (canSelect && previewScore !== null) {
            scoreDisplay = `<span class="category-score preview-score">${previewScore}</span>`;
        } else {
            scoreDisplay = `<span class="category-score empty-score">—</span>`;
        }

        return `<div class="${cls}" ${data}>
            <span class="category-name">${slot.def.name}</span>
            ${scoreDisplay}
        </div>`;
    }

    render(game: Game): void {
        const s = game.getSnapshot();

        // header
        this.el['round-num'].textContent = String(s.round);
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        (this.el['roll-btn'] as HTMLButtonElement).disabled = s.rollsLeft <= 0 || s.gameOver;

        // dice
        const tray = this.el['dice-tray'] as HTMLElement;
        tray.innerHTML = s.dice.map((d, i) =>
            this.createDieHTML(d.value, d.locked, i, s.gameOver, s.rollsLeft === 3)
        ).join('');

        // dice click handlers
        tray.querySelectorAll('.die').forEach(die => {
            die.addEventListener('click', () => {
                if (s.gameOver) return;
                const idx = parseInt((die as HTMLElement).dataset.index!);
                game.toggleLock(idx);
                this.render(game);
            });
        });


        // roll button click
        this.el['roll-btn'].onclick = () => {
            if (s.rollsLeft <= 0 || s.gameOver) return;

            const btn = this.el['roll-btn'] as HTMLButtonElement;
            btn.disabled = true; // prevent double clicks during animation

            const tray = this.el['dice-tray'] as HTMLElement;
            const diceElements = tray.querySelectorAll('.die:not(.locked)');
            
            diceElements.forEach(die => {
                die.classList.add('rolling');
            });

            setTimeout(() => {
                game.roll();
                this.render(game);
                if (isYahtzee(game.dice.values())) {
                    this.triggerYahtzeeAnimation();
                }
            }, 600); // Wait for the animation to complete
        };

        // scorecard
        const upperSlots = s.scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = s.scorecard.filter(sl => sl.def.section === Section.Lower);

        const diceVals = s.dice.map(d => d.value);

        this.el['upper-scores'].innerHTML = upperSlots
            .map((slot, i) => {
                const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
                const preview = slot.score === null ? game.previewScore(globalIdx) : null;
                const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
                return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable);
            })
            .join('');

        this.el['lower-scores'].innerHTML = lowerSlots
            .map((slot, i) => {
                const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
                const preview = slot.score === null ? game.previewScore(globalIdx) : null;
                const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
                return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable);
            })
            .join('');

        // Upper Section Bonus Tracker
        const tracker = this.el['bonus-tracker'];
        if (tracker) {
            const upperTotal = game.scorecard.upperTotal();
            if (upperTotal >= 63) {
                tracker.innerHTML = `<span class="bonus-secured">Bonus Secured: +35</span>`;
            } else {
                let potential = upperTotal;
                for (let i = 0; i < 6; i++) {
                    if (game.scorecard.slots[i].score === null) {
                        potential += 5 * (i + 1);
                    }
                }
                if (potential < 63) {
                    tracker.innerHTML = `<span class="bonus-missed">Bonus Missed</span>`;
                } else {
                    const diff = 63 - upperTotal;
                    tracker.innerHTML = `<span class="bonus-progress">${diff} points until +35 bonus</span>`;
                }
            }
        }

        // totals
        this.el['upper-total'].textContent = String(game.scorecard.upperTotal());
        this.el['upper-bonus'].textContent = game.scorecard.upperBonus() > 0
            ? `+${game.scorecard.upperBonus()}`
            : '0';
        this.el['lower-total'].textContent = String(game.scorecard.lowerTotal());
        this.el['grand-total'].textContent = String(game.scorecard.grandTotal());

        // score row click handlers
        document.querySelectorAll('.score-row.empty[data-category]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt((row as HTMLElement).dataset.category!);
                game.selectCategory(idx);
                this.render(game);

                if (game.gameOver) {
                    this.showGameOver(game);
                }
            });
        });

        // game over
        if (s.gameOver) {
            this.showGameOver(game);
        }

        // play again button
        this.el['play-again-btn'].onclick = () => {
            game.reset();
            this.render(game);
            this.el['game-over-overlay'].classList.add('hidden');
        };
    }

    showGameOver(game: Game): void {
        const total = game.scorecard.grandTotal();
        const upper = game.scorecard.upperTotal();
        const bonus = game.scorecard.upperBonus();
        const lower = game.scorecard.lowerTotal();
        const yahtzees = (game.scorecard as any).bonusYahtzees || 0;
        const yahtzeeBonus = yahtzees * 100;

        this.el['final-score'].textContent = String(total);
        this.el['score-breakdown'].innerHTML = `
            <span>Upper: ${upper}</span>
            <span>Bonus: ${bonus}</span>
            <span>Lower: ${lower}</span>
            ${yahtzeeBonus > 0 ? `<span>Yahtzee Bonus: ${yahtzeeBonus}</span>` : ''}
        `;

        const highScore = this.loadHighScore();
        const isNewRecord = total > highScore;
        if (isNewRecord) {
            this.saveHighScore(total);
        }
        const best = Math.max(total, highScore);

        const hsEl = this.el['high-score-display'];
        hsEl.innerHTML = isNewRecord
            ? `<span class="new-record">★ NEW RECORD!</span> High Score: <strong>${best}</strong>`
            : `High Score: <strong>${best}</strong>`;

        this.el['game-over-overlay'].classList.remove('hidden');
    }

    private loadHighScore(): number {
        try {
            const raw = localStorage.getItem('yahtzee_high_score');
            return raw ? parseInt(raw, 10) || 0 : 0;
        } catch {
            return 0;
        }
    }

    private saveHighScore(score: number): void {
        localStorage.setItem('yahtzee_high_score', String(score));
    }

    triggerYahtzeeAnimation(): void {
        const banner = document.getElementById('yahtzee-banner');
        const container = document.getElementById('confetti-container');
        if (!banner || !container) return;

        banner.classList.remove('hidden');
        container.innerHTML = '';

        const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4'];
        const pieceCount = 100;

        for (let i = 0; i < pieceCount; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 1.5;
            const duration = Math.random() * 1.5 + 1.5;
            const width = Math.random() * 6 + 6;
            const height = Math.random() * 12 + 12;

            piece.style.backgroundColor = color;
            piece.style.left = `${left}%`;
            piece.style.animationDelay = `${delay}s`;
            piece.style.animationDuration = `${duration}s`;
            piece.style.width = `${width}px`;
            piece.style.height = `${height}px`;

            container.appendChild(piece);
        }

        setTimeout(() => {
            banner.classList.add('hidden');
            container.innerHTML = '';
        }, 3000);
    }
}

// ============================================================
//  BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const ui = new UI();
    // Do not auto-roll — let the user click ROLL DICE to start
    ui.render(game);
});