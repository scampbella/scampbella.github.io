// Run: npm run test:casino

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { StorageLike } from './bankroll.ts';
import { STARTING_BANKROLL, createBankroll, memoryStorage } from './bankroll.ts';
import { BANKROLL_KEY } from './keys.ts';

function fresh() {
    const storage = memoryStorage();
    return { storage, bank: createBankroll(storage) };
}

const meta = (wager: number, label = 'Flush', strength = 5) => ({
    wager,
    handLabel: label,
    handStrength: strength,
});

// --- defaults --------------------------------------------------------------

test('starts at the opening stake with empty stats', () => {
    const { bank } = fresh();
    const { balance, stats, persistent } = bank.read();
    assert.equal(balance, STARTING_BANKROLL);
    assert.equal(persistent, true);
    assert.deepEqual(stats, {
        handsPlayed: 0,
        totalWagered: 0,
        netProfit: 0,
        biggestWin: 0,
        bestHand: null,
        bestHandStrength: -1,
    });
});

// --- wagering --------------------------------------------------------------

test('takeWager deducts and refuses what cannot be afforded', () => {
    const { bank } = fresh();
    assert.equal(bank.takeWager(1, 250), true);
    assert.equal(bank.read().balance, 750);

    assert.equal(bank.takeWager(2, 1_000_000), false);
    assert.equal(bank.read().balance, 750, 'a refused wager must not move money');
});

test('takeWager is idempotent per round', () => {
    const { bank } = fresh();
    assert.equal(bank.takeWager(1, 100), true);
    assert.equal(bank.takeWager(1, 100), true, 'replay returns true');
    assert.equal(bank.takeWager(1, 100), true);
    assert.equal(bank.read().balance, 900, 'charged exactly once');
});

test('takeWager rejects non-positive and fractional amounts', () => {
    const { bank } = fresh();
    for (const bad of [0, -5, 2.5, NaN, Infinity]) {
        assert.equal(bank.takeWager(1, bad), false, String(bad));
    }
    assert.equal(bank.read().balance, STARTING_BANKROLL);
});

test('canWager mirrors takeWager without moving money', () => {
    const { bank } = fresh();
    assert.equal(bank.canWager(1000), true);
    assert.equal(bank.canWager(1001), false);
    assert.equal(bank.canWager(0), false);
    assert.equal(bank.canWager(1.5), false);
    assert.equal(bank.read().balance, STARTING_BANKROLL);
});

test('parseWager normalises the junk a free-form field will receive', () => {
    const { bank } = fresh();
    assert.equal(bank.parseWager('250'), 250);
    assert.equal(bank.parseWager('  12 '), 12);
    assert.equal(bank.parseWager('1,000'), 1000);
    assert.equal(bank.parseWager(37.9), 37, 'truncates toward zero');
    assert.equal(bank.parseWager(1000), 1000, 'all-in is legal');

    for (const bad of ['', 'abc', '-5', '0', '0.5', '1e9', 'Infinity', NaN]) {
        assert.equal(bank.parseWager(bad as string), null, JSON.stringify(bad));
    }
});

// --- settling --------------------------------------------------------------

test('settle credits the payout and records the hand', () => {
    const { bank } = fresh();
    bank.takeWager(1, 100);
    bank.settle(1, 600, meta(100));

    const { balance, stats } = bank.read();
    assert.equal(balance, 1500); // 1000 - 100 + 600
    assert.equal(stats.handsPlayed, 1);
    assert.equal(stats.totalWagered, 100);
    assert.equal(stats.netProfit, 500);
    assert.equal(stats.biggestWin, 600);
    assert.equal(stats.bestHand, 'Flush');
});

test('settle is idempotent per round', () => {
    const { bank } = fresh();
    bank.takeWager(1, 100);
    bank.settle(1, 600, meta(100));
    bank.settle(1, 600, meta(100));
    bank.settle(1, 600, meta(100));

    const { balance, stats } = bank.read();
    assert.equal(balance, 1500, 'paid exactly once');
    assert.equal(stats.handsPlayed, 1);
});

