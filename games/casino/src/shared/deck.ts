// Deck construction and shuffling.
//
// Randomness is injected, never reached for. Callers at the DOM boundary pass
// Math.random; tests pass a deterministic source, or skip this module entirely
// and hand a fixed card array straight to the game machine.

import type { Card } from './cards.ts';
import { RANKS, SUITS } from './cards.ts';

export type Rng = () => number;

/** A fresh, ordered 52-card deck. */
export function freshDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle(cards: readonly Card[], rng: Rng = Math.random): Card[] {
    const out = cards.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const a = out[i]!;
        const b = out[j]!;
        out[i] = b;
        out[j] = a;
    }
    return out;
}

/** A shuffled 52-card deck, ready to slice a round off the top. */
export function dealDeck(rng: Rng = Math.random): Card[] {
    return shuffle(freshDeck(), rng);
}
