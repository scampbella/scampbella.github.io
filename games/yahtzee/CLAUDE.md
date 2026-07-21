# Yahtzee — notes for agents

Self-contained Yahtzee game (solo + 1v1 vs the "Keiri" bot) on a static
GitHub Pages site. Written in TypeScript under `src/`, compiled and concatenated
into a single `game.js` that the page actually loads.

## ⚠️ The one thing you must not forget: rebuild `game.js`

`index.html` loads **`game.js`** — a build artifact. Editing files under `src/`
changes nothing the browser sees until you rebuild:

```
node build.mjs        # compiles src/*.ts → build/*.js, concatenates → game.js
```

`game.js` **is committed** (deploy runs no build step). So a change isn't done
until `src/*.ts` **and** the rebuilt `game.js` are both saved. Never hand-edit
`game.js` — it will be overwritten on the next build.

- `build.mjs` compiles with `npx tsc --project src/tsconfig.json`, then
  concatenates `build/*.js` in a **hardcoded file-order list** inside `build.mjs`.
  If you add/rename/delete a `.ts` file under `src/`, update that list too.
- `src/tsconfig.json` is required by the build. It is intentionally **not** in
  `.gitignore` anymore, but confirm it exists before building (target ES2020,
  comments preserved, `module: none` so files share one global scope — there are
  no `import`/`export` statements; everything is concatenated into global scope).
- `build/` is throwaway intermediate output and is gitignored.

## Ruleset: BuddyBoardGames (BBG) — forced Joker

This game follows the **real buddyboardgames.com rules**, which use the
**standard forced Joker** (a.k.a. "Hasbro" Joker). When a Yahtzee is rolled and
the Yahtzee box is already filled (any score, including 0), it is a wild card and
placement is **restricted**, checked in order (`Scorecard.jokerForcedCategories`):

1. Matching upper box open → **must** score there.
2. Else if any Lower box open → **must** score in an open Lower box (Full House 25
   / Sm 30 / Lg 40 as Joker values).
3. Else → score 0 in an open Upper box.

The +100 Yahtzee bonus is awarded on any additional Yahtzee **only when the
Yahtzee box holds 50** (a zeroed Yahtzee still acts as a wild card but earns no
bonus). See `rules.md` for the full spec — keep it in sync with the code.

### Naming trap ⚠️

The bundled bot library `KeiriTS/` labels its **free-choice** Joker variant
`"bbg"` and its **forced** variant `"hasbro"`. That naming is backwards vs. the
actual BBG site. This game wants **forced** placement, so the vendored bot
(`src/bot.ts`) has been modified to force **regardless** of the `ruleset`
argument. Do not "fix" it back to the library's `"bbg"` free-choice behavior.

## File map

`src/` (source of truth) → concatenated into `game.js`:

| File | Role |
|------|------|
| `types.ts` | interfaces + `Section` enum |
| `scoring.ts` | pure dice-scoring helpers (`isYahtzee`, `isStraight`, …) |
| `categories.ts` | the 13 category definitions |
| `dice.ts` | `Dice` (values, locks) |
| `scorecard.ts` | `Scorecard` (scores, bonuses, **`jokerForcedCategories`**) |
| `game.ts` | `Game` — solo engine |
| `ui.ts` | `UI` — solo renderer |
| `bot.ts` | `KeiriBot` heuristic (vendored copy of `KeiriTS`, forced-Joker patched) |
| `versus-game.ts` | `VersusGame` — 1v1 engine + async bot turn |
| `versus-ui.ts` | `VersusUI` — dual-scorecard renderer |
| `main.ts` | boot, mode switching, localStorage save/load |

`KeiriTS/` is the upstream bot library (own tests/benchmark). `src/bot.ts` is a
trimmed, patched copy of `KeiriTS/src/bot/index.ts` — changes to bot behavior
usually belong in `src/bot.ts` (that's what ships).

## State & persistence gotchas

- Save state lives in `localStorage` (`yahtzee_save_state`); high score in
  `yahtzee_high_score`. **Solo and versus currently share the same high-score
  key** despite a "separate from solo" comment in `versus-ui.ts` — known quirk.
- The versus bot turn is an `async` loop in `VersusGame.executeBotTurn()`; it
  autosaves mid-turn. On reload mid-bot-turn the loop is gone, so
  `resumeBotTurnIfNeeded()` (called from `main.ts`) restarts a fresh bot turn to
  avoid a soft-lock. The bot only writes its scorecard at the very end of its
  turn, which is what makes a clean restart safe — preserve that invariant.
- `deserialize()` trusts the saved shape; changing the save schema can break old
  saves (loads are `try/catch`-guarded but may leave a partial object).

## Testing without a browser

`game.js` runs `document.addEventListener('DOMContentLoaded', …)` at load, so you
can't `require` it directly. To exercise the pure logic (scoring, Joker forcing,
bot decisions), run `game.js` in a `vm` context with tiny `document`/
`localStorage`/`setTimeout` stubs, then append test code in the **same** script
string (top-level `class`/`const` live in that script's scope, not on the
sandbox global). This is how the Joker tiers were verified.

## Before you push

- [ ] `node build.mjs` — no errors
- [ ] `game.js` rebuilt and committed alongside the `src/` change
- [ ] Solo: roll, lock, score, game-over all work
- [ ] Versus: "Challenge Keiri" plays a bot turn and hands control back
- [ ] `rules.md` still matches the code if you touched scoring/Joker logic
