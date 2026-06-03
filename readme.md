# scottcampbell.me

Static personal site hosted on GitHub Pages. Plain HTML/CSS/JS with Tailwind for the main pages and vanilla TypeScript for games.

## Structure

```
.                    — root pages (index.html, 404.html, albums, blogs)
css/                 — Tailwind (style.css → tailwind.css) + game styles
js/                  — site-wide JS
games/               — standalone games, each self-contained
  yahtzee/           —   Yahtzee with Keiri bot (TypeScript → game.js)
  clicker/           —   incremental clicker
scripts/             — build helpers (image conversion)
assets/              — images, PDFs
```

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
