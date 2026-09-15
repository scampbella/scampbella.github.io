# scampbella.github.io — notes for agents

Personal static site hosted on GitHub Pages (`<user>.github.io` repo). Plain
HTML/CSS/JS for the main pages, Tailwind for styling, vanilla TypeScript for
games. See `readme.md` for the directory structure and build commands.

## ⚠️ No CI — built files must be committed

There is no `.github/workflows` and no build step in the deploy path: GitHub
Pages serves whatever is on `main` directly, on every push. That means
generated files have to be committed alongside their sources, or the live
site silently goes stale:

- `css/tailwind.css` — rebuild with `npm run build:css` after editing
  `css/style.css`.
- `games/yahtzee/game.js` — rebuild with `node build.mjs` (from
  `games/yahtzee/`) after editing anything under `src/`. See
  `games/yahtzee/CLAUDE.md` for the full yahtzee build/ruleset notes — that
  file is nested and loads automatically when working in that subtree; don't
  duplicate its content here.
- `games/casino/js/` — rebuild with `npm run build:casino` after editing
  anything under `games/casino/src/`. Unlike yahtzee this is a directory of ES
  modules, not one bundle, so a renamed source file can leave an orphan behind;
  the build script clears the directory first. `npm run check:casino` fails if
  the committed output has drifted from the source. See
  `games/casino/CLAUDE.md`.

Follow `readme.md`'s pre-deploy checklist before pushing anything that
touches CSS or the yahtzee source.

## Images: single medium AVIF, no committed originals

Every image on the site ships as one committed file: `<name>-md.avif`. There
are no `-sm`/`-lg` variants and no committed `.jpg`/`.png`/`.webp` originals —
`scripts/convert-to-avif.mjs` (`npm run convert-images`) takes a local,
gitignored original as input and writes only the `-md.avif` output. If you're
adding a new image, drop the original in the right `assets/images/` subfolder,
run the conversion script, commit only the resulting `-md.avif`, and delete
the original from your working copy (or leave it — it's gitignored, but
don't `git add` it).

The `album-of-the-week` skill (`~/.claude/skills/album-of-the-week/SKILL.md`)
follows this same single-size convention when adding a new album cover.

## Game structure

Each game under `games/<name>/` is self-contained, including its own
`assets/` subfolder for cover art and game-specific images — don't add new
assets under a top-level `assets/games/`.
