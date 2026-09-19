import assert from 'node:assert/strict';
import test from 'node:test';

import { memoryStorage } from './bankroll.ts';
import { CASINO_SETTINGS_KEY } from './keys.ts';
import {
    DEFAULT_CASINO_SETTINGS,
    readCasinoSettings,
    writeCasinoSettings,
} from './settings.ts';

test('settings default when storage is empty or malformed', () => {
    const storage = memoryStorage();
    assert.deepEqual(readCasinoSettings(storage), DEFAULT_CASINO_SETTINGS);
    storage.setItem(CASINO_SETTINGS_KEY, '{broken');
    assert.deepEqual(readCasinoSettings(storage), DEFAULT_CASINO_SETTINGS);
});

test('settings survive a storage round trip', () => {
    const storage = memoryStorage();
    const settings = {
        reducedMotion: true,
        highContrast: true,
        largeLabels: true,
    };
    writeCasinoSettings(settings, storage);
    assert.deepEqual(readCasinoSettings(storage), settings);
});

test('missing fields safely fall back per setting', () => {
    const storage = memoryStorage();
    storage.setItem(CASINO_SETTINGS_KEY, JSON.stringify({ v: 1, reducedMotion: true }));
    assert.deepEqual(readCasinoSettings(storage), {
        reducedMotion: true,
        highContrast: false,
        largeLabels: false,
    });
});
