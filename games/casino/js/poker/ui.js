// DOM rendering for the poker table.
//
// This is the only place in the poker game that touches the document. It owns
// no game state — main.ts holds that and hands a view model down.
import { CARD_BACK_COL, CARD_BACK_ROW, cardLabel, spriteCol, spriteRow, } from "../shared/cards.js";
import { chips } from "../shared/format.js";
import { HAND_LABELS, HAND_RANKS, HAND_STRENGTH, PAYTABLE } from "./hands.js";
const HAND_ORDER = Object.values(HAND_RANKS)
    .filter((rank) => rank !== HAND_RANKS.NOTHING)
    .sort((a, b) => HAND_STRENGTH[b] - HAND_STRENGTH[a]);
function el(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`missing element #${id}`);
    return found;
}
export function createUI(handlers) {
    const balanceEl = el('balance');
    const storageWarning = el('storage-warning');
    const paytableBody = el('paytable-body');
    const handEl = el('hand');
    const resultEl = el('result');
    const wagerInput = el('wager');
    const dealBtn = el('deal');
    const rebuyNote = el('rebuy-note');
    const rebuyBtn = el('rebuy');
    // --- paytable (static) ---
    const payRows = new Map();
    for (const rank of HAND_ORDER) {
        const tr = document.createElement('tr');
        const marker = document.createElement('td');
        marker.className = 'win-marker';
        const name = document.createElement('th');
        name.scope = 'row';
        name.textContent = HAND_LABELS[rank];
        const pays = document.createElement('td');
        pays.textContent = `${PAYTABLE[rank]}×`;
        tr.append(marker, name, pays);
        paytableBody.append(tr);
        payRows.set(rank, tr);
    }
    // --- hand slots (static) ---
    const slots = [];
    for (let i = 0; i < 5; i++) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card-slot';
        button.setAttribute('aria-pressed', 'false');
        const tag = document.createElement('span');
        tag.className = 'hold-tag';
        tag.textContent = 'Held';
        const frame = document.createElement('span');
        frame.className = 'card-frame';
        const face = document.createElement('span');
        face.className = 'card-face';
        frame.append(face);
        const hotkey = document.createElement('span');
        hotkey.className = 'card-hotkey';
        hotkey.textContent = String(i + 1);
        button.append(tag, frame, hotkey);
        button.addEventListener('click', () => handlers.onHold(i));
        li.append(button);
        handEl.append(li);
        slots.push({ button, frame, face });
    }
    // --- events ---
    dealBtn.addEventListener('click', () => handlers.onPrimary());
    rebuyBtn.addEventListener('click', () => handlers.onRebuy());
    wagerInput.addEventListener('input', () => handlers.onWagerInput(wagerInput.value));
    el('wager-half').addEventListener('click', () => handlers.onWagerQuick('half'));
    el('wager-double').addEventListener('click', () => handlers.onWagerQuick('double'));
    el('wager-max').addEventListener('click', () => handlers.onWagerQuick('max'));
    // Hotkeys: 1-5 hold, Enter deals/draws — how a real machine behaves.
    document.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey)
            return;
        const target = event.target;
        const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
        if (event.key >= '1' && event.key <= '5' && !typing) {
            event.preventDefault();
            handlers.onHold(Number(event.key) - 1);
            return;
        }
        if (event.key === 'Enter') {
            // Let Enter activate a focused button normally; only take over when
            // focus is elsewhere (including the wager field).
            if (target instanceof HTMLButtonElement)
                return;
            event.preventDefault();
            handlers.onPrimary();
        }
    });
    // --- rendering ---
    let lastShown = [null, null, null, null, null];
    function paintCard(slot, card, animate) {
        const col = card ? spriteCol(card.rank) : CARD_BACK_COL;
        const row = card ? spriteRow(card.suit) : CARD_BACK_ROW;
        slot.face.style.setProperty('--col', String(col));
        slot.face.style.setProperty('--row', String(row));
        if (animate) {
            slot.frame.classList.remove('is-entering');
            // Force a reflow so the animation restarts on a repeated deal.
            void slot.frame.offsetWidth;
            slot.frame.classList.add('is-entering');
        }
    }
    function render(vm) {
        const { state } = vm;
        balanceEl.textContent = chips(vm.balance);
        storageWarning.hidden = vm.persistent;
        const dealt = state.phase === 'dealt';
        const resolved = state.phase === 'resolved';
        const betting = state.phase === 'betting';
        // Cards
        const cards = betting ? [null, null, null, null, null] : [...state.hand];
        const scoring = resolved ? new Set(state.result.scoringIndices) : new Set();
        cards.forEach((card, i) => {
            const slot = slots[i];
            const id = card ? `${card.rank}${card.suit}` : 'back';
            const changed = lastShown[i] !== id;
            lastShown[i] = id;
            paintCard(slot, card, changed);
            const held = betting ? false : state.held[i] === true;
            slot.button.setAttribute('aria-pressed', String(held));
            slot.button.disabled = !dealt;
            slot.button.setAttribute('aria-label', card ? `${cardLabel(card)}${held ? ', held' : ''}` : 'Face down');
            slot.frame.classList.toggle('is-scoring', scoring.has(i));
        });
        // Paytable highlight
        const winner = resolved && state.result.multiplier > 0 ? state.result.rank : null;
        for (const [rank, row] of payRows) {
            const isWinner = rank === winner;
            row.classList.toggle('is-winner', isWinner);
            const marker = row.firstElementChild;
            marker.textContent = isWinner ? 'WIN' : '';
            if (isWinner)
                row.setAttribute('aria-current', 'true');
            else
                row.removeAttribute('aria-current');
        }
        // Result readout
        resultEl.classList.toggle('is-loss', resolved && state.result.multiplier === 0);
        if (resolved) {
            const won = state.payout > 0;
            resultEl.replaceChildren(span('result-hand', state.result.label), span('result-amount', won ? `Win ${chips(state.payout)} chips` : `Lost ${chips(state.wager)} chips`));
        }
        else if (dealt) {
            resultEl.replaceChildren(span('result-hint', 'Hold the cards you want to keep, then draw.'));
        }
        else {
            resultEl.replaceChildren(span('result-hint', 'Place your bet and deal.'));
        }
        // Controls
        dealBtn.textContent = dealt ? 'Draw' : 'Deal';
        dealBtn.disabled = betting && (!vm.wagerValid || vm.balance <= 0);
        // Only write when it actually differs — assigning .value on every
        // render would jump the caret while the player is typing.
        if (wagerInput.value !== vm.wagerText)
            wagerInput.value = vm.wagerText;
        wagerInput.disabled = !betting;
        wagerInput.classList.toggle('is-invalid', betting && !vm.wagerValid);
        for (const id of ['wager-half', 'wager-double', 'wager-max']) {
            el(id).disabled = !betting;
        }
        rebuyNote.hidden = !(betting && vm.balance <= 0);
    }
    function span(className, text) {
        const node = document.createElement(className === 'result-hint' ? 'p' : 'span');
        node.className = className;
        node.textContent = text;
        return node;
    }
    /** After a draw the card buttons disable, which would drop focus to <body>.
     *  Move it to the result so keyboard users hear the outcome and keep a
     *  sensible tab position. */
    function focusResult() {
        resultEl.focus({ preventScroll: true });
    }
    return { render, focusResult };
}
