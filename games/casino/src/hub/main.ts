// Casino hub: shows the shared bankroll and lifetime stats, and owns the two
// ways to get chips back.

import type { BankrollSnapshot } from '../shared/bankroll.ts';
import { STARTING_BANKROLL, getBankroll } from '../shared/bankroll.ts';
import { BANKROLL_KEY } from '../shared/keys.ts';
import { chips, signedChips } from '../shared/format.ts';

function el(id: string): HTMLElement {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id}`);
    return found;
}

const bankroll = getBankroll();

const balanceEl = el('balance');
const storageWarning = el('storage-warning');
const handsEl = el('stat-hands');
const wageredEl = el('stat-wagered');
const netEl = el('stat-net');
const biggestEl = el('stat-biggest');
const bestEl = el('stat-best');
const rebuyBtn = el('rebuy') as HTMLButtonElement;
const resetBtn = el('hard-reset') as HTMLButtonElement;

function render(snapshot: BankrollSnapshot = bankroll.read()): void {
    const { balance, stats, persistent } = snapshot;

    balanceEl.textContent = chips(balance);
    storageWarning.hidden = persistent;

    handsEl.textContent = chips(stats.handsPlayed);
    wageredEl.textContent = chips(stats.totalWagered);
    biggestEl.textContent = chips(stats.biggestWin);
    bestEl.textContent = stats.bestHand ?? '—';

    netEl.textContent = signedChips(stats.netProfit);
    netEl.classList.toggle('is-positive', stats.netProfit > 0);
    netEl.classList.toggle('is-negative', stats.netProfit < 0);

    // Re-buy only means anything when you're below the opening stake.
    rebuyBtn.disabled = balance >= STARTING_BANKROLL;
}

rebuyBtn.addEventListener('click', () => {
    bankroll.rebuy();
    render();
});

resetBtn.addEventListener('click', () => {
    const ok = window.confirm(
        'Reset the whole casino?\n\nThis wipes your chip balance and every lifetime stat. It cannot be undone.',
    );
    if (!ok) return;
    bankroll.hardReset();
    render();
});

// Keep in step with a game played in another tab.
window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === BANKROLL_KEY) {
        bankroll.refresh();
    }
});

bankroll.subscribe(render);
render();
