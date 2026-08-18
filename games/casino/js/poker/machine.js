// Video poker round state, as pure transitions.
//
// No DOM, no storage, no randomness — the caller supplies the cards. That is
// what lets machine.test.ts force an exact outcome without reaching through a
// seeded PRNG (which would couple every fixture to the shuffle implementation).
//
// DEALING MODEL: a round freezes TEN cards up front. `hand[i]` is what's on the
// table; `replacements[i]` is what takes its place if position i isn't held.
// There is no cursor to advance and nothing mutable to alias across the
// {...state} copies, so dealing the same card twice is structurally impossible
// rather than merely tested against. Statistically this is identical to dealing
// sequentially off the remaining 47.
import { cardId } from "../shared/cards.js";
import { evaluate } from "./hands.js";
const NO_HOLDS = [false, false, false, false, false];
/** Cards a round consumes: five dealt, five held in reserve. */
export const CARDS_PER_ROUND = 10;
export function initialState(roundId = 1) {
    return { phase: 'betting', roundId };
}
function toHand(cards) {
    return [cards[0], cards[1], cards[2], cards[3], cards[4]];
}
/**
 * Start a round from a shuffled deck. Only the first ten cards are used.
 *
 * Throws if the deck is too short or contains a duplicate among those ten —
 * both mean the caller's shuffle is broken, and failing loudly beats paying out
 * on an impossible hand.
 */
export function newRound(state, wager, deck) {
    if (state.phase !== 'betting') {
        throw new Error(`newRound() requires the betting phase, got "${state.phase}"`);
    }
    if (!Number.isInteger(wager) || wager <= 0) {
        throw new Error(`wager must be a positive integer, got ${wager}`);
    }
    if (deck.length < CARDS_PER_ROUND) {
        throw new Error(`need at least ${CARDS_PER_ROUND} cards, got ${deck.length}`);
    }
    const round = deck.slice(0, CARDS_PER_ROUND);
    const seen = new Set();
    for (const card of round) {
        const id = cardId(card);
        if (seen.has(id))
            throw new Error(`duplicate card dealt: ${id}`);
        seen.add(id);
    }
    return {
        phase: 'dealt',
        roundId: state.roundId,
        wager,
        hand: toHand(round.slice(0, 5)),
        replacements: toHand(round.slice(5, 10)),
        held: NO_HOLDS,
    };
}
/**
 * Toggle the hold on one card.
 *
 * Outside the dealt phase this is a no-op that returns the SAME reference, so a
 * renderer can short-circuit on `next === prev`. An out-of-range index is a
 * programmer error and throws.
 */
export function toggleHold(state, index) {
    if (!Number.isInteger(index) || index < 0 || index > 4) {
        throw new Error(`hold index must be 0-4, got ${index}`);
    }
    if (state.phase !== 'dealt')
        return state;
    const held = state.held.map((v, i) => (i === index ? !v : v));
    return { ...state, held };
}
/** Replace every unheld position and score the result. */
export function draw(state) {
    if (state.phase !== 'dealt') {
        throw new Error(`draw() requires the dealt phase, got "${state.phase}"`);
    }
    const final = toHand(state.hand.map((card, i) => (state.held[i] ? card : state.replacements[i])));
    const result = evaluate(final);
    return {
        phase: 'resolved',
        roundId: state.roundId,
        wager: state.wager,
        hand: final,
        dealtHand: state.hand,
        held: state.held,
        result,
        payout: state.wager * result.multiplier,
    };
}
/** Clear the table and advance the round counter. */
export function nextRound(state) {
    if (state.phase !== 'resolved') {
        throw new Error(`nextRound() requires the resolved phase, got "${state.phase}"`);
    }
    return { phase: 'betting', roundId: state.roundId + 1 };
}
export function serializeRound(state) {
    const payload = {
        v: 1,
        roundId: state.roundId,
        wager: state.wager,
        hand: state.hand,
        replacements: state.replacements,
        held: state.held,
    };
    return JSON.stringify(payload);
}
function isCard(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const { rank, suit } = value;
    return (typeof rank === 'number' && Number.isInteger(rank) && rank >= 2 && rank <= 14 &&
        (suit === 'H' || suit === 'D' || suit === 'S' || suit === 'C'));
}
/** Returns null on anything unrecognisable rather than throwing — a corrupt or
 *  stale save should drop the player back to the betting phase, not break the
 *  page. */
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
    const { v, roundId, wager, hand, replacements, held } = parsed;
    if (v !== 1)
        return null;
    if (!Number.isInteger(roundId) || !Number.isInteger(wager) || wager <= 0)
        return null;
    if (!Array.isArray(hand) || hand.length !== 5 || !hand.every(isCard))
        return null;
    if (!Array.isArray(replacements) || replacements.length !== 5 || !replacements.every(isCard))
        return null;
    if (!Array.isArray(held) || held.length !== 5 || !held.every((b) => typeof b === 'boolean'))
        return null;
    const ids = new Set([...hand, ...replacements].map(cardId));
    if (ids.size !== CARDS_PER_ROUND)
        return null;
    return {
        phase: 'dealt',
        roundId: roundId,
        wager: wager,
        hand: toHand(hand),
        replacements: toHand(replacements),
        held: [held[0], held[1], held[2], held[3], held[4]],
    };
}
