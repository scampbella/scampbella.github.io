# Casino — notes for agents

A collection of classic casino games at `games/casino/`. Landing on
`games/casino/` shows a "Welcome to the Casino" hub; **Video Poker is built and
playable**, Blackjack / Hearts / Slots are Coming Soon tiles.

Build order: poker (done) → blackjack → hearts → slots.

## ⚠️ Rebuild `js/` — it is a committed build artifact

The pages load `games/casino/js/**`, compiled from `games/casino/src/**`. There
is no CI (see root `CLAUDE.md`), so a change isn't done until both the `.ts`
source and the rebuilt `.js` are committed.

```
npm run build:casino    # wipes js/, then tsc -p games/casino/tsconfig.json
npm run test:casino     # node --test over src/**/*.test.ts
npm run check:casino    # rebuild + fail if committed js/ has drifted
```

Never hand-edit anything in `js/`.

## Architecture — deliberately not yahtzee's

Yahtzee compiles with `module: none` and concatenates into one global-scope
`game.js`. Its own `games/yahtzee/CLAUDE.md` documents what that costs: a
hardcoded file-order list to maintain by hand, a bundle that self-executes on
`DOMContentLoaded` so testing pure logic needs a `vm` sandbox with stubbed
`document`/`localStorage`, and solo/versus accidentally sharing a storage key.

Casino emits **native ES modules** instead (`<script type="module">` — the first
on this site). No bundler, no concatenation, no file-order list; tests are plain
imports. Don't "modernise" this back into a `build.mjs`.

### tsconfig settings that are load-bearing

Three of them prevent *silent* failures and were each verified by experiment:

- **`verbatimModuleSyntax`** — Node's type stripping is not type-directed, so
  `import { Card }` where `Card` is an interface compiles fine under `tsc` but
  throws `does not provide an export named 'Card'` when `node --test` runs the
  `.ts`. The browser build works; only the tests break. Always `import type`.
- **`games/casino/package.json` with `"type": "module"`** — without it,
  `module: nodenext` resolves format from the *root* package.json (no `"type"`)
  and silently emits **CommonJS**. `tsc` exits 0 and the page dies with
  `exports is not defined`.
- **`moduleResolution: nodenext`** — turns an extensionless `import './dep'`
  into a compile error instead of a 404 in the browser.

Also: `erasableSyntaxOnly` (so Node can run the sources directly) bans `enum`,
`namespace`, and parameter properties — `HandRank` is an `as const` object plus
a derived union for this reason. Test files are `exclude`d from the emit build
because `@types/node` isn't installed; they'd otherwise error *and still be
emitted* into the shipped `js/`.

Source imports write `./deck.ts`; `rewriteRelativeImportExtensions` makes tsc
emit `./deck.js`. That's what lets Node run the same files without a build.

### Module layout

```
src/shared/   keys.ts  cards.ts  deck.ts  bankroll.ts  format.ts
src/poker/    hands.ts  machine.ts  ui.ts  main.ts  (+ *.test.ts)
src/hub/      main.ts
```

`cards.ts`, `deck.ts`, `hands.ts`, and `machine.ts` **never touch the DOM,
storage, or `Math.random`, and do nothing at import time.** That is what makes
them testable. Keep it that way — blackjack will reuse all four.

## Decisions made (confirmed with Scott — don't re-litigate)

- **Art style: retro pixel-art**, from the `Poker cards 1.3` itch.io pack.
  Rendered via CSS `background-position` at integer scale with
  `image-rendering: pixelated`.
- **First game: Video Poker, Jacks or Better, 9/6 paytable.** No opponents.
  Royal 800 / SF 50 / Quads 25 / **FH 9** / **Flush 6** / Straight 4 / Trips 3 /
  Two Pair 2 / Jacks+ 1. The "9/6" names the Full House and Flush multipliers —
  they're the house-edge knob; don't change the others without saying so.
- **Betting is free-form**: any whole wager up to the balance, with ½ / ×2 /
  All-in helpers. Scott chose this over denomination-style 1–5 coin betting
  precisely so large shared-bank wagers are possible, which is why there is no
  max-bet Royal bonus.
- **Payout is TOTAL RETURNED, not profit** — so Jacks-or-Better at ×1 hands the
  wager back and nets zero. That's what keeps 9/6 at its real ~99.5% RTP.
  Scott has said the return math is changeable later; it's a one-line change in
  `hands.ts`.
- **Bankroll is persistent and shared across all casino games**, starting at
  1000, with lifetime stats. Re-buy tops it back up and keeps stats; hard reset
  wipes both.

Blackjack, Hearts, and Slots rulesets are **not decided yet**.

