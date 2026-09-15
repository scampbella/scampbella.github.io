// Run: npm run test:casino

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card, Hand, Rank, Suit } from '../shared/cards.ts';
import { cardId } from '../shared/cards.ts';
import { dealDeck, freshDeck } from '../shared/deck.ts';
import { HAND_RANKS } from './hands.ts';
import type { DealtState } from './machine.ts';
import {
    CARDS_PER_ROUND,
    deserializeRound,
    draw,
    initialState,
    newRound,
    nextRound,
    serializeRound,
    toggleHold,
} from './machine.ts';

const RANK_CHARS: Record<string, Rank> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** `cards('AS KS QS JS TS 2C 3C 4C 5C 6C')` — any length. */
function cards(spec: string): Card[] {
    return spec.trim().split(/\s+/).map((token) => ({
        rank: RANK_CHARS[token.slice(0, -1).toUpperCase()]!,
        suit: token.slice(-1).toUpperCase() as Suit,
    }));
}

/** Deal these exact ten cards: five on the table, five in reserve. */
function dealt(spec: string, wager = 10): DealtState {
    return newRound(initialState(), wager, cards(spec));
}

// --- dealing ---------------------------------------------------------------

test('a round takes the first five cards and reserves the next five', () => {
    const state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C', 25);
    assert.equal(state.phase, 'dealt');
    assert.equal(state.wager, 25);
    assert.deepEqual(state.hand.map(cardId), ['14S', '13S', '12S', '11S', '10S']);
    assert.deepEqual(state.replacements.map(cardId), ['2C', '3C', '4C', '5C', '6C']);
    assert.deepEqual(state.held, [false, false, false, false, false]);
});

test('rejects a short deck, a bad wager, and duplicate cards', () => {
    assert.throws(() => newRound(initialState(), 10, cards('AS KS QS JS TS')), /at least 10 cards/);
    assert.throws(() => dealt('AS KS QS JS TS 2C 3C 4C 5C 6C', 0), /positive integer/);
    assert.throws(() => dealt('AS KS QS JS TS 2C 3C 4C 5C 6C', 2.5), /positive integer/);
    assert.throws(() => dealt('AS AS QS JS TS 2C 3C 4C 5C 6C'), /duplicate card/);
});

test('a real shuffled deck always yields ten distinct cards', () => {
    for (let i = 0; i < 200; i++) {
        const state = newRound(initialState(), 1, dealDeck());
        const ids = new Set([...state.hand, ...state.replacements].map(cardId));
        assert.equal(ids.size, CARDS_PER_ROUND);
    }
});

// --- holding ---------------------------------------------------------------

test('toggleHold flips one position and leaves the rest alone', () => {
    const state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C');
    const held = toggleHold(toggleHold(state, 0), 3);
    assert.deepEqual((held as DealtState).held, [true, false, false, true, false]);

    const unheld = toggleHold(held, 0);
    assert.deepEqual((unheld as DealtState).held, [false, false, false, true, false]);
});

test('toggleHold outside the dealt phase is a same-reference no-op', () => {
    const betting = initialState();
    assert.equal(toggleHold(betting, 2), betting);

    const resolved = draw(dealt('AS KS QS JS TS 2C 3C 4C 5C 6C'));
    assert.equal(toggleHold(resolved, 2), resolved);
});

test('an out-of-range hold index throws', () => {
    const state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C');
    assert.throws(() => toggleHold(state, 5), /0-4/);
    assert.throws(() => toggleHold(state, -1), /0-4/);
    assert.throws(() => toggleHold(state, 1.5), /0-4/);
});

// --- drawing ---------------------------------------------------------------

test('draw replaces exactly the unheld positions', () => {
    let state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C');
    state = toggleHold(toggleHold(state, 0), 2) as DealtState;

    const resolved = draw(state);
    // Held 0 and 2 keep AS and QS; 1, 3, 4 take replacements 3C, 5C, 6C.
    assert.deepEqual(resolved.hand.map(cardId), ['14S', '3C', '12S', '5C', '6C']);
    assert.deepEqual(resolved.dealtHand.map(cardId), ['14S', '13S', '12S', '11S', '10S']);
});

test('holding everything keeps the hand identical', () => {
    let state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C');
    for (let i = 0; i < 5; i++) state = toggleHold(state, i) as DealtState;

    const resolved = draw(state);
    assert.deepEqual(resolved.hand.map(cardId), ['14S', '13S', '12S', '11S', '10S']);
    assert.equal(resolved.result.rank, HAND_RANKS.ROYAL_FLUSH);
});

test('holding nothing takes the whole reserve', () => {
    const resolved = draw(dealt('AS KS QS JS TS 2C 3C 4C 5C 6C'));
    assert.deepEqual(resolved.hand.map(cardId), ['2C', '3C', '4C', '5C', '6C']);
    assert.equal(resolved.result.rank, HAND_RANKS.STRAIGHT_FLUSH);
});

