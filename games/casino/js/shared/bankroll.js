// The casino's shared chip balance and lifetime stats.
//
// One module owns all bankroll persistence. Yahtzee's solo and versus modes
// accidentally share a high-score key because storage was touched from several
// renderers; nothing here is reachable except through this API.
//
// TWO INVARIANTS THAT MATTER:
//
// 1. The balance is NEVER cached in memory. Every mutation is a synchronous
//    read-modify-write against storage. Two tabs that each cache 1000, wager
//    100 and 50, then write back 900 and 950 have silently destroyed 100 chips
//    — and a `storage` event listener only decides which tab wins. localStorage
//    is synchronous and same-origin JS is single-threaded per task, so doing
//    the whole read-modify-write in one go is effectively atomic across tabs.
//
// 2. Money moves at most once per round. Both takeWager and settle are keyed by
//    roundId and are no-ops if that round already moved, so a double-click,
//    a re-render, or a restored save can't double-charge or double-pay.
//
// This module is deliberately DOM-free: pages wire up the `storage` event
// themselves and call refresh(). That keeps it unit-testable with a fake store.
import { BANKROLL_KEY } from "./keys.js";
export const STARTING_BANKROLL = 1000;
const EMPTY_STATS = {
    handsPlayed: 0,
    totalWagered: 0,
    netProfit: 0,
    biggestWin: 0,
    bestHand: null,
    bestHandStrength: -1,
};
const EMPTY_STATE = {
    v: 1,
    balance: STARTING_BANKROLL,
    stats: EMPTY_STATS,
    lastWageredRound: 0,
    lastSettledRound: 0,
};
function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
/** Coerce whatever is in storage into a usable state. A corrupt or partial
 *  payload degrades to defaults rather than letting NaN leak into the UI, where
 *  it would render as "NaN" forever and make every comparison silently false. */
function coerce(parsed) {
    if (typeof parsed !== 'object' || parsed === null)
        return EMPTY_STATE;
    const raw = parsed;
    if (raw.v !== 1)
        return EMPTY_STATE;
    const stats = (typeof raw.stats === 'object' && raw.stats !== null ? raw.stats : {});
    const bestHand = typeof stats.bestHand === 'string' ? stats.bestHand : null;
    return {
        v: 1,
        balance: Math.max(0, Math.trunc(finite(raw.balance, STARTING_BANKROLL))),
        stats: {
            handsPlayed: Math.max(0, Math.trunc(finite(stats.handsPlayed, 0))),
            totalWagered: Math.max(0, Math.trunc(finite(stats.totalWagered, 0))),
            netProfit: Math.trunc(finite(stats.netProfit, 0)),
            biggestWin: Math.max(0, Math.trunc(finite(stats.biggestWin, 0))),
            bestHand,
            bestHandStrength: bestHand === null ? -1 : Math.trunc(finite(stats.bestHandStrength, -1)),
        },
        lastWageredRound: Math.max(0, Math.trunc(finite(raw.lastWageredRound, 0))),
        lastSettledRound: Math.max(0, Math.trunc(finite(raw.lastSettledRound, 0))),
    };
}
export function createBankroll(storage, persistent = true) {
    const listeners = new Set();
    // Only used when a write fails partway; the read path always hits storage.
    let degraded = !persistent;
    function load() {
        let raw = null;
        try {
            raw = storage.getItem(BANKROLL_KEY);
        }
        catch {
            degraded = true;
            return EMPTY_STATE;
        }
        if (raw === null)
            return EMPTY_STATE;
        try {
            return coerce(JSON.parse(raw));
        }
        catch {
            return EMPTY_STATE;
        }
    }
    function save(state) {
        try {
            storage.setItem(BANKROLL_KEY, JSON.stringify(state));
        }
        catch {
            // Quota exceeded, or storage revoked mid-session.
            degraded = true;
        }
    }
    function snapshotOf(state) {
        return { balance: state.balance, stats: state.stats, persistent: !degraded };
    }
    function emit(state) {
        const snapshot = snapshotOf(state);
        for (const fn of listeners)
            fn(snapshot);
    }
    function commit(state) {
        save(state);
        emit(state);
    }
    function parseWager(input) {
        const cleaned = typeof input === 'number' ? input : Number(String(input).replace(/[,\s]/g, ''));
        if (!Number.isFinite(cleaned))
            return null;
        const amount = Math.trunc(cleaned);
        if (amount <= 0)
            return null;
        if (amount > load().balance)
            return null;
        return amount;
    }
    return {
        read: () => snapshotOf(load()),
        canWager(amount) {
            if (!Number.isInteger(amount) || amount <= 0)
                return false;
            return amount <= load().balance;
        },
        parseWager,
        takeWager(roundId, amount) {
            const state = load();
            if (roundId <= state.lastWageredRound)
                return true; // already charged
            if (!Number.isInteger(amount) || amount <= 0)
                return false;
            if (amount > state.balance)
                return false;
            commit({
                ...state,
                balance: state.balance - amount,
                lastWageredRound: roundId,
            });
            return true;
        },
        settle(roundId, payout, meta) {
            const state = load();
            if (roundId <= state.lastSettledRound)
                return; // already paid
            const credited = Math.max(0, Math.trunc(finite(payout, 0)));
            const wagered = Math.max(0, Math.trunc(finite(meta.wager, 0)));
            const prev = state.stats;
            // Strength 0 is "no hand" — without this floor, the first loss
            // beats the -1 sentinel and the hub proudly reports a best hand of
            // "No Win".
            const beatsBest = meta.handStrength > 0 && meta.handStrength > prev.bestHandStrength;
            commit({
                ...state,
                balance: Math.max(0, state.balance + credited),
                lastSettledRound: roundId,
                stats: {
                    handsPlayed: prev.handsPlayed + 1,
                    totalWagered: prev.totalWagered + wagered,
                    netProfit: prev.netProfit + credited - wagered,
                    biggestWin: Math.max(prev.biggestWin, credited),
                    bestHand: beatsBest ? meta.handLabel : prev.bestHand,
                    bestHandStrength: beatsBest ? meta.handStrength : prev.bestHandStrength,
                },
            });
        },
        rebuy() {
            const state = load();
            if (state.balance >= STARTING_BANKROLL)
                return;
            commit({ ...state, balance: STARTING_BANKROLL });
        },
        hardReset() {
            try {
                storage.removeItem(BANKROLL_KEY);
            }
            catch {
                degraded = true;
            }
            commit(EMPTY_STATE);
        },
        refresh() {
            emit(load());
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}
/** In-memory stand-in so the game still runs when storage is unavailable. */
export function memoryStorage() {
    const map = new Map();
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
    };
}
let shared = null;
/**
 * The page-wide bankroll. Created on first call, not at import time, so that
 * importing this module never touches storage.
 */
export function getBankroll() {
    if (shared)
        return shared;
    // Merely ACCESSING localStorage throws in some sandboxed contexts, so the
    // feature detection has to live inside the try as well.
    try {
        const probe = globalThis.localStorage;
        const canary = '__casino_probe__';
        probe.setItem(canary, '1');
        probe.removeItem(canary);
        shared = createBankroll(probe, true);
    }
    catch {
        shared = createBankroll(memoryStorage(), false);
    }
    return shared;
}