test('a losing hand still counts, and net profit goes negative', () => {
    const { bank } = fresh();
    bank.takeWager(1, 200);
    bank.settle(1, 0, meta(200, 'No Win', 0));

    const { balance, stats } = bank.read();
    assert.equal(balance, 800);
    assert.equal(stats.handsPlayed, 1);
    assert.equal(stats.netProfit, -200);
    assert.equal(stats.biggestWin, 0);
});

test('best hand tracks strength, not recency or payout', () => {
    const { bank } = fresh();
    bank.takeWager(1, 10);
    bank.settle(1, 60, meta(10, 'Flush', 5));
    assert.equal(bank.read().stats.bestHand, 'Flush');

    bank.takeWager(2, 10);
    bank.settle(2, 20, meta(10, 'Two Pair', 2));
    assert.equal(bank.read().stats.bestHand, 'Flush', 'a weaker later hand must not overwrite');

    bank.takeWager(3, 10);
    bank.settle(3, 250, meta(10, 'Straight Flush', 8));
    assert.equal(bank.read().stats.bestHand, 'Straight Flush');
});

test('a losing hand never becomes the best hand', () => {
    const { bank } = fresh();

    // Strength 0 is "no hand". It must not beat the initial -1 sentinel, or the
    // hub reports a best hand of "No Win" after the very first loss.
    bank.takeWager(1, 10);
    bank.settle(1, 0, meta(10, 'No Win', 0));
    assert.equal(bank.read().stats.bestHand, null);

    bank.takeWager(2, 10);
    bank.settle(2, 10, meta(10, 'Jacks or Better', 1));
    assert.equal(bank.read().stats.bestHand, 'Jacks or Better');

    // And a later loss must not clear it.
    bank.takeWager(3, 10);
    bank.settle(3, 0, meta(10, 'No Win', 0));
    assert.equal(bank.read().stats.bestHand, 'Jacks or Better');
});

test('biggest win keeps the maximum across rounds', () => {
    const { bank } = fresh();
    bank.takeWager(1, 10);
    bank.settle(1, 900, meta(10));
    bank.takeWager(2, 10);
    bank.settle(2, 30, meta(10));
    assert.equal(bank.read().stats.biggestWin, 900);
});

// --- re-buy and reset ------------------------------------------------------

test('rebuy tops up a broke player but keeps stats', () => {
    const { bank } = fresh();
    bank.takeWager(1, 1000);
    bank.settle(1, 0, meta(1000, 'No Win', 0));
    assert.equal(bank.read().balance, 0);

    bank.rebuy();
    const { balance, stats } = bank.read();
    assert.equal(balance, STARTING_BANKROLL);
    assert.equal(stats.handsPlayed, 1, 'stats survive a re-buy');
    assert.equal(stats.netProfit, -1000);
});

test('rebuy never tops a player down', () => {
    const { bank } = fresh();
    bank.takeWager(1, 10);
    bank.settle(1, 8000, meta(10));
    const rich = bank.read().balance;
    bank.rebuy();
    assert.equal(bank.read().balance, rich);
});

test('hardReset wipes balance and stats', () => {
    const { bank } = fresh();
    bank.takeWager(1, 100);
    bank.settle(1, 900, meta(100));

    bank.hardReset();
    const { balance, stats } = bank.read();
    assert.equal(balance, STARTING_BANKROLL);
    assert.equal(stats.handsPlayed, 0);
    assert.equal(stats.bestHand, null);
});

test('round counters reset too, so round 1 can charge again', () => {
    const { bank } = fresh();
    bank.takeWager(1, 100);
    bank.hardReset();
    assert.equal(bank.takeWager(1, 100), true);
    assert.equal(bank.read().balance, 900);
});

// --- corrupt storage -------------------------------------------------------

