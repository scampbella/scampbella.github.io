import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { access, unlink } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALBUMS_DIR = join(__dirname, "..", "assets", "images", "albums");

// ── CLI ──────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/add-album.mjs \"https://open.spotify.com/album/...\" [artist] [name] [duration] [releaseDate] [date] [blurb]");
    console.error("  Arguments after the URL are fallbacks used when the Spotify API isn't available.");
    process.exit(1);
  }
  const [spotifyUrl, artist, name, duration, releaseDate, date, ...blurbParts] = args;
  return {
    spotifyUrl,
    fallbackArtist: artist || "",
    fallbackName: name || "",
    fallbackDuration: parseDuration(duration),
    fallbackReleaseDate: releaseDate || "",
    fallbackDate: date || new Date().toISOString().slice(0, 10),
    fallbackBlurb: blurbParts.join(" ") || ""
  };
}

function parseDuration(val) {
  if (!val) return null;
  // Accept "HH:MM:SS", "MM:SS", or raw ms number
  const parts = val.split(":");
  if (parts.length === 3) return ((+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2])) * 1000;
  if (parts.length === 2) return ((+parts[0] * 60) + (+parts[1])) * 1000;
  const ms = parseInt(val, 10);
  return isNaN(ms) ? null : ms;
}

function extractId(url) {
  // Only match actual Spotify album URLs
  const match = url.match(/^https?:\/\/(?:open\.)?spotify\.com\/album\/([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1] : null;
}

function safeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Spotify API mode ──────────────────────────────────────────
async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET not set");

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    },
    body: "grant_type=client_credentials"
  });
  if (!resp.ok) throw new Error(`Spotify auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function fetchAlbumApi(token, albumId) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error(`Spotify API returned ${resp.status}`);
  return resp.json();
}

function buildMetaFromApi(album) {
  const cover = album.images?.[0]?.url || "";
  return {
    artist: album.artists?.map(a => a.name).join(", ") || "",
    name: album.name || "",
    coverUrl: cover,
    releaseDate: album.release_date || "",
    durationMs: album.tracks?.items?.reduce((sum, t) => sum + (t.duration_ms || 0), 0) || 0
  };
}

// ── Fallback: oEmbed ─────────────────────────────────────────
async function fetchAlbumOembed(spotifyUrl) {
  const resp = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  if (!resp.ok) throw new Error(`oEmbed failed: ${resp.status}`);
  return resp.json();
}

// ── Image pipeline ────────────────────────────────────────────
async function downloadCover(url, destPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Cover download failed: ${resp.status}`);
  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Cover URL returned non-image content-type: ${contentType}`);
  }
  const contentLength = resp.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    throw new Error(`Cover image exceeds 10MB limit: ${contentLength} bytes`);
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  await writeFile(destPath, buf);
}

async function convertToAvif(jpgPath) {
  const dir = dirname(jpgPath);
  const name = safeFilename(jpgPath.replace(/\.(jpe?g)$/i, ""));
  const sizes = [
    { width: 640, suffix: "-sm" },
    { width: 1280, suffix: "-md" },
  ];
  for (const size of sizes) {
    const outPath = join(dir, `${name}${size.suffix}.avif`);
    await sharp(jpgPath)
      .resize({ width: size.width, withoutEnlargement: true, fit: "inside" })
      .avif({ quality: 65, effort: 4 })
      .toFile(outPath);
    console.log(`  Created ${name}${size.suffix}.avif`);
  }
  console.log("  AVIF conversion complete.");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  // Ensure albums directory exists
  try { await access(ALBUMS_DIR); } catch { await mkdir(ALBUMS_DIR, { recursive: true }); }

  let meta = {
    artist: opts.fallbackArtist,
    name: opts.fallbackName,
    coverUrl: "",
    releaseDate: opts.fallbackReleaseDate,
    durationMs: opts.fallbackDuration
  };

  // Try Spotify API first
  const albumId = extractId(opts.spotifyUrl);
  if (!albumId) {
    console.error("Error: Could not extract album ID from URL.");
    console.error("URL must match: https://open.spotify.com/album/ALBUM_ID");
    process.exit(1);
  }

  let usedApi = false;
  try {
    const token = await getAccessToken();
    const album = await fetchAlbumApi(token, albumId);
    meta = { ...meta, ...buildMetaFromApi(album) };
    usedApi = true;
    console.log("✓ Fetched metadata via Spotify API.");
  } catch (e) {
    console.warn(`Spotify API unavailable (${e.message}), trying oEmbed fallback...`);
  }

  // Fallback: oEmbed
  if (!usedApi) {
    try {
      const oembed = await fetchAlbumOembed(opts.spotifyUrl);
      if (oembed.thumbnail_url) {
        meta.coverUrl = oembed.thumbnail_url.replace(/\/cover\//, "/source/");
        if (!meta.coverUrl.endsWith(".jpg")) meta.coverUrl += ".jpg";
      }
      if (!meta.name && oembed.title) meta.name = oembed.title;
      console.log("✓ Fetched metadata via Spotify oEmbed.");
    } catch (e) {
      console.warn(`oEmbed unavailable (${e.message}), using fallback values.`);
    }
  }

  if (!meta.name) {
    console.error("Error: Could not determine album name. Provide a fallback name as the third CLI argument.");
    process.exit(1);
  }

  console.log(`\nAlbum: ${meta.name}`);
  console.log(`Artist: ${meta.artist || "(unknown)"}`);
  console.log(`Duration: ${meta.durationMs ? formatDuration(meta.durationMs) : "(unknown)"}`);

  // Download cover
  let jpgPath = null;
  if (meta.coverUrl) {
    console.log(`\nDownloading cover...`);
    jpgPath = join(ALBUMS_DIR, `${safeFilename(meta.name)}.jpg`);
    try {
      await downloadCover(meta.coverUrl, jpgPath);
      console.log(`  Saved: ${jpgPath}`);
      await convertToAvif(jpgPath);
    } catch (e) {
      console.error(`  Cover download failed: ${e.message}`);
      // Clean up partial download
      try { await unlink(jpgPath); } catch {}
      jpgPath = null;
    }
  }

  // Output the HTML snippet
  const escapedName = meta.name.replace(/"/g, "&quot;");
  const escapedArtist = (meta.artist || "").replace(/"/g, "&quot;");
  const escapedBlurb = (opts.fallbackBlurb || "").replace(/"/g, "&quot;");
  const escapedSpotify = opts.spotifyUrl.replace(/"/g, "&quot;");
  const safeName = safeFilename(meta.name);

  // Format release date for homepage display
  let releaseDateDisplay = "";
  if (meta.releaseDate) {
    try {
      releaseDateDisplay = new Date(meta.releaseDate + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
      });
    } catch { releaseDateDisplay = meta.releaseDate; }
  }

  console.log(`\n── Add to js/albums.js ──`);
  console.log(`{
    name: "${escapedName}",
    artist: "${escapedArtist}",
    date: "${opts.fallbackDate}",
    releaseDate: "${meta.releaseDate}",
    durationMs: ${meta.durationMs || 0},
    coverJpg: "../assets/images/albums/${safeName}.jpg",
    coverAvifMd: "../assets/images/albums/${safeName}-md.avif",
    coverAvifSm: "../assets/images/albums/${safeName}-sm.avif",
    spotify: "${escapedSpotify}",
    blurb: "${escapedBlurb}"
},`);

  // Output the homepage HTML snippet
  const escapedBlurbHtml = (opts.fallbackBlurb || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&rsquo;");
  const escapedArtistHtml = (meta.artist || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&rsquo;");
  const escapedNameHtml = meta.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&rsquo;");

  console.log(`\n── Update index.html (Album of the Week section) ──`);
  console.log(`<!-- Cover images: replace in <picture> -->`);
  console.log(`<source srcset="assets/images/albums/${safeName}-sm.avif" media="(max-width: 640px)" type="image/avif">`);
  console.log(`<source srcset="assets/images/albums/${safeName}-md.avif" type="image/avif">`);
  console.log(`<img … src="assets/images/albums/${safeName}.jpg" …>`);
  console.log(``);
  console.log(`<!-- Album info: replace in <div class="mb-8"> -->`);
  console.log(`<h3 class="text-on-surface font-headline-md text-2xl">${escapedNameHtml}</h3>`);
  console.log(`<p class="text-on-surface-variant font-body-md italic text-lg">by ${escapedArtistHtml}</p>`);
  if (meta.releaseDate && meta.durationMs) {
    console.log(`<p class="font-label-sm text-on-surface-variant/50 mt-1">Released ${releaseDateDisplay} · ${formatDuration(meta.durationMs)}</p>`);
  } else if (meta.releaseDate) {
    console.log(`<p class="font-label-sm text-on-surface-variant/50 mt-1">Released ${releaseDateDisplay}</p>`);
  } else if (meta.durationMs) {
    console.log(`<p class="font-label-sm text-on-surface-variant/50 mt-1">${formatDuration(meta.durationMs)}</p>`);
  }
  console.log(``);
  console.log(`<!-- Blurb: replace the <p> after the album info -->`);
  console.log(`<p class="font-body-lg …">${escapedBlurbHtml}</p>`);
  console.log(``);
  console.log(`<!-- Spotify link -->`);
  console.log(`<a … href="${escapedSpotify}" …>`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