test('the final hand can never contain a duplicate, whatever is held', () => {
    // Every one of the 32 hold combinations, over many real shuffles.
    for (let i = 0; i < 50; i++) {
        const base = newRound(initialState(), 1, dealDeck());
        for (let mask = 0; mask < 32; mask++) {
            let state = base;
            for (let bit = 0; bit < 5; bit++) {
                if (mask & (1 << bit)) state = toggleHold(state, bit) as DealtState;
            }
            const ids = new Set(draw(state).hand.map(cardId));
            assert.equal(ids.size, 5, `mask ${mask}`);
        }
    }
});

test('payout is wager x multiplier, and zero on a loss', () => {
    // Hold the royal: 10 x 800.
    let win = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C', 10);
    for (let i = 0; i < 5; i++) win = toggleHold(win, i) as DealtState;
    assert.equal(draw(win).payout, 8000);

    // Draw into junk.
    const lose = draw(dealt('2C 3D 4H 5S 7C AS KD 9H 4S 2D', 10));
    assert.equal(lose.result.rank, HAND_RANKS.NOTHING);
    assert.equal(lose.payout, 0);
});

// --- phase discipline ------------------------------------------------------

test('out-of-order transitions throw', () => {
    const betting = initialState();
    const state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C');
    const resolved = draw(state);

    assert.throws(() => draw(betting as unknown as DealtState), /dealt phase/);
    assert.throws(() => draw(resolved as unknown as DealtState), /dealt phase/);
    assert.throws(() => newRound(state as never, 10, freshDeck()), /betting phase/);
    assert.throws(() => nextRound(state as never), /resolved phase/);
});

test('nextRound clears the table and advances the counter', () => {
    const resolved = draw(dealt('AS KS QS JS TS 2C 3C 4C 5C 6C'));
    const next = nextRound(resolved);
    assert.deepEqual(next, { phase: 'betting', roundId: resolved.roundId + 1 });
});

// --- persistence -----------------------------------------------------------

test('a dealt round survives a save/load cycle', () => {
    let state = dealt('AS KS QS JS TS 2C 3C 4C 5C 6C', 75);
    state = toggleHold(toggleHold(state, 1), 4) as DealtState;

    const restored = deserializeRound(serializeRound(state));
    assert.deepEqual(restored, state);

    // And it still draws to the same result it would have before the reload.
    assert.deepEqual(draw(restored!).hand.map(cardId), draw(state).hand.map(cardId));
});

test('corrupt, stale, or truncated saves return null instead of throwing', () => {
    assert.equal(deserializeRound(null), null);
    assert.equal(deserializeRound(''), null);
    assert.equal(deserializeRound('not json'), null);
    assert.equal(deserializeRound('{}'), null);
    assert.equal(deserializeRound('[]'), null);
    assert.equal(deserializeRound('null'), null);

    const good = JSON.parse(serializeRound(dealt('AS KS QS JS TS 2C 3C 4C 5C 6C')));

    assert.equal(deserializeRound(JSON.stringify({ ...good, v: 2 })), null, 'old schema version');
    assert.equal(deserializeRound(JSON.stringify({ ...good, wager: -5 })), null, 'negative wager');
    assert.equal(deserializeRound(JSON.stringify({ ...good, hand: good.hand.slice(0, 4) })), null, 'short hand');
    assert.equal(deserializeRound(JSON.stringify({ ...good, held: [1, 2, 3, 4, 5] })), null, 'non-boolean holds');
    assert.equal(
        deserializeRound(JSON.stringify({ ...good, hand: [...good.hand.slice(0, 4), good.replacements[0]] })),
        null,
        'card duplicated across hand and reserve',
    );
    assert.equal(
        deserializeRound(JSON.stringify({ ...good, hand: [...good.hand.slice(0, 4), { rank: 99, suit: 'S' }] })),
        null,
        'impossible rank',
    );
    assert.equal(
        deserializeRound(JSON.stringify({ ...good, hand: [...good.hand.slice(0, 4), { rank: 5, suit: 'X' }] })),
        null,
        'impossible suit',
    );
});

// --- the shuffle itself ----------------------------------------------------

test('shuffling produces a full 52-card permutation', () => {
    const ids = new Set(dealDeck().map(cardId));
    assert.equal(ids.size, 52);
    assert.equal(new Set(freshDeck().map(cardId)).size, 52);
});

test('every card reaches every position eventually', () => {
    // Cheap sanity check against a shuffle that only rotates or barely moves.
    const firstSeen = new Set<string>();
    for (let i = 0; i < 500; i++) firstSeen.add(cardId(dealDeck()[0]!));
    assert.ok(firstSeen.size > 30, `only ${firstSeen.size} distinct cards led the deck`);
});

// Keep the Hand import meaningful for readers of this file.
export type { Hand };
