// Every localStorage key the casino uses, in one place.
//
// Declaring keys here makes collisions visible and lets a hard reset clear
// every casino-owned document, including in-flight game state.
//
// Note: localStorage is per-origin. A bankroll saved on scampbella.github.io is
// invisible on scottcampbell.me (the CNAME) and vice versa — that's expected,
// not a bug.
export const BANKROLL_KEY = 'casino_bankroll';
export const POKER_ROUND_KEY = 'casino_poker_round';
/** Every persisted casino document. A hard reset must clear this complete list. */
export const CASINO_STORAGE_KEYS = [BANKROLL_KEY, POKER_ROUND_KEY];
