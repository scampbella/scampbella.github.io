// Blackjack round state as pure transitions. Randomness, storage, and the DOM
// stay outside this file so every rule can be tested with an exact deck.
import { cardId } from "../shared/cards.js";
export function initialState(roundId = 1) {
    return { phase: 'betting', roundId };
}
export function scoreHand(cards) {
    let total = 0;
    let acesAsEleven = 0;
    for (const card of cards) {
        if (card.rank === 14) {
            total += 11;
            acesAsEleven += 1;
        }
        else {
            total += Math.min(card.rank, 10);
        }
    }
    while (total > 21 && acesAsEleven > 0) {
        total -= 10;
        acesAsEleven -= 1;
    }
    return { total, soft: acesAsEleven > 0 };
}
export function isBlackjack(cards) {
    return cards.length === 2 && scoreHand(cards).total === 21;
}
function validateDeck(deck) {
    if (deck.length < 4)
        throw new Error(`need at least 4 cards, got ${deck.length}`);
    const ids = new Set(deck.map(cardId));
    if (ids.size !== deck.length)
        throw new Error('deck contains a duplicate card');
}
function resolve(state, outcome, payout) {
    return { ...state, phase: 'resolved', outcome, payout };
}
function compareAfterDealer(state) {
    let next = state;
    let dealerScore = scoreHand(next.dealer);
    // Dealer stands on every 17, including soft 17.
    while (dealerScore.total < 17) {
        const card = next.deck[next.cursor];
        if (!card)
            throw new Error('deck exhausted while dealer was drawing');
        next = { ...next, dealer: [...next.dealer, card], cursor: next.cursor + 1 };
        dealerScore = scoreHand(next.dealer);
    }
    const playerTotal = scoreHand(next.player).total;
    if (dealerScore.total > 21)
        return resolve(next, 'win', next.wager * 2);
    if (playerTotal > dealerScore.total)
        return resolve(next, 'win', next.wager * 2);
    if (playerTotal === dealerScore.total)
        return resolve(next, 'push', next.wager);
    return resolve(next, 'loss', 0);
}
export function newRound(state, wager, deck) {
    if (state.phase !== 'betting')
        throw new Error('newRound() requires the betting phase');
    if (!Number.isInteger(wager) || wager <= 0)
        throw new Error('wager must be a positive integer');
    validateDeck(deck);
    const playing = {
        phase: 'playing',
        roundId: state.roundId,
        wager,
        player: [deck[0], deck[2]],
        dealer: [deck[1], deck[3]],
        deck,
        cursor: 4,
        doubled: false,
    };
    const playerNatural = isBlackjack(playing.player);
    const dealerNatural = isBlackjack(playing.dealer);
    if (playerNatural && dealerNatural)
        return resolve(playing, 'push', wager);
    if (playerNatural)
        return resolve(playing, 'blackjack', Math.floor(wager * 2.5));
    if (dealerNatural)
        return resolve(playing, 'loss', 0);
    return playing;
}
export function hit(state) {
    if (state.phase !== 'playing')
        throw new Error('hit() requires the playing phase');
    const card = state.deck[state.cursor];
    if (!card)
        throw new Error('deck exhausted while player was drawing');
    const next = {
        ...state,
        player: [...state.player, card],
        cursor: state.cursor + 1,
    };
    const total = scoreHand(next.player).total;
    if (total > 21)
        return resolve(next, 'bust', 0);
    if (total === 21)
        return compareAfterDealer(next);
    return next;
}
export function stand(state) {
    if (state.phase !== 'playing')
        throw new Error('stand() requires the playing phase');
    return compareAfterDealer(state);
}
/** Double the total stake, take exactly one card, then force the dealer turn. */
export function doubleDown(state) {
    if (state.phase !== 'playing' || state.player.length !== 2 || state.doubled) {
        throw new Error('doubleDown() requires the first decision of a hand');
    }
    const card = state.deck[state.cursor];
    if (!card)
        throw new Error('deck exhausted while doubling down');
    const next = {
        ...state,
        wager: state.wager * 2,
        player: [...state.player, card],
        cursor: state.cursor + 1,
        doubled: true,
    };
    if (scoreHand(next.player).total > 21)
        return resolve(next, 'bust', 0);
    return compareAfterDealer(next);
}
export function nextRound(state, roundId = state.roundId + 1) {
    if (state.phase !== 'resolved')
        throw new Error('nextRound() requires the resolved phase');
    return { phase: 'betting', roundId };
}
export function serializeRound(state) {
    const payload = { v: 1, ...state };
    return JSON.stringify(payload);
}
function isCard(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const { rank, suit } = value;
    return typeof rank === 'number' && Number.isInteger(rank) && rank >= 2 && rank <= 14 &&
        (suit === 'H' || suit === 'D' || suit === 'S' || suit === 'C');
}
export function deserializeRound(raw) {
    if (!raw)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return null;
    const value = parsed;
    if (value.v !== 1 || !Number.isInteger(value.roundId) || !Number.isInteger(value.wager) ||
        value.wager <= 0 || value.doubled !== false || !Number.isInteger(value.cursor))
        return null;
    if (!Array.isArray(value.deck) || value.deck.length !== 52 || !value.deck.every(isCard))
        return null;
    if (!Array.isArray(value.player) || value.player.length < 2 || !value.player.every(isCard))
        return null;
    if (!Array.isArray(value.dealer) || value.dealer.length < 2 || !value.dealer.every(isCard))
        return null;
    const cursor = value.cursor;
    if (cursor < 4 || cursor > value.deck.length)
        return null;
    if (new Set(value.deck.map(cardId)).size !== 52)
        return null;
    const used = [...value.player, ...value.dealer].map(cardId);
    if (new Set(used).size !== used.length || used.length !== cursor)
        return null;
    if (!used.every((id) => value.deck.some((card) => cardId(card) === id)))
        return null;
    return {
        phase: 'playing', roundId: value.roundId, wager: value.wager,
        player: value.player, dealer: value.dealer, deck: value.deck, cursor, doubled: false,
    };
}
