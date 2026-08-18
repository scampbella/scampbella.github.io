// Jacks or Better hand evaluation — 9/6 paytable.
//
// Pure: no DOM, no storage, no randomness, nothing executed at import time.
//
// Payouts are TOTAL RETURNED per unit wagered, not profit. So Jacks or Better
// at x1 hands the wager back and nets zero. That convention is what gives the
// 9/6 table its real ~99.5% RTP; switching to profit-style payouts means adding
// 1 to every non-zero multiplier here and nothing else.
import { ACE, JACK, cardId } from "../shared/cards.js";
export const HAND_RANKS = {
    ROYAL_FLUSH: 'royal-flush',
    STRAIGHT_FLUSH: 'straight-flush',
    FOUR_OF_A_KIND: 'four-of-a-kind',
    FULL_HOUSE: 'full-house',
    FLUSH: 'flush',
    STRAIGHT: 'straight',
    THREE_OF_A_KIND: 'three-of-a-kind',
    TWO_PAIR: 'two-pair',
    JACKS_OR_BETTER: 'jacks-or-better',
    NOTHING: 'nothing',
};
/** Multiplier applied to the wager. The Full House (9) and Flush (6) entries
 *  are what "9/6" names — they are the house-edge tuning knob. Don't change the
 *  others without saying so explicitly. */
export const PAYTABLE = {
    [HAND_RANKS.ROYAL_FLUSH]: 800,
    [HAND_RANKS.STRAIGHT_FLUSH]: 50,
    [HAND_RANKS.FOUR_OF_A_KIND]: 25,
    [HAND_RANKS.FULL_HOUSE]: 9,
    [HAND_RANKS.FLUSH]: 6,
    [HAND_RANKS.STRAIGHT]: 4,
    [HAND_RANKS.THREE_OF_A_KIND]: 3,
    [HAND_RANKS.TWO_PAIR]: 2,
    [HAND_RANKS.JACKS_OR_BETTER]: 1,
    [HAND_RANKS.NOTHING]: 0,
};
export const HAND_LABELS = {
    [HAND_RANKS.ROYAL_FLUSH]: 'Royal Flush',
    [HAND_RANKS.STRAIGHT_FLUSH]: 'Straight Flush',
    [HAND_RANKS.FOUR_OF_A_KIND]: 'Four of a Kind',
    [HAND_RANKS.FULL_HOUSE]: 'Full House',
    [HAND_RANKS.FLUSH]: 'Flush',
    [HAND_RANKS.STRAIGHT]: 'Straight',
    [HAND_RANKS.THREE_OF_A_KIND]: 'Three of a Kind',
    [HAND_RANKS.TWO_PAIR]: 'Two Pair',
    [HAND_RANKS.JACKS_OR_BETTER]: 'Jacks or Better',
    [HAND_RANKS.NOTHING]: 'No Win',
};
/** Strength ordering, high is better. Used for the "best hand" stat, which
 *  can't rely on the multiplier alone (Nothing and a losing hand both pay 0). */
export const HAND_STRENGTH = {
    [HAND_RANKS.NOTHING]: 0,
    [HAND_RANKS.JACKS_OR_BETTER]: 1,
    [HAND_RANKS.TWO_PAIR]: 2,
    [HAND_RANKS.THREE_OF_A_KIND]: 3,
    [HAND_RANKS.STRAIGHT]: 4,
    [HAND_RANKS.FLUSH]: 5,
    [HAND_RANKS.FULL_HOUSE]: 6,
    [HAND_RANKS.FOUR_OF_A_KIND]: 7,
    [HAND_RANKS.STRAIGHT_FLUSH]: 8,
    [HAND_RANKS.ROYAL_FLUSH]: 9,
};
const ALL_FIVE = [0, 1, 2, 3, 4];
/**
 * Highest card of a straight, or null. Ranks must be 5 distinct values.
 * Returns 5 for the wheel (A-2-3-4-5) since the ace plays low there.
 * K-A-2-3-4 is deliberately NOT a straight — the ace does not wrap.
 */
function straightHigh(sorted) {
    const lo = sorted[0];
    const hi = sorted[4];
    if (hi - lo === 4)
        return hi;
    if (lo === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && hi === ACE)
        return 5;
    return null;
}
function result(rank, scoringIndices) {
    return {
        rank,
        label: HAND_LABELS[rank],
        multiplier: PAYTABLE[rank],
        scoringIndices,
    };
}
/**
 * Classify a five-card hand.
 *
 * Throws on anything that isn't exactly five distinct cards — a duplicate card
 * means the dealing logic is broken, and surfacing that as a loud failure beats
 * quietly paying out on an impossible hand.
 */
export function evaluate(hand) {
    const cards = hand;
    if (cards.length !== 5) {
        throw new Error(`evaluate() needs exactly 5 cards, got ${cards.length}`);
    }
    const seen = new Set();
    for (const card of cards) {
        const id = cardId(card);
        if (seen.has(id))
            throw new Error(`duplicate card in hand: ${id}`);
        seen.add(id);
    }
    // Group positions by rank, preserving displayed order within each group.
    const byRank = new Map();
    for (let i = 0; i < cards.length; i++) {
        const rank = cards[i].rank;
        const bucket = byRank.get(rank);
        if (bucket)
            bucket.push(i);
        else
            byRank.set(rank, [i]);
    }
    // Biggest group first, then highest rank — so groups[0] is the quad/trip/
    // top pair and groups[1] is the second pair when there is one.
    const groups = [...byRank.entries()]
        .map(([rank, indices]) => ({ rank, indices }))
        .sort((a, b) => b.indices.length - a.indices.length || b.rank - a.rank);
    const top = groups[0];
    const isFlush = cards.every((c) => c.suit === cards[0].suit);
    // A flush or straight needs five distinct ranks, so this is only meaningful
    // when there are no pairs — but computing it unconditionally is harmless.
    const high = byRank.size === 5
        ? straightHigh([...byRank.keys()].sort((a, b) => a - b))
        : null;
    if (isFlush && high !== null) {
        // high === ACE can only mean 10-J-Q-K-A, because the wheel reports 5.
        // A suited A-2-3-4-5 is a steel wheel: straight flush, not royal.
        return result(high === ACE ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH, ALL_FIVE);
    }
    if (top.indices.length === 4) {
        return result(HAND_RANKS.FOUR_OF_A_KIND, top.indices);
    }
    if (top.indices.length === 3 && groups[1]?.indices.length === 2) {
        return result(HAND_RANKS.FULL_HOUSE, ALL_FIVE);
    }
    if (isFlush) {
        return result(HAND_RANKS.FLUSH, ALL_FIVE);
    }
    if (high !== null) {
        return result(HAND_RANKS.STRAIGHT, ALL_FIVE);
    }
    if (top.indices.length === 3) {
        return result(HAND_RANKS.THREE_OF_A_KIND, top.indices);
    }
    if (top.indices.length === 2 && groups[1]?.indices.length === 2) {
        const both = [...top.indices, ...groups[1].indices].sort((a, b) => a - b);
        return result(HAND_RANKS.TWO_PAIR, both);
    }
    if (top.indices.length === 2 && top.rank >= JACK) {
        return result(HAND_RANKS.JACKS_OR_BETTER, top.indices);
    }
    return result(HAND_RANKS.NOTHING, []);
}
