---
name: album-of-the-week
description: "Update the Album of the Week on scampbella.github.io. Provide a Spotify album URL and a blurb; the skill fetches metadata, downloads + converts cover art, updates index.html and js/albums.js."
---

# Album of the Week

Update the Album of the Week section on the homepage and add the entry to the rotation archive — all in one shot.

## Usage

```
/album-of-the-week https://open.spotify.com/album/ALBUM_ID

The blurb will be requested interactively.

Or provide everything inline:
/album-of-the-week https://open.spotify.com/album/ALBUM_ID --date 2026-07-07 --blurb "My blurb here"
```

## What It Does

1. Fetches album metadata (artist, name, release date, cover art) from the Spotify public page
2. Gets the duration (via web search when available, or asks user)
3. Downloads the full-size cover art (kept locally, not committed)
4. Converts it to a single AVIF (`-md.avif` at 1280w) — the only file committed to git
5. Updates `index.html` — replaces the entire "Album of the Week" section
6. Prepends the new album to the `albums` array in `js/albums.js`

## Step-by-Step

### Step 0 — Gather Inputs

If the user didn't provide a blurb, ask for it. The date defaults to today (`YYYY-MM-DD`) unless `--date` was given.

Extract the album ID from the URL — it's the path segment after `/album/`. The URL must match:
`https://open.spotify.com/album/ALBUM_ID`

The `ALBUM_ID` is a 22-character base62 string.

### Step 1 — Fetch Metadata

Use `read` on the Spotify album URL. The reader mode for Spotify returns structured metadata:

```
Title: <Album Name> - Album by <Artist> | Spotify
Description: <Artist> · album · <Year> · <N> songs
Release Date: YYYY-MM-DD
Thumbnail: <cover-url>
```

Parse from this output:
- **name**: the part before ` - Album by ` in the title
- **artist**: the part after `Album by ` and before ` | Spotify`
- **releaseDate**: the `Release Date` field directly (already `YYYY-MM-DD`)
- **coverUrl**: take the thumbnail URL and replace the size segment `ab67616d00001e02` with `ab67616d0000b273` to get the 640px version. The URL format is `https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02<rest-of-hash>` — only the `00001e02` part differs from 640px (`0000b273`). The full 640px URL is used for download; sharp will resize for the AVIF variants.

For **durationMs**, search the web:
```
"<Album Name>" <Artist> album duration tracklist
```
Or use `web_search` with the query `"<Album Name>" <Artist> album duration`.

If duration can't be found, ask the user to provide it in `H:MM:SS` or `MM:SS` format.

### Step 2 — Download Cover Art

The cover art is saved to `assets/images/albums/` in the project root at `~/projects/scampbella.github.io`. This original is a local conversion input only — it's gitignored (see `.gitignore`) and must not be committed; only the `-md.avif` output from Step 3 is.

First, compute the safe filename slug:
```py
slug = name.lower()
slug = re.sub(r'[^a-z0-9]+', '-', slug)
slug = slug.strip('-')
```

Download the cover image:

```bash
curl -L -o "assets/images/albums/<slug>.jpg" "<cover-url>"
```

Run from the project root.

### Step 3 — Convert to AVIF

The project has `sharp` installed as a devDependency. Use it to generate AVIF variants.

From the project root:

```bash
node -e "
const sharp = require('sharp');
const path = require('path');

const slug = '<slug>';
const jpgPath = path.join('assets', 'images', 'albums', slug + '.jpg');
const dir = path.dirname(jpgPath);

async function convert() {
  const outPath = path.join(dir, slug + '-md.avif');
  await sharp(jpgPath)
    .resize({ width: 1280, withoutEnlargement: true, fit: 'inside' })
    .avif({ quality: 65, effort: 4 })
    .toFile(outPath);
  console.log('Created ' + outPath);
}
convert().catch(e => { console.error(e); process.exit(1); });
"
```

Replace `<slug>` with the actual slug.

### Step 4 — Update `js/albums.js`

The albums array in `js/albums.js` is a `const albums = [...]` array. New albums go at the beginning (index 0 of the array).

The album object structure:

```js
{
    name: "<Album Name>",
    artist: "<Artist>",
    date: "<YYYY-MM-DD>",
    releaseDate: "<YYYY-MM-DD>",
    durationMs: <milliseconds as integer>,
    coverAvif: "../assets/images/albums/<slug>-md.avif",
    spotify: "<original spotify URL>",
    blurb: "<blurb text>"
}
```

Prepend this object after `const albums = [` on line 1. Follow the existing formatting (4-space indent, trailing commas).

For the **blurb**: escape double quotes as `\"`, any `&` as `\&`, and any `<i>` or `</i>` HTML tags must be left as-is (the blurb renders as innerHTML). Unicode characters (em dashes, smart quotes) should be kept as literal Unicode — don't escape them.

