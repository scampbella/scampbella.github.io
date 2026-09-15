// DOM rendering for the poker table.
//
// This is the only place in the poker game that touches the document. It owns
// no game state — main.ts holds that and hands a view model down.

import type { Card } from '../shared/cards.ts';
import {
    CARD_BACK_COL,
    CARD_BACK_ROW,
    cardLabel,
    spriteCol,
    spriteRow,
} from '../shared/cards.ts';
import { chips } from '../shared/format.ts';
import type { HandRank } from './hands.ts';
import { HAND_LABELS, HAND_RANKS, HAND_STRENGTH, PAYTABLE } from './hands.ts';
import type { PokerState } from './machine.ts';

export interface UIHandlers {
    onHold(index: number): void;
    /** Deal, draw, or start the next round — whichever the phase calls for. */
    onPrimary(): void;
    onWagerInput(raw: string): void;
    onWagerQuick(kind: 'half' | 'double' | 'max'): void;
}

export interface ViewModel {
    readonly state: PokerState;
    readonly balance: number;
    readonly persistent: boolean;
    readonly wagerText: string;
    readonly wagerValid: boolean;
}

const HAND_ORDER: readonly HandRank[] = Object.values(HAND_RANKS)
    .filter((rank) => rank !== HAND_RANKS.NOTHING)
    .sort((a, b) => HAND_STRENGTH[a] - HAND_STRENGTH[b]);

interface HandExample {
    readonly cards: readonly Card[];
    readonly description: string;
}

function currentWagerMessage(wagerText: string, balance: number): string {
    const amount = Number(wagerText);
    if (Number.isFinite(amount) && Number.isInteger(amount) && amount > balance) {
        return 'That wager is more than the chips in your bank.';
    }
    return 'Enter a whole-number wager.';
}

function exampleCard(rank: Card['rank'], suit: Card['suit']): Card {
    return { rank, suit };
}

const HAND_EXAMPLES: Readonly<Record<HandRank, HandExample>> = {
    [HAND_RANKS.ROYAL_FLUSH]: {
        cards: [exampleCard(10, 'S'), exampleCard(11, 'S'), exampleCard(12, 'S'), exampleCard(13, 'S'), exampleCard(14, 'S')],
        description: 'Ten through Ace in one suit.',
    },
    [HAND_RANKS.STRAIGHT_FLUSH]: {
        cards: [exampleCard(5, 'H'), exampleCard(6, 'H'), exampleCard(7, 'H'), exampleCard(8, 'H'), exampleCard(9, 'H')],
        description: 'Five cards in order, all in one suit.',
    },
    [HAND_RANKS.FOUR_OF_A_KIND]: {
        cards: [exampleCard(8, 'C'), exampleCard(8, 'D'), exampleCard(8, 'H'), exampleCard(8, 'S'), exampleCard(13, 'C')],
        description: 'Four cards of the same rank.',
    },
    [HAND_RANKS.FULL_HOUSE]: {
        cards: [exampleCard(12, 'C'), exampleCard(12, 'D'), exampleCard(12, 'S'), exampleCard(4, 'H'), exampleCard(4, 'C')],
        description: 'Three of one rank and two of another.',
    },
    [HAND_RANKS.FLUSH]: {
        cards: [exampleCard(2, 'D'), exampleCard(5, 'D'), exampleCard(8, 'D'), exampleCard(11, 'D'), exampleCard(13, 'D')],
        description: 'Five cards in one suit, any order.',
    },
    [HAND_RANKS.STRAIGHT]: {
        cards: [exampleCard(4, 'C'), exampleCard(5, 'D'), exampleCard(6, 'H'), exampleCard(7, 'S'), exampleCard(8, 'C')],
        description: 'Five ranks in order; suits can differ.',
    },
    [HAND_RANKS.THREE_OF_A_KIND]: {
        cards: [exampleCard(7, 'C'), exampleCard(7, 'D'), exampleCard(7, 'S'), exampleCard(11, 'H'), exampleCard(2, 'C')],
        description: 'Three cards of the same rank.',
    },
    [HAND_RANKS.TWO_PAIR]: {
        cards: [exampleCard(14, 'C'), exampleCard(14, 'D'), exampleCard(6, 'H'), exampleCard(6, 'S'), exampleCard(3, 'C')],
        description: 'Two different pairs.',
    },
    [HAND_RANKS.JACKS_OR_BETTER]: {
        cards: [exampleCard(11, 'C'), exampleCard(11, 'D'), exampleCard(4, 'H'), exampleCard(8, 'S'), exampleCard(14, 'C')],
        description: 'A pair of Jacks, Queens, Kings, or Aces.',
    },
    [HAND_RANKS.NOTHING]: { cards: [], description: 'No paying combination.' },
};

