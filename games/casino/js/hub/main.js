// Casino hub: renders the shared bank, lifetime stats, menu, and preferences.
import { STARTING_BANKROLL, getBankroll } from "../shared/bankroll.js";
import { chips, signedChips } from "../shared/format.js";
import { BANKROLL_KEY, CASINO_SETTINGS_KEY } from "../shared/keys.js";
import { DEFAULT_CASINO_SETTINGS, applyCasinoSettings, readCasinoSettings, writeCasinoSettings, } from "../shared/settings.js";
function el(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`missing element #${id}`);
    return found;
}
const bankroll = getBankroll();
let settings = readCasinoSettings();
applyCasinoSettings(settings);
const balanceEl = el('balance');
const menuBalanceEl = el('menu-balance');
const storageWarning = el('storage-warning');
const rebuyBtn = el('rebuy');
const resetBtn = el('hard-reset');
const menuOpen = el('menu-open');
const menuDialog = el('casino-menu');
const menuClose = el('menu-close');
const statHands = el('stat-hands');
const statWagered = el('stat-wagered');
const statProfit = el('stat-profit');
const statBiggest = el('stat-biggest');
const statCurrentStreak = el('stat-current-streak');
const statBestStreak = el('stat-best-streak');
const statsScope = el('stats-scope');
const settingInputs = {
    reducedMotion: el('setting-motion'),
    highContrast: el('setting-contrast'),
    largeLabels: el('setting-labels'),
};
let lastSnapshot = bankroll.read();
function syncSettingControls() {
    for (const key of Object.keys(settingInputs)) {
        settingInputs[key].checked = settings[key];
    }
}
function updateStatsScope(stats) {
    const selected = statsScope.value || 'overall';
    const options = [new Option('Overall', 'overall')];
    for (const [gameId, game] of Object.entries(stats.byGame)
        .sort(([, a], [, b]) => a.gameLabel.localeCompare(b.gameLabel))) {
        options.push(new Option(game.gameLabel, gameId));
    }
    statsScope.replaceChildren(...options);
    statsScope.value = options.some((option) => option.value === selected) ? selected : 'overall';
}
function renderStats(summary) {
    statBestStreak.textContent = chips(summary.biggestWinStreak);
    statCurrentStreak.textContent = chips(summary.currentWinStreak);
    statBiggest.textContent = chips(summary.biggestWin);
    statWagered.textContent = chips(summary.totalWagered);
    statHands.textContent = chips(summary.handsPlayed);
    statProfit.textContent = signedChips(summary.netProfit);
    statProfit.dataset.sign = summary.netProfit < 0 ? 'negative' : summary.netProfit > 0 ? 'positive' : 'neutral';
}
function render(snapshot = bankroll.read()) {
    const { balance, stats, persistent } = snapshot;
    lastSnapshot = snapshot;
    balanceEl.textContent = chips(balance);
    menuBalanceEl.textContent = chips(balance);
    storageWarning.hidden = persistent;
    updateStatsScope(stats);
    renderStats(statsScope.value === 'overall' ? stats : (stats.byGame[statsScope.value] ?? stats));
    // Refill only means anything when you're below the opening stake.
    rebuyBtn.disabled = balance >= STARTING_BANKROLL;
}
menuOpen.addEventListener('click', () => menuDialog.showModal());
menuClose.addEventListener('click', () => menuDialog.close());
menuDialog.addEventListener('click', (event) => {
    if (event.target === menuDialog)
        menuDialog.close();
});
statsScope.addEventListener('change', () => {
    const { stats } = lastSnapshot;
    renderStats(statsScope.value === 'overall' ? stats : (stats.byGame[statsScope.value] ?? stats));
});
rebuyBtn.addEventListener('click', () => {
    bankroll.rebuy();
    render();
});
resetBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset the whole casino?\n\nThis wipes your chip balance, lifetime stats, and settings. It cannot be undone.');
    if (!ok)
        return;
    bankroll.hardReset();
    settings = DEFAULT_CASINO_SETTINGS;
    applyCasinoSettings(settings);
    syncSettingControls();
    render();
});
for (const key of Object.keys(settingInputs)) {
    settingInputs[key].addEventListener('change', () => {
        settings = { ...settings, [key]: settingInputs[key].checked };
        writeCasinoSettings(settings);
        applyCasinoSettings(settings);
    });
}
// Keep in step with a game or menu open in another tab.
window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === BANKROLL_KEY) {
        bankroll.refresh();
    }
    if (event.key === null || event.key === CASINO_SETTINGS_KEY) {
        settings = readCasinoSettings();
        applyCasinoSettings(settings);
        syncSettingControls();
    }
});
bankroll.subscribe(render);
syncSettingControls();
render();
