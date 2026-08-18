// Poker table bootstrap: owns the round state and wires the machine, the
// bankroll, and the renderer together.
import { getBankroll } from "../shared/bankroll.js";
import { BANKROLL_KEY, POKER_ROUND_KEY } from "../shared/keys.js";
import { dealDeck } from "../shared/deck.js";
import { HAND_STRENGTH } from "./hands.js";
import { deserializeRound, draw, initialState, newRound, nextRound, serializeRound, toggleHold, } from "./machine.js";
import { createUI } from "./ui.js";
const DEFAULT_WAGER = 25;
const bankroll = getBankroll();
let state = initialState();
let wagerText = String(DEFAULT_WAGER);
// --- round persistence -----------------------------------------------------
//
// The wager is taken at deal, so without this a mid-hand reload would pocket
// the bet and leave no hand to play out.
function saveRound() {
    try {
        if (state.phase === 'dealt') {
            localStorage.setItem(POKER_ROUND_KEY, serializeRound(state));
        }
        else {
            localStorage.removeItem(POKER_ROUND_KEY);
        }
    }
    catch {
        // Storage unavailable; the bankroll UI already warns about this.
    }
}
function restoreRound() {
    let raw = null;
    try {
        raw = localStorage.getItem(POKER_ROUND_KEY);
    }
    catch {
        return;
    }
    const restored = deserializeRound(raw);
    if (restored) {
        state = restored;
        wagerText = String(restored.wager);
    }
}
// --- view model ------------------------------------------------------------
function currentWager() {
    return bankroll.parseWager(wagerText);
}
function render() {
    const snapshot = bankroll.read();
    ui.render({
        state,
        balance: snapshot.balance,
        persistent: snapshot.persistent,
        wagerText,
        wagerValid: currentWager() !== null,
    });
}
// --- actions ---------------------------------------------------------------
function startRound() {
    if (state.phase !== 'betting')
        return;
    const wager = currentWager();
    if (wager === null)
        return;
    // Deal into a candidate state FIRST, then charge. Deducting before a deal
    // that could throw would destroy the wager.
    const candidate = newRound(state, wager, dealDeck());
    if (!bankroll.takeWager(candidate.roundId, wager))
        return;
    state = candidate;
    saveRound();
    render();
}
function finishRound() {
    if (state.phase !== 'dealt')
        return;
    const resolved = draw(state);
    state = resolved;
    // Idempotent per roundId, so a double-click or a re-render can't double-pay.
    bankroll.settle(resolved.roundId, resolved.payout, {
        wager: resolved.wager,
        handLabel: resolved.result.label,
        handStrength: HAND_STRENGTH[resolved.result.rank],
    });
    saveRound();
    render();
    ui.focusResult();
}
function beginNextRound() {
    if (state.phase !== 'resolved')
        return;
    state = nextRound(state);
    // Offer the same stake again, trimmed to what's left in the bank.
    const snapshot = bankroll.read();
    const previous = Number(wagerText);
    if (Number.isFinite(previous) && previous > snapshot.balance) {
        wagerText = String(Math.max(0, snapshot.balance));
    }
    saveRound();
    render();
}
const ui = createUI({
    onHold(index) {
        const next = toggleHold(state, index);
        if (next === state)
            return; // wrong phase — nothing to redraw
        state = next;
        saveRound();
        render();
    },
    onPrimary() {
        // Phase decides the action, rather than trusting the disabled
        // attribute — a held Enter key repeats faster than a re-render.
        if (state.phase === 'betting')
            startRound();
        else if (state.phase === 'dealt')
            finishRound();
        else
            beginNextRound();
    },
    onRebuy() {
        bankroll.rebuy();
        render();
    },
    onWagerInput(raw) {
        wagerText = raw;
        render();
    },
    onWagerQuick(kind) {
        const { balance } = bankroll.read();
        const current = currentWager() ?? 0;
        const next = kind === 'max' ? balance
            : kind === 'half' ? Math.max(1, Math.floor(current / 2))
                : Math.min(balance, current * 2 || 1);
        wagerText = String(Math.max(0, next));
        render();
    },
});
// Another tab may have changed the balance, or hard-reset it. (key === null
// means storage was cleared wholesale.)
window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === BANKROLL_KEY) {
        bankroll.refresh();
        render();
    }
});
restoreRound();
render();