function el<T extends HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id}`);
    return found as T;
}

interface Slot {
    readonly button: HTMLButtonElement;
    readonly frame: HTMLElement;
    readonly face: HTMLElement;
}

export function createUI(handlers: UIHandlers) {
    const balanceEl = el('balance');
    const storageWarning = el('storage-warning');
    const paytableBody = el('paytable-body');
    const rulesHelp = el<HTMLButtonElement>('rules-help');
    const rulesDialog = el<HTMLDialogElement>('rules-dialog');
    const rulesClose = el<HTMLButtonElement>('rules-close');
    const examplesEl = el('hand-examples');
    const handEl = el<HTMLUListElement>('hand');
    const resultEl = el('result');
    const wagerInput = el<HTMLInputElement>('wager');
    const wagerError = el('wager-error');
    const dealBtn = el<HTMLButtonElement>('deal');
    const outOfChipsDialog = el<HTMLDialogElement>('out-of-chips-dialog');
    const outOfChipsClose = el<HTMLButtonElement>('out-of-chips-close');

    // --- paytable (static) ---
    const payRows = new Map<HandRank, HTMLElement>();
    for (const rank of HAND_ORDER) {
        const row = document.createElement('div');
        row.className = 'pay-row';

        const marker = document.createElement('span');
        marker.className = 'pay-win-marker';

        const name = document.createElement('span');
        name.className = 'pay-hand';
        name.textContent = HAND_LABELS[rank];

        const pays = document.createElement('span');
        pays.className = 'pay-multiplier';
        pays.textContent = `${PAYTABLE[rank]}×`;

        row.append(marker, name, pays);
        paytableBody.append(row);
        payRows.set(rank, row);

        const example = HAND_EXAMPLES[rank];
        const article = document.createElement('article');
        article.className = 'hand-example';

        const title = document.createElement('h3');
        title.textContent = HAND_LABELS[rank];

        const cards = document.createElement('div');
        cards.className = 'example-cards';
        cards.setAttribute('role', 'img');
        cards.setAttribute('aria-label', `Example hand: ${HAND_LABELS[rank]}`);
        for (const card of example.cards) {
            const face = document.createElement('span');
            face.className = 'card-face';
            face.setAttribute('aria-hidden', 'true');
            face.style.setProperty('--col', String(spriteCol(card.rank)));
            face.style.setProperty('--row', String(spriteRow(card.suit)));
            cards.append(face);
        }

        const description = document.createElement('p');
        description.textContent = example.description;
        article.append(title, cards, description);
        examplesEl.append(article);
    }

    // --- hand slots (static) ---
    const slots: Slot[] = [];
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
    wagerInput.addEventListener('input', () => handlers.onWagerInput(wagerInput.value));
    // Casino controls should feel like controls, not selectable page copy.
    // Preventing selection does not interfere with typing a wager.
    wagerInput.addEventListener('selectstart', (event) => event.preventDefault());
    el('wager-half').addEventListener('click', () => handlers.onWagerQuick('half'));
    el('wager-double').addEventListener('click', () => handlers.onWagerQuick('double'));
    el('wager-max').addEventListener('click', () => handlers.onWagerQuick('max'));
    rulesHelp.addEventListener('click', () => rulesDialog.showModal());
    rulesClose.addEventListener('click', () => rulesDialog.close());
    rulesDialog.addEventListener('click', (event) => {
        if (event.target === rulesDialog) rulesDialog.close();
    });
    outOfChipsClose.addEventListener('click', () => outOfChipsDialog.close());
    outOfChipsDialog.addEventListener('click', (event) => {
        if (event.target === outOfChipsDialog) outOfChipsDialog.close();
    });

    // Hotkeys: 1-5 hold, Enter deals/draws — how a real machine behaves.
    document.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (rulesDialog.open || outOfChipsDialog.open) return;
        const target = event.target as HTMLElement | null;
        const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

        if (event.key >= '1' && event.key <= '5' && !typing) {
            event.preventDefault();
            handlers.onHold(Number(event.key) - 1);
            return;
        }
        if (event.key === 'Enter' || event.code === 'Space') {
            // Let a focused control keep its native keyboard behaviour; only
            // take over when focus is elsewhere on the table.
            if (typing || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
            event.preventDefault();
            handlers.onPrimary();
        }
    });

    // --- rendering ---
    let lastShown: (string | null)[] = [null, null, null, null, null];

    function paintCard(slot: Slot, card: Card | null, animate: boolean): void {
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

    function render(vm: ViewModel): void {
        const { state } = vm;

        balanceEl.textContent = chips(vm.balance);
        storageWarning.hidden = vm.persistent;

        const dealt = state.phase === 'dealt';
        const resolved = state.phase === 'resolved';
        const betting = state.phase === 'betting';

        // Cards
        const cards: (Card | null)[] = betting ? [null, null, null, null, null] : [...state.hand];
        const scoring = resolved ? new Set(state.result.scoringIndices) : new Set<number>();

        cards.forEach((card, i) => {
            const slot = slots[i]!;
            const id = card ? `${card.rank}${card.suit}` : 'back';
            const changed = lastShown[i] !== id;
            lastShown[i] = id;

            paintCard(slot, card, changed);

            const held = betting ? false : state.held[i] === true;
            slot.button.setAttribute('aria-pressed', String(held));
            slot.button.disabled = !dealt;
            slot.button.setAttribute(
                'aria-label',
                card ? `${cardLabel(card)}${held ? ', held' : ''}` : 'Face down',
            );
            slot.frame.classList.toggle('is-scoring', scoring.has(i));
        });

        // Paytable highlight
        const winner = resolved && state.result.multiplier > 0 ? state.result.rank : null;
        for (const [rank, row] of payRows) {
            const isWinner = rank === winner;
            row.classList.toggle('is-winner', isWinner);
            const marker = row.firstElementChild!;
            marker.textContent = isWinner ? 'Win' : '';
            if (isWinner) row.setAttribute('aria-current', 'true');
            else row.removeAttribute('aria-current');
        }

        // Result readout
        resultEl.classList.toggle('is-loss', resolved && state.result.multiplier === 0);
        resultEl.classList.toggle(
            'is-big-win',
            resolved && HAND_STRENGTH[state.result.rank] >= HAND_STRENGTH[HAND_RANKS.FOUR_OF_A_KIND],
        );
        if (resolved) {
            const resultText =
                state.payout > state.wager
                    ? `Returned ${chips(state.payout)} chips`
                    : state.payout === state.wager
                        ? `Bet returned · break even`
                        : `Lost ${chips(state.wager)} chips`;
            resultEl.replaceChildren(
                span('result-hand', state.result.label),
                span('result-amount', resultText),
            );
        } else if (dealt) {
            resultEl.replaceChildren(span('result-hint', 'Hold the cards you want to keep, then draw.'));
        } else {
            resultEl.replaceChildren();
        }

        // Controls
        dealBtn.textContent = dealt ? 'Draw' : resolved ? 'Play Again' : 'Deal';
        const hasWagerText = vm.wagerText.trim().length > 0;
        const showWagerError = betting && hasWagerText && !vm.wagerValid && vm.balance > 0;
        dealBtn.disabled = betting && !vm.wagerValid && vm.balance > 0;

        // Only write when it actually differs — assigning .value on every
        // render would jump the caret while the player is typing.
        if (wagerInput.value !== vm.wagerText) wagerInput.value = vm.wagerText;
        wagerInput.disabled = !betting;
        wagerInput.classList.toggle('is-invalid', showWagerError);
        wagerInput.setAttribute('aria-invalid', String(showWagerError));
        wagerError.hidden = !showWagerError;
        wagerError.textContent = currentWagerMessage(vm.wagerText, vm.balance);

        for (const id of ['wager-half', 'wager-double', 'wager-max']) {
            (el(id) as HTMLButtonElement).disabled = !betting;
        }

    }

    function showOutOfChips(): void {
        if (!outOfChipsDialog.open) outOfChipsDialog.showModal();
    }

    function span(className: string, text: string): HTMLElement {
        const node = document.createElement(className === 'result-hint' ? 'p' : 'span');
        node.className = className;
        node.textContent = text;
        return node;
    }

    /** After a draw the card buttons disable, which would drop focus to <body>.
     *  Move it to the result so keyboard users hear the outcome and keep a
     *  sensible tab position. */
    function focusResult(): void {
        resultEl.focus({ preventScroll: true });
    }

    return { render, focusResult, showOutOfChips };
}
