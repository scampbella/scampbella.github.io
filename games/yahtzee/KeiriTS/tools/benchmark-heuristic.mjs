#!/usr/bin/env node
// Keiri heuristic bot benchmark.
// Usage:
//   node --import tsx tools/benchmark-heuristic.mjs [games=1000] [seed=1] [rules=bbg]

import { simulate, evaluate } from "../src/bot/index.ts";

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.split("=");
    return [k, v ?? "true"];
  }),
);

const games = parseInt(args.games || "1000", 10);
const seed = parseInt(args.seed || "1", 10);
const ruleset = args.rules || "bbg";

console.log(`Keiri Bot Benchmark — ${games} games, seed=${seed}, rules=${ruleset}`);
console.log();

const start = performance.now();
const result = evaluate(games, seed, ruleset);
const elapsed = (performance.now() - start).toFixed(0);

console.log(`  Games:       ${result.games}`);
console.log(`  Mean:        ${result.mean}`);
console.log(`  Min:         ${result.min}`);
console.log(`  P05:         ${result.p05}`);
console.log(`  P50:         ${result.p50}`);
console.log(`  P95:         ${result.p95}`);
console.log(`  Max:         ${result.max}`);
console.log(`  Upper Bonus:  ${result.upperBonusRate}%`);
console.log(`  Y-Bonuses:    ${result.yahtzeeBonusRate}/game`);
console.log(`  Time:         ${elapsed}ms (${(result.games / (parseInt(elapsed, 10) / 1000)).toFixed(0)} games/s)`);

if (args.csv) {
  console.log();
  console.log("seed,score");
  for (let i = 0; i < games; i++) {
    const report = simulate(seed + i, ruleset);
    console.log(`${seed + i},${report.finalScore}`);
  }
}
