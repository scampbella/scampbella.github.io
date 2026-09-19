// Small, shared presentation preferences for every casino page.

import { CASINO_SETTINGS_KEY } from './keys.ts';

export interface CasinoSettings {
    readonly reducedMotion: boolean;
    readonly highContrast: boolean;
    readonly largeLabels: boolean;
}

interface SettingsStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

interface StoredSettings extends CasinoSettings {
    readonly v: 1;
}

export const DEFAULT_CASINO_SETTINGS: CasinoSettings = Object.freeze({
    reducedMotion: false,
    highContrast: false,
    largeLabels: false,
});

function coerce(value: unknown): CasinoSettings {
    if (typeof value !== 'object' || value === null) return DEFAULT_CASINO_SETTINGS;
    const raw = value as Partial<StoredSettings>;
    if (raw.v !== 1) return DEFAULT_CASINO_SETTINGS;
    return {
        reducedMotion: raw.reducedMotion === true,
        highContrast: raw.highContrast === true,
        largeLabels: raw.largeLabels === true,
    };
}

function browserStorage(): SettingsStorage | null {
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
}

export function readCasinoSettings(storage: SettingsStorage | null = browserStorage()): CasinoSettings {
    if (!storage) return DEFAULT_CASINO_SETTINGS;
    try {
        const raw = storage.getItem(CASINO_SETTINGS_KEY);
        return raw === null ? DEFAULT_CASINO_SETTINGS : coerce(JSON.parse(raw));
    } catch {
        return DEFAULT_CASINO_SETTINGS;
    }
}

export function writeCasinoSettings(
    settings: CasinoSettings,
    storage: SettingsStorage | null = browserStorage(),
): void {
    if (!storage) return;
    const stored: StoredSettings = { v: 1, ...settings };
    try {
        storage.setItem(CASINO_SETTINGS_KEY, JSON.stringify(stored));
    } catch {
        // Preferences are optional; the bankroll warning already explains
        // when this browser cannot persist casino data.
    }
}

export function applyCasinoSettings(
    settings: CasinoSettings,
    root: HTMLElement = document.documentElement,
): void {
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    root.dataset.contrast = settings.highContrast ? 'high' : 'standard';
    root.dataset.largeLabels = String(settings.largeLabels);
    delete root.dataset.descriptions;
}
