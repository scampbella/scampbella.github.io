import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const faviconPath = path.join(repoRoot, 'icons', 'favicon-rank.png');
const privateConfigPath = path.join(
  repoRoot,
  '.github',
  'valorant-favicon.config.json'
);

const COMPETITIVE_TIERS_UUID = '03621f52-342b-cf4e-4f86-9350a49c6d04';
const apiKey = process.env.HENRIKDEV_API_KEY;

function extractTierId(body) {
  if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') {
    return null;
  }

  const currentTierId = body.data.current?.tier?.id;
  if (typeof currentTierId === 'number') {
    return currentTierId;
  }

  const peakTierId = body.data.peak?.tier?.id;
  if (typeof peakTierId === 'number') {
    return peakTierId;
  }

  return null;
}

function tierIconHref(tierId) {
  return `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIERS_UUID}/${tierId}/smallicon.png`;
}

async function main() {
  const rawConfig = await readFile(privateConfigPath, 'utf8');
  const config = JSON.parse(rawConfig);

  const { name, tag, region = 'na', platform = 'pc' } = config;

  if (!name || !tag) {
    throw new Error('Missing "name" or "tag" in .github/valorant-favicon.config.json');
  }

  if (!apiKey) {
    throw new Error('Missing HENRIKDEV_API_KEY environment variable');
  }

  const url = new URL(
    `https://api.henrikdev.xyz/valorant/v3/mmr/${encodeURIComponent(
      String(region).toLowerCase()
    )}/${encodeURIComponent(String(platform).toLowerCase())}/${encodeURIComponent(
      String(name).trim()
    )}/${encodeURIComponent(String(tag).trim().replace(/^#/, ''))}`
  );

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details =
      body && typeof body === 'object' ? JSON.stringify(body) : response.statusText;
    throw new Error(`HenrikDev API request failed: ${response.status} ${details}`);
  }

  const tierId = extractTierId(body);
  if (tierId === null) {
    throw new Error('Could not determine current or peak competitive tier');
  }

  const nextIconHref = tierIconHref(tierId);
  const iconResponse = await fetch(nextIconHref);
  if (!iconResponse.ok) {
    throw new Error(`Rank icon download failed: ${iconResponse.status} ${iconResponse.statusText}`);
  }

  const nextIconBytes = Buffer.from(await iconResponse.arrayBuffer());
  const previousIconBytes = await readFile(faviconPath).catch(() => null);
  const hasSameIcon =
    previousIconBytes !== null && Buffer.compare(previousIconBytes, nextIconBytes) === 0;

  if (hasSameIcon) {
    console.log('Rank icon is unchanged.');
    return;
  }

  await writeFile(faviconPath, nextIconBytes);
  console.log(`Updated ${path.relative(repoRoot, faviconPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
