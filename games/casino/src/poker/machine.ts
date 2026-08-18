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

import type { Card, Hand } from '../shared/cards.ts';
import { cardId } from '../shared/cards.ts';
import type { HandResult } from './hands.ts';
import { evaluate } from './hands.ts';

export type Holds = readonly [boolean, boolean, boolean, boolean, boolean];

const NO_HOLDS: Holds = [false, false, false, false, false];

/** Cards a round consumes: five dealt, five held in reserve. */
export const CARDS_PER_ROUND = 10;

export interface BettingState {
    readonly phase: 'betting';
    readonly roundId: number;
}

export interface DealtState {
    readonly phase: 'dealt';
    readonly roundId: number;
    readonly wager: number;
    readonly hand: Hand;
    readonly replacements: Hand;
    readonly held: Holds;
}

export interface ResolvedState {
    readonly phase: 'resolved';
    readonly roundId: number;
    readonly wager: number;
    /** The hand after the draw — what the payout is based on. */
    readonly hand: Hand;
    /** The hand as originally dealt, for the "you held / you drew" readout. */
    readonly dealtHand: Hand;
    readonly held: Holds;
    readonly result: HandResult;
    /** Total returned to the player, i.e. wager x multiplier. Zero on a loss. */
    readonly payout: number;
}

export type PokerState = BettingState | DealtState | ResolvedState;

export function initialState(roundId = 1): BettingState {
    return { phase: 'betting', roundId };
}

function toHand(cards: readonly Card[]): Hand {
    return [cards[0]!, cards[1]!, cards[2]!, cards[3]!, cards[4]!] as const;
}

/**
 * Start a round from a shuffled deck. Only the first ten cards are used.
 *
 * Throws if the deck is too short or contains a duplicate among those ten —
 * both mean the caller's shuffle is broken, and failing loudly beats paying out
 * on an impossible hand.
 */
export function newRound(state: BettingState, wager: number, deck: readonly Card[]): DealtState {
    if (state.phase !== 'betting') {
        throw new Error(`newRound() requires the betting phase, got "${(state as PokerState).phase}"`);
    }
    if (!Number.isInteger(wager) || wager <= 0) {
        throw new Error(`wager must be a positive integer, got ${wager}`);
    }
    if (deck.length < CARDS_PER_ROUND) {
        throw new Error(`need at least ${CARDS_PER_ROUND} cards, got ${deck.length}`);
    }

    const round = deck.slice(0, CARDS_PER_ROUND);
    const seen = new Set<string>();
    for (const card of round) {
        const id = cardId(card);
        if (seen.has(id)) throw new Error(`duplicate card dealt: ${id}`);
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
export function toggleHold(state: PokerState, index: number): PokerState {
    if (!Number.isInteger(index) || index < 0 || index > 4) {
        throw new Error(`hold index must be 0-4, got ${index}`);
    }
    if (state.phase !== 'dealt') return state;

    const held = state.held.map((v, i) => (i === index ? !v : v)) as unknown as Holds;
    return { ...state, held };
}

/** Replace every unheld position and score the result. */
export function draw(state: DealtState): ResolvedState {
    if (state.phase !== 'dealt') {
        throw new Error(`draw() requires the dealt phase, got "${(state as PokerState).phase}"`);
    }

    const final = toHand(
        state.hand.map((card, i) => (state.held[i] ? card : state.replacements[i]!)),
    );
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
export function nextRound(state: ResolvedState): BettingState {
    if (state.phase !== 'resolved') {
        throw new Error(`nextRound() requires the resolved phase, got "${(state as PokerState).phase}"`);
    }
    return { phase: 'betting', roundId: state.roundId + 1 };
}

// --- persistence -----------------------------------------------------------
//
// A round is saved so that a mid-hand reload restores the table instead of
// silently eating the wager (it was deducted at deal). The replacement cards
// are therefore visible in devtools — irrelevant in a single-player game
// against no opponent.

interface StoredRound {
    readonly v: 1;
    readonly roundId: number;
    readonly wager: number;
    readonly hand: readonly Card[];
    readonly replacements: readonly Card[];
    readonly held: readonly boolean[];
}

export function serializeRound(state: DealtState): string {
    const payload: StoredRound = {
        v: 1,
        roundId: state.roundId,
        wager: state.wager,
        hand: state.hand,
        replacements: state.replacements,
        held: state.held,
    };
    return JSON.stringify(payload);
}

function isCard(value: unknown): value is Card {
    if (typeof value !== 'object' || value === null) return false;
    const { rank, suit } = value as { rank?: unknown; suit?: unknown };
    return (
        typeof rank === 'number' && Number.isInteger(rank) && rank >= 2 && rank <= 14 &&
        (suit === 'H' || suit === 'D' || suit === 'S' || suit === 'C')
    );
}

/** Returns null on anything unrecognisable rather than throwing — a corrupt or
 *  stale save should drop the player back to the betting phase, not break the
 *  page. */
export function deserializeRound(raw: string | null): DealtState | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { v, roundId, wager, hand, replacements, held } = parsed as Partial<StoredRound>;
    if (v !== 1) return null;
    if (!Number.isInteger(roundId) || !Number.isInteger(wager) || (wager as number) <= 0) return null;
    if (!Array.isArray(hand) || hand.length !== 5 || !hand.every(isCard)) return null;
    if (!Array.isArray(replacements) || replacements.length !== 5 || !replacements.every(isCard)) return null;
    if (!Array.isArray(held) || held.length !== 5 || !held.every((b) => typeof b === 'boolean')) return null;

    const ids = new Set([...hand, ...replacements].map(cardId));
    if (ids.size !== CARDS_PER_ROUND) return null;

    return {
        phase: 'dealt',
        roundId: roundId as number,
        wager: wager as number,
        hand: toHand(hand),
        replacements: toHand(replacements),
        held: [held[0]!, held[1]!, held[2]!, held[3]!, held[4]!] as const,
    };
}
