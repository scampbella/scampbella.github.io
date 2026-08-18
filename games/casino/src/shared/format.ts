// Display formatting helpers.

/** Chip amounts, e.g. 12345 -> "12,345". */
export function chips(n: number): string {
    if (!Number.isFinite(n)) return '0';
    return Math.trunc(n).toLocaleString('en-US');
}

/** Signed amounts for net profit, e.g. -250 -> "-250", 250 -> "+250". */
export function signedChips(n: number): string {
    if (!Number.isFinite(n)) return '+0';
    const t = Math.trunc(n);
    return t < 0 ? `-${chips(-t)}` : `+${chips(t)}`;
}
