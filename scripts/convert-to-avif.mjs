import sharp from "sharp";
import { readdir, stat as fsStat } from "node:fs/promises";
import { join, extname, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets", "images");

const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".gif"]);

const MEDIUM = { width: 1280, suffix: "-md" };

const CONCURRENCY = 4;

async function collectFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectFiles(fullPath);
      results.push(...sub);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function needsConversion(filePath) {
  const dir = dirname(filePath);
  const name = basename(filePath, extname(filePath));
  try {
    const srcStat = await fsStat(filePath);
    const outputPath = join(dir, `${name}${MEDIUM.suffix}.avif`);
    const dstStat = await fsStat(outputPath);
    return dstStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    // output doesn't exist — needs conversion
    return true;
  }
}

async function convertImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) return "skipped";

  const dir = dirname(filePath);
  const name = basename(filePath, ext);
  const outputPath = join(dir, `${name}${MEDIUM.suffix}.avif`);

  // Skip if output is newer than source
  try {
    const srcStat = await fsStat(filePath);
    const dstStat = await fsStat(outputPath);
    if (dstStat.mtimeMs >= srcStat.mtimeMs) return "skipped";
  } catch {
    // output doesn't exist — proceed
  }

  await sharp(filePath)
    .resize({ width: MEDIUM.width, withoutEnlargement: true, fit: "inside" })
    .avif({ quality: 65, effort: 4 })
    .toFile(outputPath);
  const rel = relative(assetsDir, outputPath);
  console.log(`   ${rel}`);
  return "converted";
}

async function main() {
  console.log("Scanning assets/images for images to convert...\n");

  const allFiles = await collectFiles(assetsDir);
  const imageFiles = allFiles.filter((f) => SUPPORTED_EXTS.has(extname(f).toLowerCase()));

  console.log(`Found ${imageFiles.length} source image(s):`);
  for (const f of imageFiles) {
    const rel = relative(assetsDir, f);
    console.log(`  assets/images/${rel}`);
  }
  console.log("");

  let converted = 0;
  let failures = 0;
  const toConvert = [];
  for (const filePath of imageFiles) {
    if (await needsConversion(filePath)) {
      toConvert.push(filePath);
    }
  }

  if (toConvert.length === 0) {
    console.log("All images are up-to-date. Nothing to convert.\n");
  } else {
    console.log(`Converting ${toConvert.length} image(s) in parallel (concurrency: ${CONCURRENCY})...\n`);

    // Process with concurrency limit
    const queue = [...toConvert];
    const running = [];

    async function runNext() {
      while (queue.length > 0 && running.length < CONCURRENCY) {
        const filePath = queue.shift();
        const rel = relative(assetsDir, filePath);
        const display = `assets/images/${rel}`;
        console.log(`Converting: ${display}`);
        const task = convertImage(filePath).then((result) => {
          if (result === "converted") converted++;
        }).catch((err) => {
          console.error(`  Error: ${err.message}`);
          failures++;
        });
        running.push(task);
        task.finally(() => {
          const idx = running.indexOf(task);
          if (idx >= 0) running.splice(idx, 1);
        });
      }
    }

    // Simple concurrency loop
    while (queue.length > 0 || running.length > 0) {
      await runNext();
      if (running.length >= CONCURRENCY || (queue.length === 0 && running.length > 0)) {
        await Promise.race(running);
      }
    }
  }

  console.log(`\n${converted}/${imageFiles.length} source images converted.`);

  console.log("\nAll AVIF files:");
  const allAfter = await collectFiles(assetsDir);
  for (const f of allAfter.filter((x) => x.endsWith(".avif"))) {
    const rel = relative(assetsDir, f);
    const s = await fsStat(f);
    const kb = (s.size / 1024).toFixed(1);
    console.log(`  assets/images/${rel} (${kb} KB)`);
  }

  if (failures > 0) {
    console.error(`\n${failures} conversion(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
