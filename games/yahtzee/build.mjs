// build.mjs — Compile TypeScript and concatenate into game.js
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const outFile = join(__dirname, 'game.js');

// 1. Compile TypeScript
console.log('Compiling TypeScript...');
execSync('npx tsc --project src/tsconfig.json', { cwd: __dirname, stdio: 'inherit' });

// 2. Concatenate in dependency order
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

let output = '// Yahtzee — built from src/\n';
output += '// ' + new Date().toISOString() + '\n';
output += '// File order: ' + files.join(', ') + '\n\n';

for (const file of files) {
    const path = join(__dirname, 'build', file);
    const content = readFileSync(path, 'utf-8');
    output += content + '\n';
}

writeFileSync(outFile, output);
console.log(`Built ${outFile} (${output.length} bytes)`);
