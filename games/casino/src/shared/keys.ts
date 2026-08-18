// Every localStorage key the casino uses, in one place.
//
// Yahtzee's solo and versus modes accidentally share a high-score key (see
// games/yahtzee/CLAUDE.md) because keys were written inline at each call site.
// Declaring them here means a collision is visible at a glance.
//
// Note: localStorage is per-origin. A bankroll saved on scampbella.github.io is
// invisible on scottcampbell.me (the CNAME) and vice versa — that's expected,
// not a bug.

export const BANKROLL_KEY = 'casino_bankroll';
export const POKER_ROUND_KEY = 'casino_poker_round';
