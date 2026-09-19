// Blackjack round state as pure transitions. Randomness, storage, and the DOM
// stay outside this file so every rule can be tested with an exact deck.

import type { Card } from '../shared/cards.ts';
import { cardId } from '../shared/cards.ts';

export interface HandScore {
    readonly total: number;
    readonly soft: boolean;
}

export type BlackjackOutcome = 'blackjack' | 'win' | 'push' | 'loss' | 'bust';

export interface BettingState {
    readonly phase: 'betting';
    readonly roundId: number;
}

export interface PlayingState {
    readonly phase: 'playing';
    readonly roundId: number;
    readonly wager: number;
    readonly player: readonly Card[];
    readonly dealer: readonly Card[];
    readonly deck: readonly Card[];
    readonly cursor: number;
    readonly doubled: boolean;
}

export interface ResolvedState {
    readonly phase: 'resolved';
    readonly roundId: number;
    readonly wager: number;
    readonly player: readonly Card[];
    readonly dealer: readonly Card[];
    readonly deck: readonly Card[];
    readonly cursor: number;
    readonly doubled: boolean;
    readonly outcome: BlackjackOutcome;
    /** Total chips returned, including the wager. */
    readonly payout: number;
}

export type BlackjackState = BettingState | PlayingState | ResolvedState;

export function initialState(roundId = 1): BettingState {
    return { phase: 'betting', roundId };
}

export function scoreHand(cards: readonly Card[]): HandScore {
    let total = 0;
    let acesAsEleven = 0;
    for (const card of cards) {
        if (card.rank === 14) {
            total += 11;
            acesAsEleven += 1;
        } else {
            total += Math.min(card.rank, 10);
        }
    }
    while (total > 21 && acesAsEleven > 0) {
        total -= 10;
        acesAsEleven -= 1;
    }
    return { total, soft: acesAsEleven > 0 };
}

export function isBlackjack(cards: readonly Card[]): boolean {
    return cards.length === 2 && scoreHand(cards).total === 21;
}

function validateDeck(deck: readonly Card[]): void {
    if (deck.length < 4) throw new Error(`need at least 4 cards, got ${deck.length}`);
    const ids = new Set(deck.map(cardId));
    if (ids.size !== deck.length) throw new Error('deck contains a duplicate card');
}

function resolve(state: PlayingState, outcome: BlackjackOutcome, payout: number): ResolvedState {
    return { ...state, phase: 'resolved', outcome, payout };
}

function compareAfterDealer(state: PlayingState): ResolvedState {
    let next = state;
    let dealerScore = scoreHand(next.dealer);
    // Dealer stands on every 17, including soft 17.
    while (dealerScore.total < 17) {
        const card = next.deck[next.cursor];
        if (!card) throw new Error('deck exhausted while dealer was drawing');
        next = { ...next, dealer: [...next.dealer, card], cursor: next.cursor + 1 };
        dealerScore = scoreHand(next.dealer);
    }

    const playerTotal = scoreHand(next.player).total;
    if (dealerScore.total > 21) return resolve(next, 'win', next.wager * 2);
    if (playerTotal > dealerScore.total) return resolve(next, 'win', next.wager * 2);
    if (playerTotal === dealerScore.total) return resolve(next, 'push', next.wager);
    return resolve(next, 'loss', 0);
}

export function newRound(state: BettingState, wager: number, deck: readonly Card[]): PlayingState | ResolvedState {
    if (state.phase !== 'betting') throw new Error('newRound() requires the betting phase');
    if (!Number.isInteger(wager) || wager <= 0) throw new Error('wager must be a positive integer');
    validateDeck(deck);

    const playing: PlayingState = {
        phase: 'playing',
        roundId: state.roundId,
        wager,
        player: [deck[0]!, deck[2]!],
        dealer: [deck[1]!, deck[3]!],
        deck,
        cursor: 4,
        doubled: false,
    };
    const playerNatural = isBlackjack(playing.player);
    const dealerNatural = isBlackjack(playing.dealer);
    if (playerNatural && dealerNatural) return resolve(playing, 'push', wager);
    if (playerNatural) return resolve(playing, 'blackjack', Math.floor(wager * 2.5));
    if (dealerNatural) return resolve(playing, 'loss', 0);
    return playing;
}

