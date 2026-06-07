// build.mjs — Compile TypeScript and concatenate into game.js
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const buildDir = join(__dirname, 'build');
const outFile = join(__dirname, 'game.js');

// 0. Clean previous build artifacts
if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true });
}

// 1. Compile TypeScript
console.log('Compiling TypeScript...');
try {
    execSync('npx tsc --project src/tsconfig.json', { cwd: __dirname, stdio: 'inherit' });
} catch (e) {
    console.error('TypeScript compilation failed. Aborting build.');
    process.exit(1);
}

// 2. Concatenate in dependency order
// NOTE: if you add/rename a .ts file under src/, update this list.
const files = [
    'types.js',
    'scoring.js',
    'categories.js',
    'dice.js',
    'scorecard.js',
    'game.js',
    'ui.js',
    'bot.js',
    'versus-game.js',
    'versus-ui.js',
    'main.js',
];

const header = [
    '// Yahtzee — built from src/',
    '// ' + new Date().toISOString(),
    '// File order: ' + files.join(', '),
    '',
    '',
];
const parts = [...header];

for (const file of files) {
    const filePath = join(buildDir, file);
    if (!existsSync(filePath)) {
        console.error(`Missing build artifact: ${file}. Did tsc succeed?`);
        process.exit(1);
    }
    try {
        parts.push(readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.error(`Failed to read ${file}: ${e.message}`);
        process.exit(1);
    }
}

const output = parts.join('\n') + '\n';
writeFileSync(outFile, output);
console.log(`Built ${outFile} (${output.length} bytes)`);