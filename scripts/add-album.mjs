import sharp from "sharp";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALBUMS_DIR = join(__dirname, "..", "assets", "images", "albums");

// ── CLI ──────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { spotifyUrl: "", blurb: "", artist: "", releaseDate: "", durationMs: null };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "-u" || args[i] === "--spotify-url") && i + 1 < args.length)
      opts.spotifyUrl = args[++i];
    else if ((args[i] === "-b" || args[i] === "--blurb") && i + 1 < args.length)
      opts.blurb = args[++i];
    else if ((args[i] === "-a" || args[i] === "--artist") && i + 1 < args.length)
      opts.artist = args[++i];
    else if ((args[i] === "-r" || args[i] === "--release-date") && i + 1 < args.length)
      opts.releaseDate = args[++i];
    else if ((args[i] === "-d" || args[i] === "--duration") && i + 1 < args.length)
      opts.durationMs = parseDuration(args[++i]);
  }
  return opts;
}

function parseDuration(val) {
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  const m = val.match(/^(\d+):(\d{2})$/);
  if (!m) throw new Error(`Invalid duration format: ${val}. Use "M:SS" or milliseconds.`);
  return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000;
}

function extractId(url) {
  const m = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);
  if (!m) throw new Error(`Could not extract album ID from URL: ${url}`);
  return m[1];
}

function safeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ── Spotify API mode ──────────────────────────────────────────
async function getAccessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Spotify auth failed (${resp.status}): ${body}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function fetchAlbumApi(token, albumId) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Spotify album fetch failed (${resp.status}): ${body}`);
  }
  return resp.json();
}

function buildMetaFromApi(album) {
  const totalMs = album.tracks.items.reduce((sum, t) => sum + t.duration_ms, 0);
  const images = album.images || [];
  const largest = images[0];
  return {
    name: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
    durationMs: totalMs,
    coverUrl: largest?.url || null,
    coverWidth: largest?.width || 0,
    coverHeight: largest?.height || 0,
  };
}

// ── Fallback: oEmbed ──────────────────────────────────────────
async function fetchAlbumOembed(spotifyUrl) {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
  const resp = await fetch(oembedUrl);
  if (!resp.ok) throw new Error(`oEmbed fetch failed (${resp.status})`);
  const data = await resp.json();
  const name = (data.title || "").replace(/\s*\|\s*Spotify$/, "").trim();
  // Swap 300px size code (00001e02) for 640px (0000b273)
  const coverUrl = (data.thumbnail_url || "").replace(/00001e02/, "0000b273");
  return { name, coverUrl };
}

// ── Image pipeline ────────────────────────────────────────────
async function downloadCover(url, destPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download cover (${resp.status})`);
  await pipeline(resp.body, createWriteStream(destPath));
  console.log(`  Downloaded cover → ${basename(destPath)}`);
}

