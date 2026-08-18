// Run: npm run test:casino
//
// Node executes this .ts directly via native type stripping — no build step.
// Note that stripping does NOT typecheck; tsconfig.json excludes test files
// from the emit build, so these are checked by their assertions alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Card, Hand, Rank, Suit } from '../shared/cards.ts';
import { RANKS, SUITS } from '../shared/cards.ts';
import { HAND_RANKS, PAYTABLE, evaluate } from './hands.ts';
import type { HandRank } from './hands.ts';

// --- helpers ---------------------------------------------------------------

const RANK_CHARS: Record<string, Rank> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** `h('AS KS QS JS TS')` — T is ten, suits are HDSC. */
function h(spec: string): Hand {
    const cards = spec.trim().split(/\s+/).map((token): Card => {
        const rank = RANK_CHARS[token.slice(0, -1).toUpperCase()];
        const suit = token.slice(-1).toUpperCase() as Suit;
        if (rank === undefined) throw new Error(`bad rank in "${token}"`);
        if (!SUITS.includes(suit)) throw new Error(`bad suit in "${token}"`);
        return { rank, suit };
    });
    assert.equal(cards.length, 5, `"${spec}" is not 5 cards`);
    return cards as unknown as Hand;
}

function rankOf(spec: string): HandRank {
    return evaluate(h(spec)).rank;
}

// --- the paytable ranks ----------------------------------------------------

test('classifies each paytable rank', () => {
    assert.equal(rankOf('AS KS QS JS TS'), HAND_RANKS.ROYAL_FLUSH);
    assert.equal(rankOf('9H 8H 7H 6H 5H'), HAND_RANKS.STRAIGHT_FLUSH);
    assert.equal(rankOf('7C 7D 7H 7S 2C'), HAND_RANKS.FOUR_OF_A_KIND);
    assert.equal(rankOf('AS AD AH KS KD'), HAND_RANKS.FULL_HOUSE);
    assert.equal(rankOf('AS 9S 7S 4S 2S'), HAND_RANKS.FLUSH);
    assert.equal(rankOf('9H 8C 7D 6S 5H'), HAND_RANKS.STRAIGHT);
    assert.equal(rankOf('4C 4D 4H 9S 2C'), HAND_RANKS.THREE_OF_A_KIND);
    assert.equal(rankOf('AS AD 3H 3S 9C'), HAND_RANKS.TWO_PAIR);
    assert.equal(rankOf('JS JD 8H 5S 2C'), HAND_RANKS.JACKS_OR_BETTER);
    assert.equal(rankOf('KS 9D 7H 4S 2C'), HAND_RANKS.NOTHING);
});

test('multipliers match the 9/6 paytable', () => {
    assert.equal(PAYTABLE[HAND_RANKS.ROYAL_FLUSH], 800);
    assert.equal(PAYTABLE[HAND_RANKS.STRAIGHT_FLUSH], 50);
    assert.equal(PAYTABLE[HAND_RANKS.FOUR_OF_A_KIND], 25);
    assert.equal(PAYTABLE[HAND_RANKS.FULL_HOUSE], 9); // the "9"
    assert.equal(PAYTABLE[HAND_RANKS.FLUSH], 6); // the "6"
    assert.equal(PAYTABLE[HAND_RANKS.STRAIGHT], 4);
    assert.equal(PAYTABLE[HAND_RANKS.THREE_OF_A_KIND], 3);
    assert.equal(PAYTABLE[HAND_RANKS.TWO_PAIR], 2);
    assert.equal(PAYTABLE[HAND_RANKS.JACKS_OR_BETTER], 1);
    assert.equal(PAYTABLE[HAND_RANKS.NOTHING], 0);
});

// --- straight traps --------------------------------------------------------

test('the ace does not wrap: K-A-2-3-4 is not a straight', () => {
    assert.equal(rankOf('KS AD 2H 3S 4C'), HAND_RANKS.NOTHING);
    assert.equal(rankOf('KS AS 2S 3S 4S'), HAND_RANKS.FLUSH); // suited: flush, not SF
});