For **durationMs**: convert the `H:MM:SS` or `MM:SS` string to total milliseconds:
- `MM:SS` → `(M * 60 + S) * 1000`
- `H:MM:SS` → `(H * 3600 + M * 60 + S) * 1000`

### Step 5 — Update `index.html`

Replace the entire Album of the Week section in `index.html`. The section is a `<section>` with the comment `<!-- Album of the Week -->` directly above it. The section starts at that comment and ends at the closing `</section>` tag before `<!-- Redesigned Personal Computers Section -->`.

Use the `SWAP` or `SWAP.BLK` edit on the section. The replacement HTML follows this exact template (substitute `{{...}}` placeholders):

```html
        <!-- Album of the Week -->
        <section class="bg-surface-container-lowest py-section-gap border-y border-outline-variant/30">
            <div class="max-w-container-max mx-auto px-margin-desktop">
                <div class="flex flex-col md:flex-row gap-16 items-center">
                    <div class="w-full md:w-1/2 relative group" id="aotw-cover-col">
                        <div
                            class="absolute -inset-4 bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                        </div>
                        <picture class="relative w-full aspect-square block">
                            <img alt="Album Cover"
                                class="w-full h-full object-cover rounded-3xl border-2 border-on-surface/20"
                                src="assets/images/albums/{{slug}}-md.avif" width="320" height="320">
                        </picture>

                    </div>
                    <div class="w-full md:w-1/2" id="aotw-content-col">
                        <span class="text-primary font-label-md tracking-[0.2em] mb-4 block uppercase">Currently
                            Listening</span>
                        <h2 class="font-headline-lg text-[48px] md:text-[64px] mb-2 text-on-surface">Album of the Week
                        </h2>
                        <div class="mb-8">
                            <h3 class="text-on-surface font-headline-md text-2xl">{{name_html}}</h3>
                            <p class="text-on-surface-variant font-body-md italic text-lg">by {{artist_html}}</p>
{{duration_line}}
                        </div>
                        <div class="mb-10">
                            <p id="aotw-blurb" class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                                {{blurb_html}}</p>
                            <a id="aotw-readmore" href="albums/"
                                class="hidden font-label-sm text-label-sm text-primary hover:underline mt-2 transition-colors">Read
                                more</a>
                        </div>
                        <div class="flex flex-wrap items-center gap-6">
                            <a class="flex items-center gap-3 px-6 py-2.5 rounded-full border-2 border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10 transition-all font-label-md group"
                                href="{{spotify_url}}" target="_blank"
                                rel="noopener noreferrer">
                                Listen on Spotify <span
                                    class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
```

The `id="aotw-cover-col"`, `id="aotw-content-col"`, `id="aotw-blurb"`, and
`id="aotw-readmore"` hooks are load-bearing — `js/main.js` uses them to cap
the blurb's height at the cover's height on desktop, cropping it and
revealing the "Read more" link (which points to `albums/`, not an inline
expand) whenever the text would otherwise make the content column taller
than the cover. Keep these ids exactly as shown; don't rename or drop them.

**Placeholder substitutions:**

- `{{slug}}` — the safe filename slug from Step 2
- `{{name_html}}` — album name, HTML-escaped: `&` → `&amp;`, `"` → `&quot;`, `<` → `&lt;`, `>` → `&gt;`
- `{{artist_html}}` — artist name, same HTML escaping
- `{{blurb_html}}` — blurb text, with `<i>` and `</i>` tags preserved but `&`, `"`, `<` (outside `<i>`), `>` (outside `<i>`) escaped. Smart quotes and em dashes are fine as literal Unicode.
- `{{spotify_url}}` — the original Spotify album URL, HTML-escaped (`&` → `&amp;`, `"` → `&quot;`)
- `{{duration_line}}` — if both release date AND duration are known:
  ```
                          <p class="font-label-sm text-on-surface-variant/50 mt-1">Released {{release_date_formatted}} · {{duration_formatted}}</p>
  ```
  If only release date is known:
  ```
                          <p class="font-label-sm text-on-surface-variant/50 mt-1">Released {{release_date_formatted}}</p>
  ```
  If only duration is known:
  ```
                          <p class="font-label-sm text-on-surface-variant/50 mt-1">{{duration_formatted}}</p>
  ```
  If neither is known, use an empty string for `{{duration_line}}`.

**Formatting helpers:**
- `{{release_date_formatted}}` — format `YYYY-MM-DD` as `Month DD, YYYY` (e.g. `March 12, 2001`)
- `{{duration_formatted}}` — format milliseconds as `M:SS` or `H:MM:SS` (e.g. `60:50`)

### Step 6 — Verify

After all edits, check:
- `index.html` has the new album info with correct cover path
- `js/albums.js` has the new album object at index 0
- Cover image exists: `assets/images/albums/<slug>-md.avif`
- Run `node --check js/albums.js` to verify syntax
- `git status` shows only the `-md.avif` as new/untracked for this album — the downloaded `<slug>.jpg` original should not appear (it's gitignored)

