// Yahtzee — built from src/
// 2026-07-21T07:07:39.053Z
// File order: types.js, scoring.js, categories.js, dice.js, scorecard.js, game.js, ui.js, bot.js, versus-game.js, versus-ui.js, main.js


"use strict";
// ============================================================
//  Yahtzee — Types & Interfaces
// ============================================================
// --- Score Category ---------------------------
var Section;
(function (Section) {
    Section[Section["Upper"] = 0] = "Upper";
    Section[Section["Lower"] = 1] = "Lower";
})(Section || (Section = {}));

"use strict";
// ============================================================
//  Yahtzee — Scoring Logic
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

"use strict";
// ============================================================
//  Yahtzee — Category Definitions
// ============================================================
const CATEGORIES = [
    // Upper Section — indices 0-5
    { name: 'Ones', section: Section.Upper, scoreFn: d => sumOf(d, 1) },
    { name: 'Twos', section: Section.Upper, scoreFn: d => sumOf(d, 2) },
    { name: 'Threes', section: Section.Upper, scoreFn: d => sumOf(d, 3) },
    { name: 'Fours', section: Section.Upper, scoreFn: d => sumOf(d, 4) },
    { name: 'Fives', section: Section.Upper, scoreFn: d => sumOf(d, 5) },
    { name: 'Sixes', section: Section.Upper, scoreFn: d => sumOf(d, 6) },
    // Lower Section — indices 6-12
    { name: '3 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 3) ? sumAll(d) : 0 },
    { name: '4 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 4) ? sumAll(d) : 0 },
    { name: 'Full House', section: Section.Lower, scoreFn: d => isFullHouse(d) ? 25 : 0 },
    { name: 'Sm Straight', section: Section.Lower, scoreFn: d => isStraight(d, 4) ? 30 : 0 },
    { name: 'Lg Straight', section: Section.Lower, scoreFn: d => isStraight(d, 5) ? 40 : 0 },
    { name: 'Yahtzee', section: Section.Lower, scoreFn: d => isYahtzee(d) ? 50 : 0 },
    { name: 'Chance', section: Section.Lower, scoreFn: d => sumAll(d) },
];

"use strict";
// ============================================================
//  Yahtzee — Dice Class
// ============================================================
class Dice {
    constructor() {
        this.dice = this.freshSet();
    }
    freshSet() {
        return [1, 2, 3, 4, 5].map(() => ({ value: 1, locked: false }));
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
    setLock(index, locked) {
        if (index < 0 || index >= this.dice.length)
            return;
        this.dice[index].locked = locked;
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
    resetValues() {
        for (const die of this.dice) {
            die.value = 1;
        }
    }
    snapshot() {
        return this.dice.map(d => ({ ...d }));
    }
}

"use strict";
// ============================================================
//  Yahtzee — Scorecard Class
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
    // BBG Joker forced placement. A Yahtzee rolled after the Yahtzee box is
    // already filled (any score, including 0) is a wild card, and BBG restricts
    // where it may be scored:
    //   1. If the matching upper box is still open, it MUST be scored there.
    //   2. Otherwise it must be scored in an open Lower box (the Joker value).
    //   3. If every Lower box is already filled, it is scored (as 0) in an open
    //      Upper box.
    // Returns the list of currently-legal category indices, or null when there
    // is no restriction (free choice among all open boxes).
    jokerForcedCategories(dice) {
        if (!isYahtzee(dice))
            return null;
        if (this.slots[this.yahtzeeCategoryIndex].score === null)
            return null;
        const upperIdx = dice[0] - 1;
        if (upperIdx < 0 || upperIdx > 5)
            return null;
        if (this.slots[upperIdx].score === null)
            return [upperIdx];
        const openIn = (section) => this.slots
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.def.section === section && s.score === null)
            .map(({ i }) => i);
        const lowerOpen = openIn(Section.Lower);
        if (lowerOpen.length > 0)
            return lowerOpen;
        const upperOpen = openIn(Section.Upper);
        if (upperOpen.length > 0)
            return upperOpen;
        return null;
    }
    scoreCategory(index, dice) {
        if (!this.canScore(index))
            return 0;
        let score = this.slots[index].def.scoreFn(dice);
        // Joker rule scoring: subsequent Yahtzee and main Yahtzee box is filled (any score)
        // AND the corresponding upper box is filled
        if (isYahtzee(dice) && this.slots[this.yahtzeeCategoryIndex].score !== null) {
            const upperIdx = dice[0] - 1;
            if (this.slots[upperIdx].score !== null) {
                const name = this.slots[index].def.name;
                if (name === 'Full House') {
                    score = 25;
                }
                else if (name === 'Sm Straight') {
                    score = 30;
                }
                else if (name === 'Lg Straight') {
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
    upperTotal() {
        return this.slots
            .filter(s => s.def.section === Section.Upper && s.score !== null)
            .reduce((sum, s) => sum + s.score, 0);
    }
    upperBonus() {
        return this.upperTotal() >= 63 ? 35 : 0;
    }
    lowerTotal() {
        const slotsTotal = this.slots
            .filter(s => s.def.section === Section.Lower && s.score !== null)
            .reduce((sum, s) => sum + s.score, 0);
        return slotsTotal + (this.bonusYahtzees * 100);
    }
    grandTotal() {
        return this.upperTotal() + this.upperBonus() + this.lowerTotal();
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

"use strict";
// ============================================================
//  Yahtzee — Game Engine (single player)
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
        if (this.rollsLeft === 3)
            return;
        this.dice.toggleLock(index);
        this.notify();
    }
    isValidCategorySelection(index, dice) {
        if (!this.scorecard.canScore(index))
            return false;
        // BBG Joker forced placement (matching upper → open lower → open upper).
        const forced = this.scorecard.jokerForcedCategories(dice);
        if (forced !== null)
            return forced.includes(index);
        return true;
    }
    previewScore(index) {
        if (this.rollsLeft === 3)
            return null;
        if (!this.scorecard.canScore(index))
            return null;
        const dice = this.dice.values();
        if (!this.isValidCategorySelection(index, dice))
            return null;
        // Joker rule preview
        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        const isMainYahtzeeFilled = this.scorecard.slots[yahtzeeIdx].score !== null;
        if (isYahtzee(dice) && isMainYahtzeeFilled) {
            const upperIdx = dice[0] - 1;
            if (this.scorecard.slots[upperIdx].score !== null) {
                const name = this.scorecard.slots[index].def.name;
                if (name === 'Full House')
                    return 25;
                if (name === 'Sm Straight')
                    return 30;
                if (name === 'Lg Straight')
                    return 40;
            }
        }
        return this.scorecard.slots[index].def.scoreFn(dice);
    }
    selectCategory(index) {
        if (this.rollsLeft === 3)
            return false;
        if (this.gameOver)
            return false;
        if (!this.isValidCategorySelection(index, this.dice.values()))
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
        this.dice.resetValues();
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
    serialize() {
        return {
            rollsLeft: this.rollsLeft,
            round: this.round,
            gameOver: this.gameOver,
            dice: this.dice.dice.map(d => ({ value: d.value, locked: d.locked })),
            slots: this.scorecard.slots.map(s => ({ name: s.def.name, score: s.score })),
            bonusYahtzees: this.scorecard.bonusYahtzees
        };
    }
    deserialize(data) {
        this.rollsLeft = data.rollsLeft;
        this.round = data.round;
        this.gameOver = data.gameOver;
        this.dice.dice = data.dice.map((d) => ({ value: d.value, locked: d.locked }));
        data.slots.forEach((savedSlot) => {
            const slot = this.scorecard.slots.find(s => s.def.name === savedSlot.name);
            if (slot)
                slot.score = savedSlot.score;
        });
        this.scorecard.bonusYahtzees = data.bonusYahtzees;
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

"use strict";
class UI {
    constructor() {
        this.el = {};
        this.cache();
    }
    cache() {
        const ids = [
            'dice-tray', 'roll-btn', 'rolls-left', 'high-score-display-header',
            'upper-scores', 'lower-scores',
            'upper-total', 'upper-bonus', 'lower-total', 'grand-total',
            'game-over-overlay', 'final-score', 'score-breakdown',
            'play-again-btn', 'high-score-display', 'bonus-tracker',
        ];
        for (const id of ids) {
            this.el[id] = document.getElementById(id);
        }
    }
    pipPositions(value) {
        const patterns = {
            1: [4], 2: [2, 6], 3: [2, 4, 6],
            4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
        };
        return patterns[value] || [];
    }
    createDieHTML(value, locked, index, gameOver, rollStart) {
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
    createScoreRow(slot, index, previewScore, gameOver, selectable, bonusYahtzees = 0) {
        const filled = slot.score !== null;
        const canSelect = selectable && !filled && !gameOver;
        const cls = filled ? 'score-row filled'
            : (canSelect ? 'score-row empty' : 'score-row empty disabled');
        const data = canSelect ? `data-category="${index}"` : '';
        let scoreDisplay;
        if (filled) {
            let scoreText = String(slot.score);
            if (slot.def.name === 'Yahtzee' && bonusYahtzees > 0) {
                scoreText += ` + ${bonusYahtzees * 100}`;
            }
            scoreDisplay = `<span class="category-score">${scoreText}</span>`;
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
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        this.el['roll-btn'].disabled = s.rollsLeft <= 0 || s.gameOver;
        const tray = this.el['dice-tray'];
        tray.innerHTML = s.dice.map((d, i) => this.createDieHTML(d.value, d.locked, i, s.gameOver, s.rollsLeft === 3)).join('');
        tray.querySelectorAll('.die').forEach(die => {
            die.addEventListener('click', () => {
                if (s.gameOver)
                    return;
                const idx = parseInt(die.dataset.index);
                game.toggleLock(idx);
                this.render(game);
            });
        });
        this.el['roll-btn'].onclick = () => {
            if (s.rollsLeft <= 0 || s.gameOver)
                return;
            const btn = this.el['roll-btn'];
            btn.disabled = true;
            const trayEl = this.el['dice-tray'];
            const diceElements = trayEl.querySelectorAll('.die:not(.locked)');
            diceElements.forEach(die => { die.classList.add('rolling'); });
            setTimeout(() => {
                game.roll();
                this.render(game);
                if (isYahtzee(game.dice.values())) {
                    this.triggerYahtzeeAnimation();
                }
            }, 600);
        };
        const upperSlots = s.scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = s.scorecard.filter(sl => sl.def.section === Section.Lower);
        const diceVals = s.dice.map(d => d.value);
        this.el['upper-scores'].innerHTML = upperSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable, game.scorecard.bonusYahtzees);
        }).join('');
        this.el['lower-scores'].innerHTML = lowerSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable, game.scorecard.bonusYahtzees);
        }).join('');
        // Upper Section Bonus Tracker
        const tracker = this.el['bonus-tracker'];
        if (tracker) {
            const upperTotal = game.scorecard.upperTotal();
            if (upperTotal >= 63) {
                tracker.innerHTML = `<span class="bonus-secured">Bonus Secured: +35</span>`;
            }
            else {
                let potential = upperTotal;
                for (let i = 0; i < 6; i++) {
                    if (game.scorecard.slots[i].score === null)
                        potential += 5 * (i + 1);
                }
                if (potential < 63) {
                    tracker.innerHTML = `<span class="bonus-missed">Bonus Missed</span>`;
                }
                else {
                    const diff = 63 - upperTotal;
                    tracker.innerHTML = `<span class="bonus-progress">${diff} points until +35 bonus</span>`;
                }
            }
        }
        this.el['upper-total'].textContent = String(game.scorecard.upperTotal());
        this.el['upper-bonus'].textContent = game.scorecard.upperBonus() > 0
            ? `+${game.scorecard.upperBonus()}` : '0';
        this.el['lower-total'].textContent = String(game.scorecard.lowerTotal());
        this.el['grand-total'].textContent = String(game.scorecard.grandTotal());
        document.querySelectorAll('.score-row.empty[data-category]').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.category);
                game.selectCategory(idx);
                this.render(game);
                if (game.gameOver)
                    this.showGameOver(game);
            });
        });
        if (s.gameOver)
            this.showGameOver(game);
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
        const yahtzees = game.scorecard.bonusYahtzees;
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
            updateHighScoreDisplay();
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
    triggerYahtzeeAnimation() {
        const banner = document.getElementById('yahtzee-banner');
        const container = document.getElementById('confetti-container');
        if (!banner || !container)
            return;
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

"use strict";
const KeiriBot = (() => {
    const DICE_COUNT = 5;
    const YAHTZEE_BONUS = 100;
    const UPPER_BONUS = 35;
    const UPPER_BONUS_THRESHOLD = 63;
    const CATEGORY = {
        Ones: 0, Twos: 1, Threes: 2, Fours: 3, Fives: 4, Sixes: 5,
        ThreeKind: 6, FourKind: 7, FullHouse: 8,
        SmallStraight: 9, LargeStraight: 10, Yahtzee: 11, Chance: 12,
    };
    const ALL_CATEGORIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const UPPER_CATEGORIES = [0, 1, 2, 3, 4, 5];
    const LOWER_CATEGORIES = [6, 7, 8, 9, 10, 11, 12];
    function upperFace(cat) { return cat <= 5 ? cat + 1 : null; }
    function upperForFace(face) { return face >= 1 && face <= 6 ? (face - 1) : null; }
    function maxBaseScore(cat) {
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
    function isUpper(cat) { return cat <= 5; }
    // ── Dice helpers ──
    function sortDice(dice) { return [...dice].sort((a, b) => a - b); }
    // ── Dice counts and sum ──
    function diceCounts(dice) {
        const counts = new Array(7).fill(0);
        for (const v of dice)
            counts[v] += 1;
        return counts;
    }
    function diceSum(dice) { return dice.reduce((s, v) => s + v, 0); }
    function isBotYahtzee(dice) { return dice.length === DICE_COUNT && dice[0] === dice[DICE_COUNT - 1]; }
    function yahtzeeFace(dice) { return isBotYahtzee(dice) ? dice[0] : null; }
    // ── Score sheet helpers ──
    function isFilled(filledScores, cat) { return cat in filledScores; }
    function remainingCategories(filledScores) { return ALL_CATEGORIES.filter(c => !isFilled(filledScores, c)); }
    function upperSubtotal(filledScores) { return UPPER_CATEGORIES.reduce((sum, c) => sum + (filledScores[c] ?? 0), 0); }
    function yahtzeeScored50(filledScores) { return filledScores[CATEGORY.Yahtzee] === 50; }
    function jokerActive(_ruleset, dice, filledScores) {
        if (!isBotYahtzee(dice))
            return false;
        const face = yahtzeeFace(dice);
        if (face === null)
            return false;
        const matching = upperForFace(face);
        if (matching === null)
            return false;
        // BBG: free-choice Joker — Yahtzee + matching upper both filled
        return isFilled(filledScores, CATEGORY.Yahtzee) && isFilled(filledScores, matching);
    }
    function earnsYahtzeeBonus(dice, filledScores) {
        return isBotYahtzee(dice) && yahtzeeScored50(filledScores);
    }
    function baseScore(cat, dice, joker) {
        const counts = diceCounts(dice);
        if (joker) {
            if (cat === CATEGORY.FullHouse)
                return 25;
            if (cat === CATEGORY.SmallStraight)
                return 30;
            if (cat === CATEGORY.LargeStraight)
                return 40;
        }
        switch (cat) {
            case CATEGORY.Ones:
            case CATEGORY.Twos:
            case CATEGORY.Threes:
            case CATEGORY.Fours:
            case CATEGORY.Fives:
            case CATEGORY.Sixes: {
                const face = upperFace(cat);
                return counts[face] * face;
            }
            case CATEGORY.ThreeKind: return counts.some(c => c >= 3) ? diceSum(dice) : 0;
            case CATEGORY.FourKind: return counts.some(c => c >= 4) ? diceSum(dice) : 0;
            case CATEGORY.FullHouse: return counts.includes(3) && counts.includes(2) ? 25 : 0;
            case CATEGORY.SmallStraight: return ((counts[1] > 0 && counts[2] > 0 && counts[3] > 0 && counts[4] > 0) ||
                (counts[2] > 0 && counts[3] > 0 && counts[4] > 0 && counts[5] > 0) ||
                (counts[3] > 0 && counts[4] > 0 && counts[5] > 0 && counts[6] > 0)) ? 30 : 0;
            case CATEGORY.LargeStraight: return (counts.slice(1, 6).every(c => c === 1) || counts.slice(2, 7).every(c => c === 1)) ? 40 : 0;
            case CATEGORY.Yahtzee: return isBotYahtzee(dice) ? 50 : 0;
            case CATEGORY.Chance: return diceSum(dice);
            default: return 0;
        }
    }
    function scoreRoll(ruleset, cat, dice, filledScores) {
        const yBonus = earnsYahtzeeBonus(dice, filledScores) ? YAHTZEE_BONUS : 0;
        const joker = jokerActive(ruleset, dice, filledScores);
        const bs = baseScore(cat, dice, joker);
        const upperBefore = upperSubtotal(filledScores);
        const uBonus = (isUpper(cat) && upperBefore < UPPER_BONUS_THRESHOLD && upperBefore + bs >= UPPER_BONUS_THRESHOLD) ? UPPER_BONUS : 0;
        return { baseScore: bs, yahtzeeBonus: yBonus, upperBonus: uBonus, totalDelta: bs + yBonus + uBonus };
    }
    // ── Legal score categories (BBG forced Joker) ──
    // Mirrors Scorecard.jokerForcedCategories: a wild-card Yahtzee must be scored
    // in the matching upper box if open, else an open Lower box, else an open
    // Upper box.
    function jokerForcedCategories(dice, filledScores) {
        if (!isBotYahtzee(dice))
            return null;
        if (!isFilled(filledScores, CATEGORY.Yahtzee))
            return null;
        const face = yahtzeeFace(dice);
        if (face === null)
            return null;
        const matching = upperForFace(face);
        if (matching === null)
            return null;
        if (!isFilled(filledScores, matching))
            return [matching];
        const lowerOpen = LOWER_CATEGORIES.filter(c => !isFilled(filledScores, c));
        if (lowerOpen.length > 0)
            return lowerOpen;
        const upperOpen = UPPER_CATEGORIES.filter(c => !isFilled(filledScores, c));
        if (upperOpen.length > 0)
            return upperOpen;
        return null;
    }
    function legalScoreCategories(_ruleset, dice, filledScores) {
        const forced = jokerForcedCategories(dice, filledScores);
        if (forced !== null)
            return forced;
        return remainingCategories(filledScores);
    }
    function factorial(n) { let r = 1; for (let i = 2; i <= n; i++)
        r *= i; return r; }
    function multinomialWeight(total, counts) {
        let denom = 1;
        for (let i = 1; i <= 6; i++)
            denom *= factorial(counts[i]);
        return factorial(total) / denom;
    }
    function distributionForCount(diceCount) {
        const output = [];
        const counts = new Array(7).fill(0);
        function walk(face, remaining) {
            if (face === 7) {
                if (remaining === 0) {
                    const faces = [];
                    for (let v = 1; v <= 6; v++)
                        for (let k = 0; k < counts[v]; k++)
                            faces.push(v);
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
    const DISTRIBUTIONS = [];
    for (let n = 0; n <= DICE_COUNT; n++)
        DISTRIBUTIONS.push(distributionForCount(n));
    // ── Hold mask generation ──
    function pushUnique(masks, mask) { if (!masks.includes(mask))
        masks.push(mask); }
    function maskForFaces(dice, faces) {
        let mask = 0;
        for (let i = 0; i < dice.length; i++)
            if (faces.includes(dice[i]))
                mask |= 1 << i;
        return mask;
    }
    function maskForOneEach(dice, faces) {
        const used = new Set();
        let mask = 0;
        for (let i = 0; i < dice.length; i++) {
            if (faces.includes(dice[i]) && !used.has(dice[i])) {
                used.add(dice[i]);
                mask |= 1 << i;
            }
        }
        return mask;
    }
    function candidateHoldMasks(dice) {
        const masks = [0, (1 << DICE_COUNT) - 1];
        for (let face = 1; face <= 6; face++)
            pushUnique(masks, maskForFaces(dice, [face]));
        const runs = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [1, 2, 3, 4, 5], [2, 3, 4, 5, 6]];
        for (const run of runs)
            pushUnique(masks, maskForOneEach(dice, run));
        let highMask = 0;
        for (let i = 0; i < dice.length; i++)
            if (dice[i] >= 5)
                highMask |= 1 << i;
        pushUnique(masks, highMask);
        for (let i = 0; i < DICE_COUNT; i++)
            pushUnique(masks, 1 << i);
        return masks;
    }
    // ── Dice pattern bonus ──
    function dicePatternBonus(dice) {
        const counts = new Array(7).fill(0);
        for (const v of dice)
            counts[v] += 1;
        let bonus = 0;
        for (let i = 1; i <= 6; i++) {
            switch (counts[i]) {
                case 2:
                    bonus += 2;
                    break;
                case 3:
                    bonus += 6;
                    break;
                case 4:
                    bonus += 10;
                    break;
                case 5:
                    bonus += 15;
                    break;
            }
        }
        const unique = [];
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
                if (consec === 4)
                    bonus += 6;
                if (consec === 5)
                    bonus += 12;
            }
            else
                consec = 1;
        }
        return bonus;
    }
    function scoreUtility(ruleset, dice, cat, filledScores) {
        const result = scoreRoll(ruleset, cat, dice, filledScores);
        let utility = result.totalDelta;
        if (isUpper(cat)) {
            const face = upperFace(cat);
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
                for (const u of UPPER_CATEGORIES) {
                    if (u !== cat && !isFilled(filledScores, u))
                        maxRemaining += maxBaseScore(u);
                }
                const stillPossible = subtotalAfter + maxRemaining >= UPPER_BONUS_THRESHOLD;
                if (stillPossible) {
                    const slots = Math.max(1, UPPER_CATEGORIES.filter(u => u !== cat && !isFilled(filledScores, u)).length);
                    const bonusPerSlot = UPPER_BONUS * (0.25 + 0.4 * timeRatio) / slots;
                    utility += bonusPerSlot;
                }
                else {
                    utility -= UPPER_BONUS * (0.1 + 0.25 * timeRatio);
                }
            }
        }
        const remainingF = remainingCategories(filledScores).length;
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
        }
        else {
            utility += (() => {
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
        }
        return utility;
    }
    function bestScoreValue(ruleset, dice, filledScores, cache) {
        const key = dice.join(",");
        if (cache?.has(key))
            return cache.get(key);
        const legal = legalScoreCategories(ruleset, dice, filledScores);
        let best = -Infinity;
        if (legal.length > 0) {
            const scores = legal.map(c => scoreUtility(ruleset, dice, c, filledScores));
            best = Math.max(...scores);
        }
        if (cache)
            cache.set(key, best);
        return best;
    }
    function holdUtility(ruleset, dice, holdMask, rollsUsed, filledScores, cache) {
        const kept = [];
        for (let i = 0; i < dice.length; i++)
            if (holdMask & (1 << i))
                kept.push(dice[i]);
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
    function actionValue(ruleset, action, dice, rollsUsed, filledScores, cache) {
        if (action.kind === "score")
            return scoreUtility(ruleset, dice, action.category, filledScores);
        return holdUtility(ruleset, dice, action.holdMask, rollsUsed, filledScores, cache);
    }
    function buildCandidateActions(ruleset, dice, rollsUsed, filledScores) {
        const actions = [];
        if (dice.length === 0) {
            actions.push({ kind: "roll", holdMask: 0 });
            return actions;
        }
        for (const cat of legalScoreCategories(ruleset, dice, filledScores))
            actions.push({ kind: "score", category: cat });
        if (rollsUsed < 3) {
            for (const mask of candidateHoldMasks(dice))
                actions.push({ kind: "roll", holdMask: mask });
        }
        return actions;
    }
    function selectAction(dice, rollsUsed, filledScores, yahtzeeBonuses = 0, ruleset = "bbg") {
        const sorted = dice.length > 0 ? sortDice(dice) : [];
        const scores = { ...filledScores };
        if (yahtzeeBonuses > 0 && !(CATEGORY.Yahtzee in scores))
            scores[CATEGORY.Yahtzee] = 50;
        const candidates = buildCandidateActions(ruleset, sorted, rollsUsed, scores);
        if (candidates.length === 0)
            throw new Error("No legal actions available — game is complete");
        const cache = new Map();
        let best = candidates[0];
        let bestValue = -Infinity;
        for (const action of candidates) {
            const value = actionValue(ruleset, action, sorted, rollsUsed, scores, cache);
            if (value > bestValue) {
                bestValue = value;
                best = action;
            }
        }
        if (best.kind === "score")
            return { type: "score", category: best.category };
        return { type: "roll", holdMask: best.holdMask };
    }
    return { selectAction, CATEGORY };
})();

"use strict";
class VersusGame {
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
    setOnUpdate(cb) {
        this.onUpdate = cb;
    }
    notify() {
        if (this.onUpdate)
            this.onUpdate();
    }
    // ── Player actions ──
    roll() {
        if (this.rollsLeft <= 0 || this.gameOver || !this.isPlayerTurn || this.isBotThinking)
            return;
        this.dice.roll();
        this.rollsLeft--;
        this.notify();
    }
    toggleLock(index) {
        if (this.rollsLeft === 3 || !this.isPlayerTurn || this.isBotThinking)
            return;
        this.dice.toggleLock(index);
        this.notify();
    }
    isValidCategorySelection(index, dice) {
        const sc = this.isPlayerTurn ? this.playerScorecard : this.botScorecard;
        if (!sc.canScore(index))
            return false;
        // BBG Joker forced placement (matching upper → open lower → open upper).
        const forced = sc.jokerForcedCategories(dice);
        if (forced !== null)
            return forced.includes(index);
        return true;
    }
    previewScore(index, forPlayer = true) {
        if (this.rollsLeft === 3)
            return null;
        const sc = forPlayer ? this.playerScorecard : this.botScorecard;
        if (!sc.canScore(index))
            return null;
        const dice = this.dice.values();
        if (!this.isValidCategorySelection(index, dice))
            return null;
        const yahtzeeIdx = CATEGORIES.findIndex(c => c.name === 'Yahtzee');
        const isMainYahtzeeFilled = sc.slots[yahtzeeIdx].score !== null;
        if (isYahtzee(dice) && isMainYahtzeeFilled) {
            const upperIdx = dice[0] - 1;
            if (sc.slots[upperIdx].score !== null) {
                const name = sc.slots[index].def.name;
                if (name === 'Full House')
                    return 25;
                if (name === 'Sm Straight')
                    return 30;
                if (name === 'Lg Straight')
                    return 40;
            }
        }
        return sc.slots[index].def.scoreFn(dice);
    }
    selectCategory(index) {
        if (this.rollsLeft === 3 || this.gameOver || !this.isPlayerTurn || this.isBotThinking)
            return false;
        if (!this.isValidCategorySelection(index, this.dice.values()))
            return false;
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
    getBotFilledScores() {
        const scores = {};
        this.botScorecard.slots.forEach((s, i) => {
            if (s.score !== null)
                scores[i] = s.score;
        });
        return scores;
    }
    botDiceSortedWithIndices() {
        const vals = this.dice.values();
        const indexed = vals.map((v, i) => ({ v, i }));
        indexed.sort((a, b) => a.v - b.v);
        return {
            sorted: indexed.map(x => x.v),
            indices: indexed.map(x => x.i),
        };
    }
    botMaskToGameMask(botMask, sortedIndices) {
        let gameMask = 0;
        for (let i = 0; i < 5; i++) {
            if (botMask & (1 << i))
                gameMask |= 1 << sortedIndices[i];
        }
        return gameMask;
    }
    // ── Bot turn execution (async, called after player scores) ──
    async executeBotTurn() {
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
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
                    this.botScorecard.scoreCategory(action.category, this.dice.values());
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
            this.botScorecard.scoreCategory(action.category, this.dice.values());
            this.isBotThinking = false;
            this.advanceTurn();
        }
        catch (e) {
            console.error("Bot turn error:", e);
            this.isBotThinking = false;
            // Fallback: pick first empty category
            const emptyIdx = this.botScorecard.slots.findIndex(s => s.score === null);
            if (emptyIdx >= 0)
                this.botScorecard.scoreCategory(emptyIdx, this.dice.values());
            this.advanceTurn();
        }
    }
    // Recover from an interrupted bot turn (e.g. the page was reloaded while
    // Keiri was thinking). The bot only writes to its scorecard at the very end
    // of its turn, so if isBotThinking is still set the bot had not scored yet —
    // restart its turn cleanly from a fresh roll instead of soft-locking.
    resumeBotTurnIfNeeded() {
        if (this.gameOver || !this.isBotThinking)
            return;
        this.rollsLeft = 3;
        this.dice.unlockAll();
        this.dice.resetValues();
        this.notify();
        this.executeBotTurn();
    }
    advanceTurn() {
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
    getSnapshot() {
        let turnLabel;
        if (this.gameOver) {
            turnLabel = 'Game Over';
        }
        else if (this.isBotThinking) {
            turnLabel = "Keiri's Turn";
        }
        else {
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
    serialize() {
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
    deserialize(data) {
        this.rollsLeft = data.rollsLeft;
        this.round = data.round;
        this.gameOver = data.gameOver;
        this.isPlayerTurn = data.isPlayerTurn;
        this.isBotThinking = data.isBotThinking;
        this.dice.dice = data.dice.map((d) => ({ value: d.value, locked: d.locked }));
        data.playerSlots.forEach((savedSlot) => {
            const slot = this.playerScorecard.slots.find(s => s.def.name === savedSlot.name);
            if (slot)
                slot.score = savedSlot.score;
        });
        this.playerScorecard.bonusYahtzees = data.playerBonusYahtzees;
        data.botSlots.forEach((savedSlot) => {
            const slot = this.botScorecard.slots.find(s => s.def.name === savedSlot.name);
            if (slot)
                slot.score = savedSlot.score;
        });
        this.botScorecard.bonusYahtzees = data.botBonusYahtzees;
    }
    reset() {
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

"use strict";
// ============================================================
//  VERSUS UI RENDERER (dual scorecard with bot)
// ============================================================
class VersusUI {
    constructor() {
        this.el = {};
        this.game = null;
        this.cache();
    }
    cache() {
        const ids = [
            'dice-tray', 'roll-btn', 'rolls-left', 'turn-label', 'high-score-display-header',
            'upper-scores', 'lower-scores',
            'upper-total', 'upper-bonus', 'lower-total', 'grand-total',
            'player-scorecard',
            'upper-scores-bot', 'lower-scores-bot',
            'upper-total-bot', 'upper-bonus-bot', 'lower-total-bot', 'grand-total-bot',
            'game-over-overlay', 'final-score', 'score-breakdown',
            'play-again-btn', 'high-score-display', 'bonus-tracker',
            'bonus-tracker-bot', 'mode-toggle', 'restart-btn',
        ];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el)
                this.el[id] = el;
        }
    }
    pipPositions(value) {
        const patterns = {
            1: [4], 2: [2, 6], 3: [2, 4, 6],
            4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
        };
        return patterns[value] || [];
    }
    createDieHTML(value, locked, index, gameOver, rollStart) {
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
    createScoreRow(slot, index, previewScore, gameOver, selectable, isPlayerSide, bonusYahtzees = 0) {
        const filled = slot.score !== null;
        const canSelect = selectable && !filled && !gameOver && isPlayerSide;
        const cls = filled ? 'score-row filled'
            : (canSelect ? 'score-row empty' : 'score-row empty disabled');
        const data = canSelect ? `data-category="${index}"` : '';
        let scoreDisplay;
        if (filled) {
            let scoreText = String(slot.score);
            if (slot.def.name === 'Yahtzee' && bonusYahtzees > 0) {
                scoreText += ` + ${bonusYahtzees * 100}`;
            }
            scoreDisplay = `<span class="category-score">${scoreText}</span>`;
        }
        else if ((canSelect || !isPlayerSide) && previewScore !== null) {
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
    renderScorecard(scorecard, game, upperContainerId, lowerContainerId, upperTotalId, upperBonusId, lowerTotalId, grandTotalId, bonusTrackerId, isPlayerSide) {
        const sc = isPlayerSide ? game.playerScorecard : game.botScorecard;
        const upperSlots = scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = scorecard.filter(sl => sl.def.section === Section.Lower);
        const diceVals = game.dice.values();
        const s = game.getSnapshot();
        const upperEl = this.el[upperContainerId];
        const lowerEl = this.el[lowerContainerId];
        if (!upperEl || !lowerEl)
            return;
        upperEl.innerHTML = upperSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = (slot.score === null && !s.gameOver && s.rollsLeft < 3)
                ? game.previewScore(globalIdx, isPlayerSide) : null;
            const selectable = isPlayerSide && s.isPlayerTurn && !s.isBotThinking
                && !s.gameOver && s.rollsLeft < 3
                && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable, isPlayerSide, sc.bonusYahtzees);
        }).join('');
        lowerEl.innerHTML = lowerSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = (slot.score === null && !s.gameOver && s.rollsLeft < 3)
                ? game.previewScore(globalIdx, isPlayerSide) : null;
            const selectable = isPlayerSide && s.isPlayerTurn && !s.isBotThinking
                && !s.gameOver && s.rollsLeft < 3
                && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable, isPlayerSide, sc.bonusYahtzees);
        }).join('');
        // Compute totals from the scorecard slots
        this.el[upperTotalId].textContent = String(sc.upperTotal());
        this.el[upperBonusId].textContent = sc.upperBonus() > 0 ? `+${sc.upperBonus()}` : '0';
        this.el[lowerTotalId].textContent = String(sc.lowerTotal());
        this.el[grandTotalId].textContent = String(sc.grandTotal());
        // Bonus tracker
        const tracker = this.el[bonusTrackerId];
        if (tracker) {
            const upperTotal = sc.upperTotal();
            if (upperTotal >= 63) {
                tracker.innerHTML = `<span class="bonus-secured">Bonus Secured: +35</span>`;
            }
            else {
                let potential = upperTotal;
                for (let i = 0; i < 6; i++) {
                    if (sc.slots[i].score === null)
                        potential += 5 * (i + 1);
                }
                if (potential < 63) {
                    tracker.innerHTML = `<span class="bonus-missed">Bonus Missed</span>`;
                }
                else {
                    const diff = 63 - upperTotal;
                    tracker.innerHTML = `<span class="bonus-progress">${diff} points until +35 bonus</span>`;
                }
            }
        }
    }
    render(game) {
        this.game = game;
        const s = game.getSnapshot();
        // Header
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        if (this.el['turn-label']) {
            this.el['turn-label'].textContent = s.turnLabel;
        }
        const isInteractive = s.isPlayerTurn && !s.isBotThinking && !s.gameOver;
        this.el['roll-btn'].disabled = !isInteractive || s.rollsLeft <= 0;
        if (this.el['mode-toggle']) {
            this.el['mode-toggle'].disabled = s.isBotThinking;
        }
        if (this.el['restart-btn']) {
            this.el['restart-btn'].disabled = s.isBotThinking;
        }
        // Dice
        const tray = this.el['dice-tray'];
        tray.innerHTML = s.dice.map((d, i) => this.createDieHTML(d.value, d.locked, i, s.gameOver, s.rollsLeft === 3)).join('');
        // Add rolling animation during bot's pending roll
        if (game.pendingRollAnimation) {
            tray.querySelectorAll('.die:not(.locked)').forEach(die => {
                die.classList.add('rolling');
            });
        }
        // Dice click handlers (only during player turn)
        if (isInteractive) {
            tray.querySelectorAll('.die').forEach(die => {
                die.addEventListener('click', () => {
                    if (!game.isPlayerTurn || game.isBotThinking)
                        return;
                    const idx = parseInt(die.dataset.index);
                    game.toggleLock(idx);
                    this.render(game);
                });
            });
        }
        // Roll button
        this.el['roll-btn'].onclick = () => {
            if (!isInteractive || s.rollsLeft <= 0)
                return;
            const btn = this.el['roll-btn'];
            btn.disabled = true;
            const trayEl = this.el['dice-tray'];
            const diceElements = trayEl.querySelectorAll('.die:not(.locked)');
            diceElements.forEach(die => { die.classList.add('rolling'); });
            setTimeout(() => {
                game.roll();
                this.render(game);
                if (isYahtzee(game.dice.values())) {
                    this.triggerYahtzeeAnimation();
                }
            }, 600);
        };
        // Player scorecard
        this.renderScorecard(s.playerScorecard, game, 'upper-scores', 'lower-scores', 'upper-total', 'upper-bonus', 'lower-total', 'grand-total', 'bonus-tracker', true);
        // Bot scorecard
        if (this.el['upper-scores-bot']) {
            this.renderScorecard(s.botScorecard, game, 'upper-scores-bot', 'lower-scores-bot', 'upper-total-bot', 'upper-bonus-bot', 'lower-total-bot', 'grand-total-bot', 'bonus-tracker-bot', false);
        }
        // Score row click handlers (player side only)
        document.querySelectorAll('#player-scorecard .score-row.empty[data-category]').forEach(row => {
            row.addEventListener('click', () => {
                if (!game.isPlayerTurn || game.isBotThinking || game.gameOver)
                    return;
                const idx = parseInt(row.dataset.category);
                game.selectCategory(idx);
                this.render(game);
            });
        });
        // Game over
        if (s.gameOver) {
            this.showGameOver(game);
        }
        // Play again
        this.el['play-again-btn'].onclick = () => {
            game.reset();
            this.render(game);
            this.el['game-over-overlay'].classList.add('hidden');
        };
    }
    showGameOver(game) {
        const playerTotal = game.playerScorecard.grandTotal();
        const botTotal = game.botScorecard.grandTotal();
        const playerWon = playerTotal > botTotal;
        const tie = playerTotal === botTotal;
        const playerUpper = game.playerScorecard.upperTotal();
        const playerBonus = game.playerScorecard.upperBonus();
        const playerLower = game.playerScorecard.lowerTotal();
        const playerYahtzeeBonus = game.playerScorecard.bonusYahtzees * 100;
        const botUpper = game.botScorecard.upperTotal();
        const botBonus = game.botScorecard.upperBonus();
        const botLower = game.botScorecard.lowerTotal();
        const botYahtzeeBonus = game.botScorecard.bonusYahtzees * 100;
        const resultText = tie ? "It's a Tie!"
            : playerWon ? 'You Win!' : 'Keiri Wins!';
        this.el['final-score'].innerHTML = `${playerTotal} <span class="score-vs-sep">&mdash;</span> ${botTotal}`;
        this.el['score-breakdown'].innerHTML = `
            <div class="breakdown-col">
                <strong>You</strong>
                <span>Upper: ${playerUpper}</span>
                <span>Bonus: ${playerBonus}</span>
                <span>Lower: ${playerLower}</span>
                ${playerYahtzeeBonus > 0 ? `<span>Yahtzee Bonus: ${playerYahtzeeBonus}</span>` : ''}
                <span class="breakdown-total">Total: ${playerTotal}</span>
            </div>
            <div class="breakdown-result ${playerWon ? 'win' : tie ? 'tie' : 'lose'}">${resultText}</div>
            <div class="breakdown-col">
                <strong>Keiri</strong>
                <span>Upper: ${botUpper}</span>
                <span>Bonus: ${botBonus}</span>
                <span>Lower: ${botLower}</span>
                ${botYahtzeeBonus > 0 ? `<span>Yahtzee Bonus: ${botYahtzeeBonus}</span>` : ''}
                <span class="breakdown-total">Total: ${botTotal}</span>
            </div>
        `;
        // High score (player's score in versus mode, separate from solo)
        const highScore = this.loadHighScore();
        const isNewRecord = playerTotal > highScore;
        if (isNewRecord) {
            this.saveHighScore(playerTotal);
            updateHighScoreDisplay();
        }
        const best = Math.max(playerTotal, highScore);
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
    triggerYahtzeeAnimation() {
        const banner = document.getElementById('yahtzee-banner');
        const container = document.getElementById('confetti-container');
        if (!banner || !container)
            return;
        banner.classList.remove('hidden');
        container.innerHTML = '';
        const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4'];
        const pieceCount = 100;
        for (let i = 0; i < pieceCount; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            const color = colors[Math.floor(Math.random() * colors.length)];
            piece.style.backgroundColor = color;
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.animationDelay = `${Math.random() * 1.5}s`;
            piece.style.animationDuration = `${Math.random() * 1.5 + 1.5}s`;
            piece.style.width = `${Math.random() * 6 + 6}px`;
            piece.style.height = `${Math.random() * 12 + 12}px`;
            container.appendChild(piece);
        }
        setTimeout(() => {
            banner.classList.add('hidden');
            container.innerHTML = '';
        }, 3000);
    }
}

"use strict";
// ============================================================
//  Yahtzee — Boot & Mode Switching
// ============================================================
function updateHighScoreDisplay() {
    const el = document.getElementById('high-score-display-header');
    if (!el)
        return;
    try {
        const raw = localStorage.getItem('yahtzee_high_score');
        el.textContent = raw ? String(parseInt(raw, 10) || 0) : '0';
    }
    catch {
        el.textContent = '0';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const gameLayout = document.getElementById('game-layout');
    const modeToggle = document.getElementById('mode-toggle');
    const restartBtn = document.getElementById('restart-btn');
    const botScorecard = document.getElementById('bot-scorecard');
    const turnLabel = document.getElementById('turn-label');
    let isVersusMode = false;
    let soloGame = null;
    let soloUI = null;
    let versusGame = null;
    let versusUI = null;
    function saveGame() {
        const state = {
            isVersusMode: isVersusMode
        };
        if (soloGame) {
            state.soloGame = soloGame.serialize();
        }
        if (versusGame) {
            state.versusGame = versusGame.serialize();
        }
        try {
            localStorage.setItem('yahtzee_save_state', JSON.stringify(state));
        }
        catch (e) {
            console.error('Failed to save game state:', e);
        }
    }
    function loadGame() {
        try {
            const raw = localStorage.getItem('yahtzee_save_state');
            if (!raw)
                return;
            const state = JSON.parse(raw);
            isVersusMode = state.isVersusMode;
            if (state.soloGame) {
                soloGame = new Game();
                soloUI = new UI();
                soloGame.deserialize(state.soloGame);
            }
            if (state.versusGame) {
                versusGame = new VersusGame();
                versusUI = new VersusUI();
                versusGame.deserialize(state.versusGame);
            }
        }
        catch (e) {
            console.error('Failed to load game state:', e);
        }
    }
    function enterSoloMode() {
        isVersusMode = false;
        gameLayout.classList.remove('vs-mode');
        botScorecard.classList.add('hidden');
        turnLabel.classList.add('hidden');
        modeToggle.textContent = 'Challenge Keiri';
        // Hide overlay first (it will be reshown in render if game is over)
        const overlay = document.getElementById('game-over-overlay');
        if (overlay)
            overlay.classList.add('hidden');
        if (!soloGame) {
            soloGame = new Game();
            soloUI = new UI();
        }
        soloGame.setOnUpdate(() => {
            soloUI.render(soloGame);
            saveGame();
        });
        window.soloGame = soloGame;
        window.soloUI = soloUI;
        window.versusGame = versusGame;
        window.versusUI = versusUI;
        soloUI.render(soloGame);
        saveGame();
    }
    function enterVersusMode() {
        isVersusMode = true;
        gameLayout.classList.add('vs-mode');
        botScorecard.classList.remove('hidden');
        turnLabel.classList.remove('hidden');
        modeToggle.textContent = 'Return to Single Player';
        // Hide overlay first (it will be reshown in render if game is over)
        const overlay = document.getElementById('game-over-overlay');
        if (overlay)
            overlay.classList.add('hidden');
        if (!versusGame) {
            versusGame = new VersusGame();
            versusUI = new VersusUI();
        }
        versusGame.setOnUpdate(() => {
            versusUI.render(versusGame);
            saveGame();
        });
        window.versusGame = versusGame;
        window.versusUI = versusUI;
        window.soloGame = soloGame;
        window.soloUI = soloUI;
        versusUI.render(versusGame);
        saveGame();
        // If a bot turn was interrupted (e.g. reload mid-turn), resume it so the
        // game doesn't stay soft-locked with every control disabled.
        versusGame.resumeBotTurnIfNeeded();
    }
    modeToggle.addEventListener('click', () => {
        if (isVersusMode) {
            enterSoloMode();
        }
        else {
            enterVersusMode();
        }
    });
    restartBtn.addEventListener('click', () => {
        // Hide game over overlay if visible
        const overlay = document.getElementById('game-over-overlay');
        if (overlay)
            overlay.classList.add('hidden');
        if (isVersusMode) {
            versusGame = new VersusGame();
            versusGame.setOnUpdate(() => {
                versusUI.render(versusGame);
                saveGame();
            });
            versusUI.render(versusGame);
            saveGame();
        }
        else {
            soloGame = new Game();
            soloGame.setOnUpdate(() => {
                soloUI.render(soloGame);
                saveGame();
            });
            soloUI.render(soloGame);
            saveGame();
        }
    });
    // Load saved game if it exists
    loadGame();
    updateHighScoreDisplay();
    if (isVersusMode) {
        enterVersusMode();
    }
    else {
        enterSoloMode();
    }
});

