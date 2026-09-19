import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../shared/cards.ts';
import { freshDeck } from '../shared/deck.ts';
import { deserializeRound, doubleDown, hit, initialState, newRound, scoreHand, serializeRound, stand } from './machine.ts';

const c = (rank: Card['rank'], suit: Card['suit'] = 'S'): Card => ({ rank, suit });
function deck(first: readonly Card[]): Card[] {
    const used = new Set(first.map((card) => `${card.rank}${card.suit}`));
    return [...first, ...freshDeck().filter((card) => !used.has(`${card.rank}${card.suit}`))];
}

test('aces score as eleven until the hand would bust', () => {
    assert.deepEqual(scoreHand([c(14), c(6, 'H')]), { total: 17, soft: true });
    assert.deepEqual(scoreHand([c(14), c(6, 'H'), c(10, 'D')]), { total: 17, soft: false });
});

test('natural blackjack pays three to two and floors fractional chips', () => {
    const state = newRound(initialState(4), 5, deck([c(14), c(9, 'H'), c(13), c(7, 'D')]));
    assert.equal(state.phase, 'resolved');
    if (state.phase === 'resolved') {
        assert.equal(state.outcome, 'blackjack');
        assert.equal(state.payout, 12);
    }
});

test('two naturals push', () => {
    const state = newRound(initialState(), 20, deck([c(14), c(14, 'H'), c(13), c(12, 'H')]));
    assert.equal(state.phase, 'resolved');
    if (state.phase === 'resolved') assert.deepEqual([state.outcome, state.payout], ['push', 20]);
});

test('hit busts the player', () => {
    const state = newRound(initialState(), 10, deck([c(10), c(6, 'H'), c(9), c(10, 'H'), c(5, 'D')]));
    assert.equal(state.phase, 'playing');
    if (state.phase === 'playing') {
        const result = hit(state);
        assert.equal(result.phase, 'resolved');
        if (result.phase === 'resolved') assert.equal(result.outcome, 'bust');
    }
});

test('dealer stands on soft 17', () => {
    const state = newRound(initialState(), 10, deck([c(10), c(14, 'H'), c(8), c(6, 'H'), c(10, 'D')]));
    assert.equal(state.phase, 'playing');
    if (state.phase === 'playing') {
        const result = stand(state);
        assert.equal(result.dealer.length, 2);
        assert.equal(result.outcome, 'win');
    }
});

test('double down doubles stake, takes one card, and finishes', () => {
    const state = newRound(initialState(), 25, deck([c(6), c(10, 'H'), c(5), c(6, 'H'), c(10, 'D'), c(9, 'C')]));
    assert.equal(state.phase, 'playing');
    if (state.phase === 'playing') {
        const result = doubleDown(state);
        assert.equal(result.wager, 50);
        assert.equal(result.player.length, 3);
        assert.equal(result.outcome, 'win');
        assert.equal(result.payout, 100);
    }
});

test('an in-progress hand survives serialization', () => {
    const state = newRound(initialState(18), 40, deck([c(8), c(9, 'H'), c(7), c(8, 'H')]));
    assert.equal(state.phase, 'playing');
    if (state.phase === 'playing') assert.deepEqual(deserializeRound(serializeRound(state)), state);
});

test('corrupt stored rounds are rejected', () => {
    assert.equal(deserializeRound('{bad'), null);
    assert.equal(deserializeRound(JSON.stringify({ v: 1, roundId: 1 })), null);
});
