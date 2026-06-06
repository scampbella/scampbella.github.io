// ============================================================
//  VERSUS UI RENDERER (dual scorecard with bot)
// ============================================================

class VersusUI {
    el: Record<string, HTMLElement>;
    private game: VersusGame | null;

    constructor() {
        this.el = {};
        this.game = null;
        this.cache();
    }

    private cache(): void {
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
            if (el) this.el[id] = el;
        }
    }

    private pipPositions(value: number): number[] {
        const patterns: Record<number, number[]> = {
            1: [4], 2: [2, 6], 3: [2, 4, 6],
            4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
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
        slot: ScoreSlot, index: number, previewScore: number | null,
        gameOver: boolean, selectable: boolean, isPlayerSide: boolean,
        bonusYahtzees: number = 0,
    ): string {
        const filled = slot.score !== null;
        const canSelect = selectable && !filled && !gameOver && isPlayerSide;
        const cls = filled ? 'score-row filled'
            : (canSelect ? 'score-row empty' : 'score-row empty disabled');
        const data = canSelect ? `data-category="${index}"` : '';
        let scoreDisplay: string;
        if (filled) {
            let scoreText = String(slot.score);
            if (slot.def.name === 'Yahtzee' && bonusYahtzees > 0) {
                scoreText += ` + ${bonusYahtzees * 100}`;
            }
            scoreDisplay = `<span class="category-score">${scoreText}</span>`;
        } else if ((canSelect || !isPlayerSide) && previewScore !== null) {
            scoreDisplay = `<span class="category-score preview-score">${previewScore}</span>`;
        } else {
            scoreDisplay = `<span class="category-score empty-score">—</span>`;
        }
        return `<div class="${cls}" ${data}>
            <span class="category-name">${slot.def.name}</span>
            ${scoreDisplay}
        </div>`;
    }

    private renderScorecard(
        scorecard: ScoreSlot[],
        game: VersusGame,
        upperContainerId: string,
        lowerContainerId: string,
        upperTotalId: string,
        upperBonusId: string,
        lowerTotalId: string,
        grandTotalId: string,
        bonusTrackerId: string,
        isPlayerSide: boolean,
    ): void {
        const sc = isPlayerSide ? game.playerScorecard : game.botScorecard;
        const upperSlots = scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = scorecard.filter(sl => sl.def.section === Section.Lower);
        const diceVals = game.dice.values();
        const s = game.getSnapshot();

        const upperEl = this.el[upperContainerId];
        const lowerEl = this.el[lowerContainerId];
        if (!upperEl || !lowerEl) return;

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
            } else {
                let potential = upperTotal;
                for (let i = 0; i < 6; i++) {
                    if (sc.slots[i].score === null) potential += 5 * (i + 1);
                }
                if (potential < 63) {
                    tracker.innerHTML = `<span class="bonus-missed">Bonus Missed</span>`;
                } else {
                    const diff = 63 - upperTotal;
                    tracker.innerHTML = `<span class="bonus-progress">${diff} points until +35 bonus</span>`;
                }
            }
        }
    }

    render(game: VersusGame): void {
        this.game = game;
        const s = game.getSnapshot();

        // Header
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        if (this.el['turn-label']) {
            this.el['turn-label'].textContent = s.turnLabel;
        }

        const isInteractive = s.isPlayerTurn && !s.isBotThinking && !s.gameOver;
        (this.el['roll-btn'] as HTMLButtonElement).disabled = !isInteractive || s.rollsLeft <= 0;
        if (this.el['mode-toggle']) {
            (this.el['mode-toggle'] as HTMLButtonElement).disabled = s.isBotThinking;
        }
        if (this.el['restart-btn']) {
            (this.el['restart-btn'] as HTMLButtonElement).disabled = s.isBotThinking;
        }

        // Dice
        const tray = this.el['dice-tray'] as HTMLElement;
        tray.innerHTML = s.dice.map((d, i) =>
            this.createDieHTML(d.value, d.locked, i, s.gameOver, s.rollsLeft === 3)
        ).join('');

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
                    if (!game.isPlayerTurn || game.isBotThinking) return;
                    const idx = parseInt((die as HTMLElement).dataset.index!);
                    game.toggleLock(idx);
                    this.render(game);
                });
            });
        }

        // Roll button
        this.el['roll-btn'].onclick = () => {
            if (!isInteractive || s.rollsLeft <= 0) return;
            const btn = this.el['roll-btn'] as HTMLButtonElement;
            btn.disabled = true;
            const trayEl = this.el['dice-tray'] as HTMLElement;
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
        this.renderScorecard(
            s.playerScorecard, game,
            'upper-scores', 'lower-scores',
            'upper-total', 'upper-bonus', 'lower-total', 'grand-total',
            'bonus-tracker', true,
        );

        // Bot scorecard
        if (this.el['upper-scores-bot']) {
            this.renderScorecard(
                s.botScorecard, game,
                'upper-scores-bot', 'lower-scores-bot',
                'upper-total-bot', 'upper-bonus-bot', 'lower-total-bot', 'grand-total-bot',
                'bonus-tracker-bot', false,
            );
        }

        // Score row click handlers (player side only)
        document.querySelectorAll('#player-scorecard .score-row.empty[data-category]').forEach(row => {
            row.addEventListener('click', () => {
                if (!game.isPlayerTurn || game.isBotThinking || game.gameOver) return;
                const idx = parseInt((row as HTMLElement).dataset.category!);
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

    showGameOver(game: VersusGame): void {
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

    private loadHighScore(): number {
        try {
            const raw = localStorage.getItem('yahtzee_high_score');
            return raw ? parseInt(raw, 10) || 0 : 0;
        } catch { return 0; }
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