async function convertToAvif(jpgPath) {
  const base = basename(jpgPath, ".jpg");
  const dir = dirname(jpgPath);
  const md = await sharp(jpgPath).metadata();
  const origW = md.width || 0;
  const sizes = [
    { width: 640, suffix: "-sm" },
    { width: 1280, suffix: "-md" },
  ];
  for (const s of sizes) {
    const outPath = join(dir, `${base}${s.suffix}.avif`);
    await sharp(jpgPath)
      .resize({ width: Math.min(s.width, origW), withoutEnlargement: true, fit: "inside" })
      .avif({ quality: 65, effort: 4 })
      .toFile(outPath);
    console.log(`  Converted → ${basename(outPath)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (!opts.spotifyUrl || !opts.blurb) {
    console.error("Usage: node scripts/add-album.mjs -u <spotify-url> -b <blurb> [-a <artist>] [-r <release-date>] [-d <duration>]");
    console.error("");
    console.error("  -u, --spotify-url   Spotify album URL (required)");
    console.error("  -b, --blurb         Blurb text (required)");
    console.error("  -a, --artist        Artist name (fallback mode)");
    console.error("  -r, --release-date  Release date YYYY-MM-DD (fallback mode)");
    console.error("  -d, --duration      Duration as M:SS or milliseconds (fallback mode)");
    console.error("");
    console.error("  Env vars for automatic metadata:");
    console.error("    SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET");
    process.exit(1);
  }

  const albumId = extractId(opts.spotifyUrl);
  console.log(`Album ID: ${albumId}`);

  let meta;
  const token = await getAccessToken();

  if (token) {
    console.log("Using Spotify API (credentials found)…");
    const album = await fetchAlbumApi(token, albumId);
    meta = buildMetaFromApi(album);
    console.log(`  Album:    ${meta.name}`);
    console.log(`  Artist:   ${meta.artist}`);
    console.log(`  Released: ${meta.releaseDate}`);
    console.log(`  Tracks:   ${meta.totalTracks}`);
    console.log(`  Length:   ${formatDuration(meta.durationMs)}`);
    console.log(`  Cover:    ${meta.coverWidth}×${meta.coverHeight}`);
  } else {
    console.log("No Spotify credentials — using oEmbed fallback.");
    if (!opts.artist) console.log("  (Tip: pass -a \"Artist Name\")");
    if (!opts.releaseDate) console.log("  (Tip: pass -r YYYY-MM-DD)");
    if (!opts.durationMs) console.log("  (Tip: pass -d M:SS)");

    const oembed = await fetchAlbumOembed(opts.spotifyUrl);
    meta = {
      name: oembed.name,
      artist: opts.artist || "",
      releaseDate: opts.releaseDate || null,
      totalTracks: null,
      durationMs: opts.durationMs,
      coverUrl: oembed.coverUrl,
      coverWidth: 640,
      coverHeight: 640,
    };
    console.log(`  Album:    ${meta.name}`);
    console.log(`  Artist:   ${meta.artist || "(not provided)"}`);
    if (meta.releaseDate) console.log(`  Released: ${meta.releaseDate}`);
    if (meta.durationMs) console.log(`  Length:   ${formatDuration(meta.durationMs)}`);
  }

  // Download + convert cover
  const filename = safeFilename(meta.name);
  const jpgPath = join(ALBUMS_DIR, `${filename}.jpg`);

  let exists = false;
  try { await access(jpgPath); exists = true; } catch { /* new file */ }

  if (exists) {
    console.log(`  Cover exists at ${basename(jpgPath)}, skipping.`);
  } else if (meta.coverUrl) {
    console.log("Downloading cover art…");
    await downloadCover(meta.coverUrl, jpgPath);
    console.log("Converting to AVIF…");
    await convertToAvif(jpgPath);
  }

  // Print JS object
  const relDate = meta.releaseDate
    ? (meta.releaseDate.length === 4 ? `${meta.releaseDate}-01-01` : meta.releaseDate)
    : "YYYY-MM-DD";

  console.log("\n── Paste into albums array in albums/index.html ──\n");
  console.log(`    {`);
  console.log(`        name: ${JSON.stringify(meta.name)},`);
  console.log(`        artist: ${JSON.stringify(meta.artist)},`);
  console.log(`        date: "${new Date().toISOString().split("T")[0]}",  // today — adjust if needed`);
  console.log(`        releaseDate: ${JSON.stringify(meta.releaseDate || "YYYY-MM-DD")},`);
  console.log(`        durationMs: ${meta.durationMs ?? "/* TODO */"},`);
  console.log(`        coverJpg: "../assets/images/albums/${filename}.jpg",`);
  console.log(`        coverAvifMd: "../assets/images/albums/${filename}-md.avif",`);
  console.log(`        coverAvifSm: "../assets/images/albums/${filename}-sm.avif",`);
  console.log(`        spotify: ${JSON.stringify(opts.spotifyUrl)},`);
  console.log(`        blurb: ${JSON.stringify(opts.blurb)}`);
  console.log(`    },`);
  console.log("");
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
