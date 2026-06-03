class UI {
    el: Record<string, HTMLElement>;

    constructor() {
        this.el = {};
        this.cache();
    }

    private cache(): void {
        const ids = [
            'dice-tray', 'roll-btn', 'rolls-left', 'high-score-display-header',
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
        gameOver: boolean, selectable: boolean,
    ): string {
        const filled = slot.score !== null;
        const canSelect = selectable && !filled && !gameOver;
        const cls = filled ? 'score-row filled'
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
        this.el['rolls-left'].textContent = String(s.rollsLeft);
        (this.el['roll-btn'] as HTMLButtonElement).disabled = s.rollsLeft <= 0 || s.gameOver;
        const tray = this.el['dice-tray'] as HTMLElement;
        tray.innerHTML = s.dice.map((d, i) =>
            this.createDieHTML(d.value, d.locked, i, s.gameOver, s.rollsLeft === 3)
        ).join('');

        tray.querySelectorAll('.die').forEach(die => {
            die.addEventListener('click', () => {
                if (s.gameOver) return;
                const idx = parseInt((die as HTMLElement).dataset.index!);
                game.toggleLock(idx);
                this.render(game);
            });
        });

        this.el['roll-btn'].onclick = () => {
            if (s.rollsLeft <= 0 || s.gameOver) return;
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

        const upperSlots = s.scorecard.filter(sl => sl.def.section === Section.Upper);
        const lowerSlots = s.scorecard.filter(sl => sl.def.section === Section.Lower);
        const diceVals = s.dice.map(d => d.value);

        this.el['upper-scores'].innerHTML = upperSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable);
        }).join('');

        this.el['lower-scores'].innerHTML = lowerSlots.map((slot, i) => {
            const globalIdx = CATEGORIES.findIndex(c => c.name === slot.def.name);
            const preview = slot.score === null ? game.previewScore(globalIdx) : null;
            const selectable = !s.gameOver && s.rollsLeft < 3 && game.isValidCategorySelection(globalIdx, diceVals);
            return this.createScoreRow(slot, globalIdx, preview, s.gameOver, selectable);
        }).join('');

        // Upper Section Bonus Tracker
        const tracker = this.el['bonus-tracker'];
        if (tracker) {
            const upperTotal = game.scorecard.upperTotal();
            if (upperTotal >= 63) {
                tracker.innerHTML = `<span class="bonus-secured">Bonus Secured: +35</span>`;
            } else {
                let potential = upperTotal;
                for (let i = 0; i < 6; i++) {
                    if (game.scorecard.slots[i].score === null) potential += 5 * (i + 1);
                }
                if (potential < 63) {
                    tracker.innerHTML = `<span class="bonus-missed">Bonus Missed</span>`;
                } else {
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
                const idx = parseInt((row as HTMLElement).dataset.category!);
                game.selectCategory(idx);
                this.render(game);
                if (game.gameOver) this.showGameOver(game);
            });
        });

        if (s.gameOver) this.showGameOver(game);

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