test('the wheel A-2-3-4-5 is a straight', () => {
    assert.equal(rankOf('AS 2D 3H 4S 5C'), HAND_RANKS.STRAIGHT);
});

test('a suited wheel is a steel wheel: straight flush, not royal', () => {
    assert.equal(rankOf('AS 2S 3S 4S 5S'), HAND_RANKS.STRAIGHT_FLUSH);
});

test('10-J-Q-K-A off-suit is a plain straight, not a royal', () => {
    assert.equal(rankOf('TS JD QH KS AC'), HAND_RANKS.STRAIGHT);
});

test('a royal needs a low card of ten', () => {
    assert.equal(rankOf('9S TS JS QS KS'), HAND_RANKS.STRAIGHT_FLUSH);
    assert.equal(rankOf('TS JS QS KS AS'), HAND_RANKS.ROYAL_FLUSH);
});

test('near-misses are not straights', () => {
    assert.equal(rankOf('2C 3D 4H 5S 5C'), HAND_RANKS.NOTHING); // duplicate rank
    assert.equal(rankOf('AS 2D 3H 4S 6C'), HAND_RANKS.NOTHING); // gap
});

// --- the jacks-or-better boundary -----------------------------------------

test('the pair boundary sits between tens and jacks', () => {
    assert.equal(rankOf('TS TD 8H 5S 2C'), HAND_RANKS.NOTHING);
    assert.equal(rankOf('JS JD 8H 5S 2C'), HAND_RANKS.JACKS_OR_BETTER);
    assert.equal(rankOf('QS QD 8H 5S 2C'), HAND_RANKS.JACKS_OR_BETTER);
    assert.equal(rankOf('KS KD 8H 5S 2C'), HAND_RANKS.JACKS_OR_BETTER);
    assert.equal(rankOf('AS AD 8H 5S 2C'), HAND_RANKS.JACKS_OR_BETTER); // rank 14 >= 11
});

// --- precedence, not addition ---------------------------------------------

test('better hands supersede rather than stack', () => {
    // Two pair with a jacks high pair pays 2, not 2+1.
    const twoPair = evaluate(h('JS JD 3H 3S 9C'));
    assert.equal(twoPair.rank, HAND_RANKS.TWO_PAIR);
    assert.equal(twoPair.multiplier, 2);

    // A flush containing a pair is impossible (five suited cards are distinct),
    // but a straight containing high cards must still be just a straight.
    const straight = evaluate(h('TS JD QH KS AC'));
    assert.equal(straight.multiplier, 4);

    // Quads outrank the trips+pair reading of the same cards.
    assert.equal(rankOf('9C 9D 9H 9S 2C'), HAND_RANKS.FOUR_OF_A_KIND);
});

test('full house is found in either group order', () => {
    assert.equal(rankOf('AS AD AH KS KD'), HAND_RANKS.FULL_HOUSE);
    assert.equal(rankOf('AS AD KH KS KD'), HAND_RANKS.FULL_HOUSE);
    assert.equal(rankOf('2S 2D 2H 3S 3D'), HAND_RANKS.FULL_HOUSE);
});

// --- scoringIndices contract ----------------------------------------------

test('scoringIndices marks only the cards that earned the payout', () => {
    // Positions are in DISPLAYED order, ascending — not a sorted copy.
    assert.deepEqual(evaluate(h('2C 7D 7H 9S 7C')).scoringIndices, [1, 2, 4]);
    assert.deepEqual(evaluate(h('9S 7D 7H 7C 7S')).scoringIndices, [1, 2, 3, 4]);
    assert.deepEqual(evaluate(h('3H AS AD 9C 3S')).scoringIndices, [0, 1, 2, 4]);
    assert.deepEqual(evaluate(h('8H JS 5C JD 2C')).scoringIndices, [1, 3]);

    // Whole-hand ranks light up all five.
    assert.deepEqual(evaluate(h('AS KS QS JS TS')).scoringIndices, [0, 1, 2, 3, 4]);
    assert.deepEqual(evaluate(h('AS AD AH KS KD')).scoringIndices, [0, 1, 2, 3, 4]);
    assert.deepEqual(evaluate(h('9H 8C 7D 6S 5H')).scoringIndices, [0, 1, 2, 3, 4]);
    assert.deepEqual(evaluate(h('AS 9S 7S 4S 2S')).scoringIndices, [0, 1, 2, 3, 4]);
});