export function hit(state: PlayingState): PlayingState | ResolvedState {
    if (state.phase !== 'playing') throw new Error('hit() requires the playing phase');
    const card = state.deck[state.cursor];
    if (!card) throw new Error('deck exhausted while player was drawing');
    const next: PlayingState = {
        ...state,
        player: [...state.player, card],
        cursor: state.cursor + 1,
    };
    const total = scoreHand(next.player).total;
    if (total > 21) return resolve(next, 'bust', 0);
    if (total === 21) return compareAfterDealer(next);
    return next;
}

export function stand(state: PlayingState): ResolvedState {
    if (state.phase !== 'playing') throw new Error('stand() requires the playing phase');
    return compareAfterDealer(state);
}

/** Double the total stake, take exactly one card, then force the dealer turn. */
export function doubleDown(state: PlayingState): ResolvedState {
    if (state.phase !== 'playing' || state.player.length !== 2 || state.doubled) {
        throw new Error('doubleDown() requires the first decision of a hand');
    }
    const card = state.deck[state.cursor];
    if (!card) throw new Error('deck exhausted while doubling down');
    const next: PlayingState = {
        ...state,
        wager: state.wager * 2,
        player: [...state.player, card],
        cursor: state.cursor + 1,
        doubled: true,
    };
    if (scoreHand(next.player).total > 21) return resolve(next, 'bust', 0);
    return compareAfterDealer(next);
}

export function nextRound(state: ResolvedState, roundId = state.roundId + 1): BettingState {
    if (state.phase !== 'resolved') throw new Error('nextRound() requires the resolved phase');
    return { phase: 'betting', roundId };
}

interface StoredRound {
    readonly v: 1;
    readonly roundId: number;
    readonly wager: number;
    readonly player: readonly Card[];
    readonly dealer: readonly Card[];
    readonly deck: readonly Card[];
    readonly cursor: number;
    readonly doubled: boolean;
}

export function serializeRound(state: PlayingState): string {
    const payload: StoredRound = { v: 1, ...state };
    return JSON.stringify(payload);
}

function isCard(value: unknown): value is Card {
    if (typeof value !== 'object' || value === null) return false;
    const { rank, suit } = value as { rank?: unknown; suit?: unknown };
    return typeof rank === 'number' && Number.isInteger(rank) && rank >= 2 && rank <= 14 &&
        (suit === 'H' || suit === 'D' || suit === 'S' || suit === 'C');
}

export function deserializeRound(raw: string | null): PlayingState | null {
    if (!raw) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = parsed as Partial<StoredRound>;
    if (value.v !== 1 || !Number.isInteger(value.roundId) || !Number.isInteger(value.wager) ||
        (value.wager as number) <= 0 || value.doubled !== false || !Number.isInteger(value.cursor)) return null;
    if (!Array.isArray(value.deck) || value.deck.length !== 52 || !value.deck.every(isCard)) return null;
    if (!Array.isArray(value.player) || value.player.length < 2 || !value.player.every(isCard)) return null;
    if (!Array.isArray(value.dealer) || value.dealer.length < 2 || !value.dealer.every(isCard)) return null;
    const cursor = value.cursor as number;
    if (cursor < 4 || cursor > value.deck.length) return null;
    if (new Set(value.deck.map(cardId)).size !== 52) return null;
    const used = [...value.player, ...value.dealer].map(cardId);
    if (new Set(used).size !== used.length || used.length !== cursor) return null;
    if (!used.every((id) => value.deck!.some((card) => cardId(card) === id))) return null;
    return {
        phase: 'playing', roundId: value.roundId as number, wager: value.wager as number,
        player: value.player, dealer: value.dealer, deck: value.deck, cursor, doubled: false,
    };
}
