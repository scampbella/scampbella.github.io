// ============================================================
//  Yahtzee — Boot & Mode Switching
// ============================================================

function updateHighScoreDisplay(): void {
    const el = document.getElementById('high-score-display-header');
    if (!el) return;
    try {
        const raw = localStorage.getItem('yahtzee_high_score');
        el.textContent = raw ? String(parseInt(raw, 10) || 0) : '0';
    } catch {
        el.textContent = '0';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const gameLayout = document.getElementById('game-layout')!;
    const modeToggle = document.getElementById('mode-toggle') as HTMLButtonElement;
    const botScorecard = document.getElementById('bot-scorecard')!;
    const turnLabel = document.getElementById('turn-label')!;

    let isVersusMode = false;
    let soloGame: Game | null = null;
    let soloUI: UI | null = null;
    let versusGame: VersusGame | null = null;
    let versusUI: VersusUI | null = null;

    function enterSoloMode(): void {
        versusGame = null;
        versusUI = null;

        isVersusMode = false;
        gameLayout.classList.remove('vs-mode');
        botScorecard.classList.add('hidden');
        turnLabel.classList.add('hidden');
        modeToggle.textContent = 'Challenge Keiri';

        soloGame = new Game();
        soloUI = new UI();
        soloUI.render(soloGame);
    }

    function enterVersusMode(): void {
        soloGame = null;
        soloUI = null;

        isVersusMode = true;
        gameLayout.classList.add('vs-mode');
        botScorecard.classList.remove('hidden');
        turnLabel.classList.remove('hidden');
        modeToggle.textContent = 'Return to Single Player';

        versusGame = new VersusGame();
        versusUI = new VersusUI();
        versusGame.setOnUpdate(() => versusUI!.render(versusGame!));
        versusUI.render(versusGame);
    }

    modeToggle.addEventListener('click', () => {
        if (isVersusMode) {
            enterSoloMode();
        } else {
            enterVersusMode();
        }
    });

    // Start in solo mode
    updateHighScoreDisplay();
    enterSoloMode();
});
