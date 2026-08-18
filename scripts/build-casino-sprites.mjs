// build-casino-sprites.mjs — extract the casino sprite sheets from the itch.io
// source zip into games/casino/assets/.
//
// Run: node scripts/build-casino-sprites.mjs
//
// Pixel art ships as lossless PNG, not the site-wide -md.avif convention (that
// convention targets photos). See games/casino/CLAUDE.md.
//
// The card source packs 48x64 cards edge-to-edge with zero padding. At a
// fractional devicePixelRatio an integer CSS scale still rasterizes
// fractionally, which samples a 1px sliver of the neighbouring card. So rather
// than copying the sheet verbatim we re-pack it into 50x66 cells with each card
// inset 1px, leaving a transparent gutter that absorbs the bleed.

import { createRequire } from 'node:module';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const assetsDir = join(repoRoot, 'games', 'casino', 'assets');
const zipPath = join(assetsDir, 'Poker cards 1.3.zip');

// Source sheet geometry (verified against the pack).
const CARD_W = 48;
const CARD_H = 64;
const COLS = 15;
const ROWS = 5;

// Output cell geometry: card inset by INSET on every side.
const INSET = 1;
const CELL_W = CARD_W + INSET * 2; // 50
const CELL_H = CARD_H + INSET * 2; // 66

const CARDS_SRC = 'Poker cards 1.3/1.2 Poker cards.png';
const CHIPS_SRC = 'Poker cards 1.3/fiches addon (Poker Cards).png';

/** Read a single file out of the zip without shelling out to `unzip`. */
function readFromZip(zip, member) {
    // Node has no zip reader, but Python 3 is always present on this box and
    // `unzip` is not. Keep the dependency surface at zero.
    return execFileSync(
        'python3',
        ['-c', 'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', zip, member],
        { maxBuffer: 64 * 1024 * 1024 },
    );
}

async function buildCards(srcBuf) {
    // Extract each card individually and re-composite onto a gutter grid.
    const tiles = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            // Row 4 holds only 8 card backs; rows 1-3 only 13 faces.
            if (row === 4 && col >= 8) continue;
            if (row >= 1 && row <= 3 && col >= 13) continue;

            const tile = await sharp(srcBuf)
                .extract({ left: col * CARD_W, top: row * CARD_H, width: CARD_W, height: CARD_H })
                .toBuffer();

            tiles.push({
                input: tile,
                left: col * CELL_W + INSET,
                top: row * CELL_H + INSET,
            });
        }
    }

    return sharp({
        create: {
            width: COLS * CELL_W,
            height: ROWS * CELL_H,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite(tiles)
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
}

async function main() {
    if (!existsSync(zipPath)) {
        console.error(`Source zip not found: ${zipPath}`);
        console.error();
        console.error('cards.png and chips.png are already committed, so you only need this');
        console.error('script to regenerate them. The source zip is deliberately not committed');
        console.error('(*.zip is gitignored) — re-download the "Poker cards 1.3" pack from');
        console.error('itch.io and drop it back at the path above to run this again.');
        process.exit(1);
    }

    mkdirSync(assetsDir, { recursive: true });

    const cardsSrc = readFromZip(zipPath, CARDS_SRC);
    const cardsOut = await buildCards(cardsSrc);
    const cardsPath = join(assetsDir, 'cards.png');
    const { width: cw, height: ch } = await sharp(cardsOut).metadata();
    await sharp(cardsOut).toFile(cardsPath);
    console.log(`cards.png  ${cw}x${ch}  (${COLS}x${ROWS} cells of ${CELL_W}x${CELL_H}, ${CARD_W}x${CARD_H} inset ${INSET})`);

    // Chips need no repack — the source already has 16px of transparent gutter
    // between the 32px-wide sprites.
    const chipsSrc = readFromZip(zipPath, CHIPS_SRC);
    const chipsPath = join(assetsDir, 'chips.png');
    await sharp(chipsSrc).png({ compressionLevel: 9, palette: true }).toFile(chipsPath);
    const { width: hw, height: hh } = await sharp(readFileSync(chipsPath)).metadata();
    console.log(`chips.png  ${hw}x${hh}  (8x4 cells of 48x48)`);

    console.log('\nDone. The source zip can now be deleted.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
