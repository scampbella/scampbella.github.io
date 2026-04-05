import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const publicStatePath = path.join(repoRoot, 'valorant-favicon-config.js');
const privateConfigPath = path.join(
  repoRoot,
  '.github',
  'valorant-favicon.config.json'
);

const COMPETITIVE_TIERS_UUID = '03621f52-342b-cf4e-4f86-9350a49c6d04';
const apiKey = process.env.HENRIKDEV_API_KEY;

function buildPublicState({ defaultIconHref, iconHref, name, tag, lastUpdated }) {
  return `/**
 * Public favicon state consumed by the website.
 * This file is safe to publish because it contains no secrets.
 * It is updated by the GitHub Actions workflow.
 */
window.__VALORANT_FAVICON__ = {
  defaultIconHref: ${JSON.stringify(defaultIconHref)},
  iconHref: ${iconHref ? JSON.stringify(iconHref) : 'null'},
  player: ${JSON.stringify(`${name}#${tag}`)},
  lastUpdated: ${lastUpdated ? JSON.stringify(lastUpdated) : 'null'},
};
`;
}

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

function readCurrentIconHref(source) {
  const match = source.match(/iconHref:\s*(null|"[^"]*")/);
  if (!match) {
    return null;
  }

  if (match[1] === 'null') {
    return null;
  }

  return JSON.parse(match[1]);
}

async function main() {
  const rawConfig = await readFile(privateConfigPath, 'utf8');
  const config = JSON.parse(rawConfig);

  const {
    name,
    tag,
    region = 'na',
    platform = 'pc',
    defaultIconHref = 'favicon.svg',
  } = config;

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
  const previousState = await readFile(publicStatePath, 'utf8').catch(() => '');
  const previousIconHref = readCurrentIconHref(previousState);

  if (previousIconHref === nextIconHref) {
    console.log('Rank icon is unchanged.');
    return;
  }

  const nextState = buildPublicState({
    defaultIconHref,
    iconHref: nextIconHref,
    name,
    tag,
    lastUpdated: new Date().toISOString(),
  });

  await writeFile(publicStatePath, nextState, 'utf8');
  console.log(`Updated ${path.relative(repoRoot, publicStatePath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
