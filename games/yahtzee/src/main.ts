// ============================================================
//  Yahtzee — Boot & Mode Switching
// ============================================================

// High scores are tracked separately per mode. Solo keeps the original key so
// existing records are preserved; versus uses its own. (UI classes read/write
// these same keys — keep them in sync: see ui.ts and versus-ui.ts.)
const SOLO_HIGH_SCORE_KEY = 'yahtzee_high_score';
const VERSUS_HIGH_SCORE_KEY = 'yahtzee_high_score_versus';

// Current mode. Hoisted to module scope so updateHighScoreDisplay() can pick the
// matching high-score key; the boot closure below reads and writes it.
let isVersusMode = false;

function updateHighScoreDisplay(): void {
    const el = document.getElementById('high-score-display-header');
    if (!el) return;
    try {
        const key = isVersusMode ? VERSUS_HIGH_SCORE_KEY : SOLO_HIGH_SCORE_KEY;
        const raw = localStorage.getItem(key);
        el.textContent = raw ? String(parseInt(raw, 10) || 0) : '0';
    } catch {
        el.textContent = '0';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const gameLayout = document.getElementById('game-layout')!;
    const modeToggle = document.getElementById('mode-toggle') as HTMLButtonElement;
    const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
    const botScorecard = document.getElementById('bot-scorecard')!;
    const turnLabel = document.getElementById('turn-label')!;

    let soloGame: Game | null = null;
    let soloUI: UI | null = null;
    let versusGame: VersusGame | null = null;
    let versusUI: VersusUI | null = null;
    function saveGame(): void {
        const state: any = {
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
        } catch (e) {
            console.error('Failed to save game state:', e);
        }
    }
    function loadGame(): void {
        try {
            const raw = localStorage.getItem('yahtzee_save_state');
            if (!raw) return;
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
        } catch (e) {
            console.error('Failed to load game state:', e);
        }
    }

    function enterSoloMode(): void {
        isVersusMode = false;
        gameLayout.classList.remove('vs-mode');
        botScorecard.classList.add('hidden');
        turnLabel.classList.add('hidden');
        modeToggle.textContent = 'Challenge Keiri';
        // Hide overlay first (it will be reshown in render if game is over)
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.classList.add('hidden');
        if (!soloGame) {
            soloGame = new Game();
            soloUI = new UI();
        }
        soloGame.setOnUpdate(() => {
            soloUI!.render(soloGame!);
            saveGame();
        });
        (window as any).soloGame = soloGame;
        (window as any).soloUI = soloUI;
        (window as any).versusGame = versusGame;
        (window as any).versusUI = versusUI;
        updateHighScoreDisplay();
        soloUI!.render(soloGame);
        saveGame();
    }

    function enterVersusMode(): void {
        isVersusMode = true;
        gameLayout.classList.add('vs-mode');
        botScorecard.classList.remove('hidden');
        turnLabel.classList.remove('hidden');
        modeToggle.textContent = 'Return to Single Player';
        // Hide overlay first (it will be reshown in render if game is over)
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.classList.add('hidden');
        if (!versusGame) {
            versusGame = new VersusGame();
            versusUI = new VersusUI();
        }
        versusGame.setOnUpdate(() => {
            versusUI!.render(versusGame!);
            saveGame();
        });
        (window as any).versusGame = versusGame;
        (window as any).versusUI = versusUI;
        (window as any).soloGame = soloGame;
        (window as any).soloUI = soloUI;
        updateHighScoreDisplay();
        versusUI!.render(versusGame);
        saveGame();
        // If a bot turn was interrupted (e.g. reload mid-turn), resume it so the
        // game doesn't stay soft-locked with every control disabled.
        versusGame.resumeBotTurnIfNeeded();
    }

    modeToggle.addEventListener('click', () => {
        if (isVersusMode) {
            enterSoloMode();
        } else {
            enterVersusMode();
        }
    });
    restartBtn.addEventListener('click', () => {
        // Hide game over overlay if visible
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.classList.add('hidden');
        if (isVersusMode) {
            versusGame = new VersusGame();
            versusGame.setOnUpdate(() => {
                versusUI!.render(versusGame!);
                saveGame();
            });
            versusUI!.render(versusGame);
            saveGame();
        } else {
            soloGame = new Game();
            soloGame.setOnUpdate(() => {
                soloUI!.render(soloGame!);
                saveGame();
            });
            soloUI!.render(soloGame);
            saveGame();
        }
    });

    // Load saved game if it exists
    loadGame();
    updateHighScoreDisplay();
    if (isVersusMode) {
        enterVersusMode();
    } else {
        enterSoloMode();
    }
});