test('losing hands score nothing, including a low pair that exists', () => {
    assert.deepEqual(evaluate(h('5S 5D 8H 9S 2C')).scoringIndices, []);
    assert.deepEqual(evaluate(h('KS 9D 7H 4S 2C')).scoringIndices, []);
});

// --- input validation ------------------------------------------------------

test('rejects malformed hands loudly', () => {
    const four = [
        { rank: 2, suit: 'C' }, { rank: 3, suit: 'C' },
        { rank: 4, suit: 'C' }, { rank: 5, suit: 'C' },
    ] as unknown as Hand;
    assert.throws(() => evaluate(four), /exactly 5 cards/);

    const dup = h('AS AS KD 9C 2H');
    assert.throws(() => evaluate(dup), /duplicate card/);
});

// --- order independence ----------------------------------------------------

test('rank is invariant across all 120 permutations', () => {
    const specs = ['AS KS QS JS TS', 'JS JD 3H 3S 9C', 'AS 2D 3H 4S 5C', '7C 7D 7H 7S 2C'];
    for (const spec of specs) {
        const cards = [...h(spec)];
        const expected = evaluate(cards as unknown as Hand).rank;
        for (const perm of permutations(cards)) {
            assert.equal(evaluate(perm as unknown as Hand).rank, expected, spec);
        }
    }
});

function* permutations<T>(items: T[]): Generator<T[]> {
    if (items.length <= 1) {
        yield items.slice();
        return;
    }
    for (let i = 0; i < items.length; i++) {
        const rest = items.slice(0, i).concat(items.slice(i + 1));
        for (const tail of permutations(rest)) {
            yield [items[i]!, ...tail];
        }
    }
}

// --- the one that makes the evaluator trustworthy --------------------------

test('exhaustive: all 2,598,960 five-card hands match known frequencies', () => {
    const deck: Card[] = [];
    for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
    assert.equal(deck.length, 52);

    const counts = new Map<HandRank, number>();
    for (const key of Object.values(HAND_RANKS)) counts.set(key, 0);

    const hand = new Array<Card>(5);
    for (let a = 0; a < 48; a++) {
        hand[0] = deck[a]!;
        for (let b = a + 1; b < 49; b++) {
            hand[1] = deck[b]!;
            for (let c = b + 1; c < 50; c++) {
                hand[2] = deck[c]!;
                for (let d = c + 1; d < 51; d++) {
                    hand[3] = deck[d]!;
                    for (let e = d + 1; e < 52; e++) {
                        hand[4] = deck[e]!;
                        const { rank } = evaluate(hand as unknown as Hand);
                        counts.set(rank, counts.get(rank)! + 1);
                    }
                }
            }
        }
    }

    // Textbook five-card poker frequencies. "flush" and "straight" exclude
    // straight flushes; "nothing" is high card plus every pair below jacks.
    assert.deepEqual(Object.fromEntries(counts), {
        [HAND_RANKS.ROYAL_FLUSH]: 4,
        [HAND_RANKS.STRAIGHT_FLUSH]: 36,
        [HAND_RANKS.FOUR_OF_A_KIND]: 624,
        [HAND_RANKS.FULL_HOUSE]: 3_744,
        [HAND_RANKS.FLUSH]: 5_108,
        [HAND_RANKS.STRAIGHT]: 10_200,
        [HAND_RANKS.THREE_OF_A_KIND]: 54_912,
        [HAND_RANKS.TWO_PAIR]: 123_552,
        [HAND_RANKS.JACKS_OR_BETTER]: 337_920,
        [HAND_RANKS.NOTHING]: 2_062_860,
    });

    let total = 0;
    for (const n of counts.values()) total += n;
    assert.equal(total, 2_598_960);
});
