// ============================================================
//  Yahtzee — Scoring Logic
// ============================================================

function sumOf(dice: number[], value: number): number {
    return dice.filter(d => d === value).reduce((a, b) => a + b, 0);
}

function sumAll(dice: number[]): number {
    return dice.reduce((a, b) => a + b, 0);
}

function countMap(dice: number[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const d of dice) map.set(d, (map.get(d) ?? 0) + 1);
    return map;
}

function hasOfAKind(dice: number[], n: number): boolean {
    const counts = countMap(dice);
    for (const c of counts.values()) {
        if (c >= n) return true;
    }
    return false;
}

function isFullHouse(dice: number[]): boolean {
    const counts = countMap(dice);
    const vals = [...counts.values()].sort();
    return vals.length === 2 && vals[0] === 2 && vals[1] === 3;
}

function isStraight(dice: number[], len: number): boolean {
    const unique = [...new Set(dice)].sort((a, b) => a - b);
    if (unique.length < len) return false;
    for (let i = 0; i <= unique.length - len; i++) {
        let seq = true;
        for (let j = 1; j < len; j++) {
            if (unique[i + j] !== unique[i] + j) { seq = false; break; }
        }
        if (seq) return true;
    }
    return false;
}

function isYahtzee(dice: number[]): boolean {
    return new Set(dice).size === 1;
}
