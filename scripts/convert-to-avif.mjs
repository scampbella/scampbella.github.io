import sharp from "sharp";
import { readdir, stat as fsStat } from "node:fs/promises";
import { join, extname, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets", "images");

const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".gif"]);

const SIZES = [
  { width: 640, suffix: "-sm" },
  { width: 1280, suffix: "-md" },
  { width: 1920, suffix: "-lg" },
];

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

async function convertImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) return "skipped";

  const dir = dirname(filePath);
  const name = basename(filePath, ext);

  const metadata = await sharp(filePath).metadata();
  const originalWidth = metadata.width || 0;

  let converted = 0;
  for (const size of SIZES) {
    if (originalWidth < size.width && size.suffix !== "-sm") continue;

    const outputPath = join(dir, `${name}${size.suffix}.avif`);
    await sharp(filePath)
      .resize({ width: size.width, withoutEnlargement: true, fit: "inside" })
      .avif({ quality: 65, effort: 4 })
      .toFile(outputPath);
    console.log(`   ${name}${size.suffix}.avif`);
    converted++;
  }
  return converted > 0 ? "converted" : "skipped";
}

async function main() {
  console.log("Scanning assets/images for images to convert...\n");

  const allFiles = await collectFiles(assetsDir);
  const imageFiles = allFiles.filter((f) => SUPPORTED_EXTS.has(extname(f).toLowerCase()));

  console.log(`Found ${imageFiles.length} source image(s):`);
  for (const f of imageFiles) {
    const rel = f.replace(assetsDir, "assets/images");
    console.log(`  ${rel}`);
  }
  console.log("");

  let converted = 0;
  for (const filePath of imageFiles) {
    console.log(`Converting: ${filePath.replace(assetsDir, "assets/images")}`);
    try {
      const result = await convertImage(filePath);
      if (result === "converted") converted++;
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\n${converted}/${imageFiles.length} source images converted.`);

  console.log("\nAll AVIF files:");
  const allAfter = await collectFiles(assetsDir);
  for (const f of allAfter.filter((x) => x.endsWith(".avif"))) {
    const rel = f.replace(assetsDir, "assets/images");
    const s = await fsStat(f);
    const kb = (s.size / 1024).toFixed(1);
    console.log(`  ${rel} (${kb} KB)`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});