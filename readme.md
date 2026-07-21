# scottcampbell.me

Static personal site hosted on GitHub Pages. Plain HTML/CSS/JS with Tailwind for the main pages and vanilla TypeScript for games.

## Structure

```
.                    — root pages (index.html, 404.html, albums, blogs)
css/                 — Tailwind (style.css → tailwind.css) + game styles
js/                  — site-wide JS
games/               — standalone games, each with its own assets/
  yahtzee/           —   Yahtzee with Keiri bot (TypeScript → game.js)
  clicker/           —   incremental clicker
  _upcoming/         —   placeholder cover art for not-yet-built games
scripts/             — build helpers (image conversion)
assets/              — images (medium AVIF only, see below), PDFs
```

Images are committed as a single `-md.avif` per source image (`scripts/convert-to-avif.mjs` / `npm run convert-images`) — no full-size originals or extra size tiers are checked into git. See `CLAUDE.md` for details.

## Build steps

| Step | Command | When |
|------|---------|------|
| Tailwind CSS | `npm run build:css` | After changing `css/style.css` |
| Yahtzee | `cd games/yahtzee && node build.mjs` | After changing `src/*.ts` |
| Convert images | `npm run convert-images` | After adding new images |

## Pre-deploy checklist

- [ ] `npm run build:css` — regenerates `css/tailwind.css`
- [ ] `cd games/yahtzee && node build.mjs` — rebuilds `game.js`
- [ ] Load the site and verify:
  - [ ] Home page renders, navigation works
  - [ ] All game pages load and function
  - [ ] Yahtzee: solo mode, versus mode, bot turn
- [ ] Check `git status` — no unexpected changes
- [ ] Commit built artifacts (`tailwind.css`, `game.js`)
- [ ] Push — GitHub Pages deploys `scottcampbell.me`