## Bankroll invariants

`shared/bankroll.ts` owns all persistence. Two rules it is built around:

1. **The balance is never cached in memory.** Every mutation is a synchronous
   read-modify-write against storage. Two tabs that each cache 1000, wager 100
   and 50, then write back 900 and 950 have destroyed 100 chips — a `storage`
   event listener only picks which tab wins. Doing the whole read-modify-write
   in one task is effectively atomic, because localStorage is synchronous.
2. **Money moves at most once per round.** `takeWager` and `settle` are keyed by
   `roundId` and no-op if that round already moved, so a double-click, a
   re-render, or a restored save can't double-charge or double-pay.

Storage keys live in `shared/keys.ts` — add new ones there, never inline.
Note localStorage is per-origin: a balance on `scampbella.github.io` is invisible
on `scottcampbell.me` (the CNAME). That's expected, not a bug.

Poker also persists the in-flight round (`casino_poker_round`) because the wager
is taken at deal — without it a mid-hand reload would pocket the bet.

## Assets

`assets/cards.png` and `assets/chips.png` are generated by
`scripts/build-casino-sprites.mjs` (`npm run build:casino-sprites`) from the
`Poker cards 1.3` itch.io zip. **The zip is not committed** (`*.zip` is
gitignored); re-download it from itch.io and drop it at
`games/casino/assets/Poker cards 1.3.zip` if you need to regenerate.

Pixel art ships as lossless PNG — an intentional deviation from the site-wide
`-md.avif` convention, which targets photos.

### `cards.png` — 750×330

⚠️ An earlier version of this doc claimed the source card sheet was "not cleanly
sliceable". **That was wrong.** It came from alpha-gap detection, which fails
only because the cards are opaque and packed edge-to-edge. The source is a
perfectly uniform 48×64 grid, 15 cols × 5 rows, origin (0,0).

The build script re-packs it into **50×66 cells with each card inset 1px**. The
gutter is not cosmetic: at a fractional `devicePixelRatio` (1.25/1.5, common on
Windows) an integer CSS scale still rasterizes fractionally and samples a sliver
of the neighbouring card.

| Row | Contents |
|---|---|
| 0 | Hearts A,2…10,J,Q,K, then red Joker (col 13), black Joker (col 14) |
| 1 / 2 / 3 | Diamonds / Spades / Clubs, A–K in cols 0–12 |
| 4 | 8 card backs (cols 0–7). Col 4 is the canonical blue back. |

Ranks are stored 2–14 (14 = Ace), so `col = rank === 14 ? 0 : rank - 1`.
Jokers are unused by poker.

### `chips.png` — 368×192

8 colours × 4 stack heights. Cell pitch 48×48; sprite content is 32×44, inset
4px from the cell top. For cell (row `r` 0–3, col `c` 0–7):
colour = `r + (c < 4 ? 0 : 4)`, stack height = `(c % 4) + 1`.

Unused from the pack: `minicards.png` (superseded — we have full-size faces) and
`Deck of cards ( full cards ).png` (stacked-deck backs only).

## Layout / CSS notes

`casino.css` holds the tokens, the sprite rules, and the hub; `poker/poker.css`
holds the table. Neither page loads `css/style.css` or `css/tailwind.css` — they
are self-contained like yahtzee. Class names are deliberately bespoke so that
Tailwind scanning `./games/**/*.html` produces no new utilities and leaves
`css/tailwind.css` byte-identical.

`--scale` must stay an **integer**. Breakpoints step 4→3→2→1 so that all five
cards always fit on screen (a scrolling hand would mean choosing holds blind);
each one engages just before the previous scale would overflow. `background-size`
is always stated explicitly — `cover`/`contain` would destroy pixel alignment.

## Local dev gotcha

Use the **trailing slash**: `http://localhost:3001/games/casino/poker/`. Without
it `server.js` serves `index.html` without redirecting, so relative module
specifiers resolve one directory too high and the page silently blanks. GitHub
Pages issues a proper 301, so this is local-only.

## Progress

- [x] Sprites extracted and re-packed; zip removed and gitignored
- [x] ES-module build (`tsconfig.json`, nested `package.json`, npm scripts)
- [x] Shared core: keys, cards, deck, format, bankroll
- [x] Hand evaluator + tests (incl. exhaustive all-2,598,960-hands frequency check)
- [x] Round state machine + tests (deal-10 model, round persistence)
- [x] Poker UI, hub, `games/index.html` card flipped to "Play Now"
- [ ] Decide Blackjack ruleset, then build
- [ ] Decide Hearts ruleset, then build
- [ ] Decide Slots ruleset, then build
