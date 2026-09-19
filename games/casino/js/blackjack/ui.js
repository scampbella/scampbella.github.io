import { CARD_BACK_COL, CARD_BACK_ROW, cardLabel, spriteCol, spriteRow } from "../shared/cards.js";
import { chips } from "../shared/format.js";
import { scoreHand } from "./machine.js";
const OUTCOME_LABEL = {
    blackjack: 'Blackjack!', win: 'You win', push: 'Push', loss: 'Dealer wins', bust: 'Bust',
};
function el(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`missing element #${id}`);
    return found;
}
function cardElement(card, hidden = false) {
    const face = document.createElement('span');
    face.className = 'card-face';
    face.style.setProperty('--col', String(hidden ? CARD_BACK_COL : spriteCol(card.rank)));
    face.style.setProperty('--row', String(hidden ? CARD_BACK_ROW : spriteRow(card.suit)));
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', hidden ? 'Face-down card' : cardLabel(card));
    return face;
}
function wagerMessage(wagerText, balance) {
    const amount = Number(wagerText);
    return Number.isInteger(amount) && amount > balance
        ? 'That wager is more than the chips in your bank.'
        : 'Enter a whole-number wager.';
}
export function createUI(handlers) {
    const balanceEl = el('balance');
    const storageWarning = el('storage-warning');
    const dealerHand = el('dealer-hand');
    const playerHand = el('player-hand');
    const dealerTotal = el('dealer-total');
    const playerTotal = el('player-total');
    const result = el('result');
    const wagerRow = el('wager-row');
    const wagerInput = el('wager');
    const wagerError = el('wager-error');
    const deal = el('deal');
    const hit = el('hit');
    const stand = el('stand');
    const doubleBtn = el('double-down');
    const rules = el('rules-dialog');
    const outOfChips = el('out-of-chips-dialog');
    deal.addEventListener('click', handlers.onPrimary);
    hit.addEventListener('click', handlers.onHit);
    stand.addEventListener('click', handlers.onStand);
    doubleBtn.addEventListener('click', handlers.onDouble);
    wagerInput.addEventListener('input', () => handlers.onWagerInput(wagerInput.value));
    wagerInput.addEventListener('selectstart', (event) => event.preventDefault());
    el('wager-half').addEventListener('click', () => handlers.onWagerQuick('half'));
    el('wager-double').addEventListener('click', () => handlers.onWagerQuick('double'));
    el('wager-max').addEventListener('click', () => handlers.onWagerQuick('max'));
    el('rules-help').addEventListener('click', () => rules.showModal());
    el('rules-close').addEventListener('click', () => rules.close());
    rules.addEventListener('click', (event) => { if (event.target === rules)
        rules.close(); });
    el('out-of-chips-close').addEventListener('click', () => outOfChips.close());
    outOfChips.addEventListener('click', (event) => { if (event.target === outOfChips)
        outOfChips.close(); });
    document.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || rules.open || outOfChips.open)
            return;
        const target = event.target;
        const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
        if (typing)
            return;
        if (event.key.toLowerCase() === 'h') {
            event.preventDefault();
            handlers.onHit();
            return;
        }
        if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            handlers.onStand();
            return;
        }
        if (event.key.toLowerCase() === 'd') {
            event.preventDefault();
            handlers.onDouble();
            return;
        }
        if ((event.key === 'Enter' || event.code === 'Space') &&
            !(target instanceof HTMLButtonElement) && !(target instanceof HTMLAnchorElement)) {
            event.preventDefault();
            handlers.onPrimary();
        }
    });
    function renderCards(container, cards, hideHole) {
        container.replaceChildren(...cards.map((card, index) => cardElement(card, hideHole && index === 1)));
    }
    function render(vm) {
        const { state } = vm;
        const betting = state.phase === 'betting';
        const playing = state.phase === 'playing';
        const resolved = state.phase === 'resolved';
        balanceEl.textContent = chips(vm.balance);
        storageWarning.hidden = vm.persistent;
        if (betting) {
            renderCards(dealerHand, [], false);
            renderCards(playerHand, [], false);
            dealerTotal.textContent = '';
            playerTotal.textContent = '';
        }
        else {
            renderCards(dealerHand, state.dealer, playing);
            renderCards(playerHand, state.player, false);
            dealerTotal.textContent = playing ? '— ?' : `— ${scoreHand(state.dealer).total}`;
            playerTotal.textContent = `— ${scoreHand(state.player).total}`;
        }
        result.classList.toggle('is-loss', resolved && (state.outcome === 'loss' || state.outcome === 'bust'));
        if (resolved) {
            const detail = state.payout > state.wager
                ? `Returned ${chips(state.payout)} chips`
                : state.payout === state.wager ? 'Bet returned' : `Lost ${chips(state.wager)} chips`;
            const title = document.createElement('span');
            title.className = 'result-title';
            title.textContent = OUTCOME_LABEL[state.outcome];
            const amount = document.createElement('span');
            amount.className = 'result-detail';
            amount.textContent = detail;
            result.replaceChildren(title, amount);
        }
        else {
            result.replaceChildren();
        }
        wagerRow.hidden = !betting;
        if (wagerInput.value !== vm.wagerText)
            wagerInput.value = vm.wagerText;
        const invalid = betting && vm.wagerText.length > 0 && !vm.wagerValid && vm.balance > 0;
        wagerInput.classList.toggle('is-invalid', invalid);
        wagerInput.setAttribute('aria-invalid', String(invalid));
        wagerError.hidden = !invalid;
        wagerError.textContent = wagerMessage(vm.wagerText, vm.balance);
        for (const id of ['wager-half', 'wager-double', 'wager-max']) {
            el(id).disabled = !betting;
        }
        deal.hidden = playing;
        deal.textContent = resolved ? 'Play Again' : 'Deal';
        deal.disabled = betting && !vm.wagerValid && vm.balance > 0;
        hit.hidden = !playing;
        stand.hidden = !playing;
        doubleBtn.hidden = !playing;
        doubleBtn.disabled = !vm.canDouble;
    }
    function showOutOfChips() { if (!outOfChips.open)
        outOfChips.showModal(); }
    function focusResult() { result.focus({ preventScroll: true }); }
    return { render, showOutOfChips, focusResult };
}
