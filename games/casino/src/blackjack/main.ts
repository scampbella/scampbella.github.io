import { getBankroll } from '../shared/bankroll.ts';
import { dealDeck } from '../shared/deck.ts';
import { BANKROLL_KEY, BLACKJACK_ROUND_KEY, CASINO_SETTINGS_KEY } from '../shared/keys.ts';
import { applyCasinoSettings, readCasinoSettings } from '../shared/settings.ts';
import type { BlackjackState, ResolvedState } from './machine.ts';
import { deserializeRound, doubleDown, hit, initialState, newRound, nextRound, serializeRound, stand } from './machine.ts';
import { createUI } from './ui.ts';

applyCasinoSettings(readCasinoSettings());
const bankroll = getBankroll();
let state: BlackjackState = initialState(bankroll.allocateRoundId());
let wagerText = '';

function saveRound(): void {
    try {
        if (state.phase === 'playing') localStorage.setItem(BLACKJACK_ROUND_KEY, serializeRound(state));
        else localStorage.removeItem(BLACKJACK_ROUND_KEY);
    } catch { /* Bankroll UI already reports unavailable storage. */ }
}

function restoreRound(): void {
    let raw: string | null = null;
    try { raw = localStorage.getItem(BLACKJACK_ROUND_KEY); } catch { return; }
    const restored = deserializeRound(raw);
    if (restored) { state = restored; wagerText = String(restored.wager); }
}

function currentWager(): number | null { return bankroll.parseWager(wagerText); }

function render(): void {
    const snapshot = bankroll.read();
    const wager = currentWager();
    ui.render({
        state,
        balance: snapshot.balance,
        persistent: snapshot.persistent,
        wagerText,
        wagerValid: wager !== null,
        canDouble: state.phase === 'playing' && state.player.length === 2 && snapshot.balance >= state.wager,
    });
}

function settleRound(resolved: ResolvedState): void {
    state = resolved;
    const labels = {
        blackjack: 'Blackjack', win: 'Blackjack win', push: 'Push', loss: 'Dealer win', bust: 'Bust',
    } as const;
    bankroll.settle(resolved.roundId, resolved.payout, {
        wager: resolved.wager,
        gameId: 'blackjack',
        gameLabel: 'Blackjack',
        handLabel: labels[resolved.outcome],
        handStrength: 0,
    });
    saveRound();
    render();
    ui.focusResult();
}

function startRound(): void {
    if (state.phase !== 'betting') return;
    if (bankroll.read().balance <= 0) { ui.showOutOfChips(); return; }
    const wager = currentWager();
    if (wager === null) return;
    const candidate = newRound(state, wager, dealDeck());
    if (!bankroll.takeWager(candidate.roundId, wager)) return;
    state = candidate;
    if (candidate.phase === 'resolved') settleRound(candidate);
    else { saveRound(); render(); }
}

function beginNextRound(): void {
    if (state.phase !== 'resolved') return;
    state = nextRound(state, bankroll.allocateRoundId());
    const balance = bankroll.read().balance;
    if (Number(wagerText) > balance) wagerText = balance > 0 ? String(balance) : '';
    render();
}

const ui = createUI({
    onPrimary() {
        if (state.phase === 'betting') startRound();
        else if (state.phase === 'resolved') beginNextRound();
    },
    onHit() {
        if (state.phase !== 'playing') return;
        const next = hit(state);
        state = next;
        if (next.phase === 'resolved') settleRound(next);
        else { saveRound(); render(); }
    },
    onStand() { if (state.phase === 'playing') settleRound(stand(state)); },
    onDouble() {
        if (state.phase !== 'playing' || state.player.length !== 2 || bankroll.read().balance < state.wager) return;
        const extraChargeId = bankroll.allocateRoundId();
        if (!bankroll.takeWager(extraChargeId, state.wager)) return;
        // The extra charge has the newest casino-wide transaction ID. Use it
        // for settlement as well so another tab cannot settle a newer hand in
        // between and make this doubled hand look stale.
        settleRound({ ...doubleDown(state), roundId: extraChargeId });
    },
    onWagerInput(raw) { wagerText = raw.replace(/\D/g, ''); render(); },
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

window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === BANKROLL_KEY) { bankroll.refresh(); render(); }
    if (event.key === null || event.key === CASINO_SETTINGS_KEY) applyCasinoSettings(readCasinoSettings());
});

restoreRound();
render();
