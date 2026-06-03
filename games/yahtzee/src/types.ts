// ============================================================
//  Yahtzee — Types & Interfaces
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

// --- Versus Game State for UI -----------------
interface VersusGameStateSnapshot {
    dice: DieState[];
    rollsLeft: number;
    round: number;
    playerScorecard: ScoreSlot[];
    botScorecard: ScoreSlot[];
    gameOver: boolean;
    isPlayerTurn: boolean;
    isBotThinking: boolean;
    playerFinalScore: number;
    botFinalScore: number;
    turnLabel: string;
}