test('corrupt or hostile stored values degrade to defaults, never NaN', () => {
    for (const bad of [
        'not json',
        '[]',
        'null',
        '{}',
        JSON.stringify({ v: 99, balance: 5 }),
        JSON.stringify({ v: 1, balance: 'lots' }),
        JSON.stringify({ v: 1, balance: NaN }),
        JSON.stringify({ v: 1, balance: -400 }),
        JSON.stringify({ v: 1, balance: 100, stats: 'nope' }),
        JSON.stringify({ v: 1, balance: 100, stats: { handsPlayed: 'many' } }),
    ]) {
        const storage = memoryStorage();
        storage.setItem(BANKROLL_KEY, bad);
        const { balance, stats } = createBankroll(storage).read();

        assert.ok(Number.isFinite(balance), `balance not finite for ${bad}`);
        assert.ok(balance >= 0, `negative balance for ${bad}`);
        for (const [key, value] of Object.entries(stats)) {
            if (key === 'bestHand') continue;
            assert.ok(Number.isFinite(value), `${key} not finite for ${bad}`);
        }
    }
});

test('a negative stored balance clamps to zero, not to the opening stake', () => {
    const storage = memoryStorage();
    storage.setItem(BANKROLL_KEY, JSON.stringify({ v: 1, balance: -400, stats: {} }));
    const bank = createBankroll(storage);

    // Clamping up to STARTING_BANKROLL would turn a corrupt value into free
    // money. Broke-but-recoverable is the safe reading; re-buy is right there.
    assert.equal(bank.read().balance, 0);
    bank.rebuy();
    assert.equal(bank.read().balance, STARTING_BANKROLL);
});

// --- unavailable storage ---------------------------------------------------

test('a storage that throws on every call does not break the game', () => {
    const hostile: StorageLike = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() { throw new Error('SecurityError'); },
    };
    const bank = createBankroll(hostile);

    assert.equal(bank.read().balance, STARTING_BANKROLL);
    assert.equal(bank.read().persistent, false, 'must admit it cannot persist');
    assert.doesNotThrow(() => bank.takeWager(1, 100));
    assert.doesNotThrow(() => bank.settle(1, 500, meta(100)));
    assert.doesNotThrow(() => bank.hardReset());
});

test('a write-only failure (quota) is reported as non-persistent', () => {
    const store = memoryStorage();
    const quota: StorageLike = {
        getItem: (k) => store.getItem(k),
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem: (k) => store.removeItem(k),
    };
    const bank = createBankroll(quota);
    assert.equal(bank.read().persistent, true, 'nothing has failed yet');
    bank.takeWager(1, 100);
    assert.equal(bank.read().persistent, false, 'a failed write must surface');
});

// --- cross-tab safety ------------------------------------------------------

test('every mutation re-reads storage, so a second tab cannot be clobbered', () => {
    const storage = memoryStorage();
    const tabA = createBankroll(storage);
    const tabB = createBankroll(storage);

    // Both read 1000, then each charges a different round.
    assert.equal(tabA.read().balance, 1000);
    assert.equal(tabB.read().balance, 1000);

    tabA.takeWager(1, 100);
    tabB.takeWager(2, 50);

    // A cached in-memory balance would have written 950 and lost A's 100.
    assert.equal(tabA.read().balance, 850);
    assert.equal(tabB.read().balance, 850);
});

// --- subscriptions ---------------------------------------------------------

test('subscribers are notified on change and can unsubscribe', () => {
    const { bank } = fresh();
    const seen: number[] = [];
    const off = bank.subscribe((s) => seen.push(s.balance));

    bank.takeWager(1, 100);
    bank.settle(1, 300, meta(100));
    assert.deepEqual(seen, [900, 1200]);

    off();
    bank.takeWager(2, 100);
    assert.deepEqual(seen, [900, 1200], 'no notifications after unsubscribe');
});

test('refresh re-reads storage and notifies, for the storage event', () => {
    const storage = memoryStorage();
    const tabA = createBankroll(storage);
    const tabB = createBankroll(storage);

    let latest = -1;
    tabA.subscribe((s) => { latest = s.balance; });

    tabB.takeWager(1, 400); // another tab moves the money
    tabA.refresh();
    assert.equal(latest, 600);
});
