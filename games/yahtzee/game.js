"use strict";
// ============================================================
//  Yahtzee — Full Game Engine (TypeScript)
//  Modular architecture: ScoreCategory, Scorecard, Dice, Game
// ============================================================
// --- Score Category ---------------------------
var Section;
(function (Section) {
    Section[Section["Upper"] = 0] = "Upper";
    Section[Section["Lower"] = 1] = "Lower";
})(Section || (Section = {}));
// ============================================================
//  SCORING LOGIC
// ============================================================
function sumOf(dice, value) {
    return dice.filter(d => d === value).reduce((a, b) => a + b, 0);
}
function sumAll(dice) {
    return dice.reduce((a, b) => a + b, 0);
}
function countMap(dice) {
    const map = new Map();
    for (const d of dice)
        map.set(d, (map.get(d) ?? 0) + 1);
    return map;
}
function hasOfAKind(dice, n) {
    const counts = countMap(dice);
    for (const c of counts.values()) {
        if (c >= n)
            return true;
    }
    return false;
}
function isFullHouse(dice) {
    const counts = countMap(dice);
    const vals = [...counts.values()].sort();
    return vals.length === 2 && vals[0] === 2 && vals[1] === 3;
}
function isStraight(dice, len) {
    const unique = [...new Set(dice)].sort((a, b) => a - b);
    if (unique.length < len)
        return false;
    // small straight: any 4 in sequence
    // large straight: all 5 in sequence
    for (let i = 0; i <= unique.length - len; i++) {
        let seq = true;
        for (let j = 1; j < len; j++) {
            if (unique[i + j] !== unique[i] + j) {
                seq = false;
                break;
            }
        }
        if (seq)
            return true;
    }
    return false;
}
function isYahtzee(dice) {
    return new Set(dice).size === 1;
}
// ============================================================
//  CATEGORY DEFINITIONS
// ============================================================
const CATEGORIES = [
    // Upper Section
    { name: 'Aces', section: Section.Upper, scoreFn: d => sumOf(d, 1) },
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
    constructor() {
        this.dice = this.freshSet();
    }
    freshSet() {
        return [1, 2, 3, 4, 5].map(() => ({ value: this.randomValue(), locked: false }));
    }
    randomValue() {
        return Math.floor(Math.random() * 6) + 1;
    }
    roll() {
        for (const die of this.dice) {
            if (die.locked)
                continue;
            die.value = this.randomValue();
        }
    }
    toggleLock(index) {
        if (index < 0 || index >= this.dice.length)
            return;
        this.dice[index].locked = !this.dice[index].locked;
    }
    unlockAll() {
        for (const die of this.dice)
            die.locked = false;
    }
    lockAll() {
        for (const die of this.dice)
            die.locked = true;
    }
    values() {
        return this.dice.map(d => d.value);
    }
    reset() {
        this.dice = this.freshSet();
    }
    snapshot() {
        return this.dice.map(d => ({ ...d }));
    }
}
// ============================================================
//  SCORECARD CLASS
// ============================================================
class Scorecard {
    constructor() {
        this.slots = CATEGORIES.map(def => ({ def, score: null }));
        this.yahtzeeCategoryIndex = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        this.bonusYahtzees = 0;
    }
    canScore(index) {
        return index >= 0 && index < this.slots.length && this.slots[index].score === null;
    }
    scoreCategory(index, dice) {
        if (!this.canScore(index))
            return 0;
        // Yahtzee bonus logic
        if (index === this.yahtzeeCategoryIndex && isYahtzee(dice)) {
            // If Yahtzee category is already filled with 50 (or 0), grant 100 bonus
            if (this.slots[index].score !== null) {
                this.bonusYahtzees++;
                return 100;
            }
        }
        // Check for bonus Yahtzee on non-Yahtzee categories
        if (index !== this.yahtzeeCategoryIndex
            && isYahtzee(dice)
            && this.slots[this.yahtzeeCategoryIndex].score === 50) {
            this.bonusYahtzees++;
        }
        const score = this.slots[index].def.scoreFn(dice);
        this.slots[index].score = score;
        return score;
    }
    upperTotal() {
        return this.slots
            .filter(s => s.def.section === Section.Upper && s.score !== null)
            .reduce((sum, s) => sum + s.score, 0);
    }
    upperBonus() {
        return this.upperTotal() >= 63 ? 35 : 0;
    }
    lowerTotal() {
        return this.slots
            .filter(s => s.def.section === Section.Lower && s.score !== null)
            .reduce((sum, s) => sum + s.score, 0);
    }
    grandTotal() {
        return this.upperTotal() + this.upperBonus() + this.lowerTotal()
            + (this.bonusYahtzees * 100);
    }
    isComplete() {
        return this.slots.every(s => s.score !== null);
    }
    reset() {
        this.slots.forEach(s => s.score = null);
        this.bonusYahtzees = 0;
    }
    snapshot() {
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
    constructor() {
        this.dice = new Dice();
        this.scorecard = new Scorecard();
        this.rollsLeft = 3;
        this.round = 1;
        this.gameOver = false;
        this.onUpdate = null;
    }
    setOnUpdate(cb) {
        this.onUpdate = cb;
    }
    notify() {
        if (this.onUpdate)
            this.onUpdate();
    }
    roll() {
        if (this.rollsLeft <= 0 || this.gameOver)
            return;
        this.dice.roll();
        this.rollsLeft--;
        this.notify();
    }
    toggleLock(index) {
        this.dice.toggleLock(index);
        this.notify();
    }
    previewScore(index) {
        if (!this.scorecard.canScore(index))
            return null;
        const dice = this.dice.values();
        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        if (index === yahtzeeIdx && isYahtzee(dice)
            && this.scorecard.slots[index].score !== null) {
            return 100;
        }
        return this.scorecard.slots[index].def.scoreFn(dice);
    }
    selectCategory(index) {
        if (this.rollsLeft === 3)
            return false; // must roll at least once
        if (!this.scorecard.canScore(index))
            return false;
        if (this.gameOver)
            return false;
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
        this.notify();
        return true;
    }
    getSnapshot() {
        return {
            dice: this.dice.snapshot(),
            rollsLeft: this.rollsLeft,
            round: this.round,
            scorecard: this.scorecard.snapshot(),
            gameOver: this.gameOver,
            finalScore: this.scorecard.grandTotal(),
        };
    }
    reset() {
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
    constructor() {
        this.el = {};
        this.cache();
    }
    cache() {
        const ids = [
            'dice-tray', 'roll-btn', 'round-num', 'rolls-left',
            'upper-scores', 'lower-scores',
            'upper-total', 'upper-bonus', 'lower-total', 'grand-total',
            'game-over-overlay', 'final-score', 'score-breakdown',
            'play-again-btn', 'held-label', 'high-score-display',
        ];
        for (const id of ids) {
            this.el[id] = document.getElementById(id);
        }
    }
    pipPositions(value) {
        const patterns = {
            1: [4],
            2: [2, 6],
            3: [2, 4, 6],
            4: [0, 2, 6, 8],
            5: [0, 2, 4, 6, 8],
            6: [0, 2, 3, 5, 6, 8],
        };
        return patterns[value] || [];
    }
    createDieHTML(value, locked, index, gameOver) {
        const pips = this.pipPositions(value);
        const dots = [];
        for (let p = 0; p < 9; p++) {
            const hidden = pips.includes(p) ? '' : 'hidden';
            dots.push(`<div class="pip-dot ${hidden}"></div>`);
        }
        const lockClass = locked ? ' locked' : '';
        const gameOverClass = gameOver ? ' filled' : '';
        return `<div class="die${lockClass}${gameOverClass}" data-index="${index}">
            <div class="pip-grid">${dots.join('')}</div>
        </div>`;
    }
    createScoreRow(slot, index, previewScore, currentDiceValues, gameOver) {
        const filled = slot.score !== null;
        const canSelect = !filled && !gameOver;
        const cls = filled ? 'score-row filled' : 'score-row empty';
        const data = canSelect ? `data-category="${index}"` : '';
        let scoreDisplay;
        if (filled) {
            scoreDisplay = `<span class="category-score">${slot.score}</span>`;
        }
        else if (canSelect && previewScore !== null) {
            scoreDisplay = `<span class="category-score preview-score">${previewScore}</span>`;
        }
        else {
            scoreDisplay = `<span class="category-score empty-score">—</span>`;
        }
        return `<div class="${cls}" ${data}>
            <span class="category-name">${slot.def.name}</span>
            ${scoreDisplay}
        </div>`;
    }
    render(game) {
        const s = game.getSnapshot();
        // header
        this.el['round-num'].textContent = String(s.round);
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        this.el['roll-btn'].disabled = s.rollsLeft <= 0 || s.gameOver;
        // dice
        const tray = this.el['dice-tray'];
        tray.innerHTML = s.dice.map((d, i) => this.createDieHTML(d.value, d.locked, i, s.gameOver)).join('');
        // dice click handlers
        tray.querySelectorAll('.die').forEach(die => {
            die.addEventListener('click', () => {
                if (s.gameOver)
                    return;
                const idx = parseInt(die.dataset.index);
                game.toggleLock(idx);
                this.render(game);
            });
        });
        // held label
        const lockedDice = s.dice.filter(d => d.locked);
        const heldLabel = this.el['held-label'];
        if (lockedDice.length > 0) {
            heldLabel.textContent = `Held: ${lockedDice.map(d => d.value).join(' ')}`;
            heldLabel.className = 'held-label held-visible';
        }
        else {
            heldLabel.textContent = 'Held: None';
            heldLabel.className = 'held-label held-hidden';
        }
        // roll button click
        this.el['roll-btn'].onclick = () => {
            game.roll();
            this.render(game);
        };
        // scorecard
        const upperSlots = s.scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = s.scorecard.filter(sl => sl.def.section === Section.Lower);
        this.el['upper-scores'].innerHTML = upperSlots
            .map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            return this.createScoreRow(slot, globalIdx, preview, s.dice.map(d => d.value), s.gameOver);
        })
            .join('');
        this.el['lower-scores'].innerHTML = lowerSlots
            .map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            return this.createScoreRow(slot, globalIdx, preview, s.dice.map(d => d.value), s.gameOver);
        })
            .join('');
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
                const idx = parseInt(row.dataset.category);
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
    showGameOver(game) {
        const total = game.scorecard.grandTotal();
        const upper = game.scorecard.upperTotal();
        const bonus = game.scorecard.upperBonus();
        const lower = game.scorecard.lowerTotal();
        const yahtzees = game.scorecard.bonusYahtzees || 0;
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
    loadHighScore() {
        try {
            const raw = localStorage.getItem('yahtzee_high_score');
            return raw ? parseInt(raw, 10) || 0 : 0;
        }
        catch {
            return 0;
        }
    }
    saveHighScore(score) {
        localStorage.setItem('yahtzee_high_score', String(score));
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
