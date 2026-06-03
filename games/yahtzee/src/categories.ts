// ============================================================
//  Yahtzee — Category Definitions
// ============================================================

const CATEGORIES: CategoryDef[] = [
    // Upper Section — indices 0-5
    { name: 'Ones', section: Section.Upper, scoreFn: d => sumOf(d, 1) },
    { name: 'Twos', section: Section.Upper, scoreFn: d => sumOf(d, 2) },
    { name: 'Threes', section: Section.Upper, scoreFn: d => sumOf(d, 3) },
    { name: 'Fours', section: Section.Upper, scoreFn: d => sumOf(d, 4) },
    { name: 'Fives', section: Section.Upper, scoreFn: d => sumOf(d, 5) },
    { name: 'Sixes', section: Section.Upper, scoreFn: d => sumOf(d, 6) },
    // Lower Section — indices 6-12
    { name: '3 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 3) ? sumAll(d) : 0 },
    { name: '4 of a Kind', section: Section.Lower, scoreFn: d => hasOfAKind(d, 4) ? sumAll(d) : 0 },
    { name: 'Full House', section: Section.Lower, scoreFn: d => isFullHouse(d) ? 25 : 0 },
    { name: 'Sm Straight', section: Section.Lower, scoreFn: d => isStraight(d, 4) ? 30 : 0 },
    { name: 'Lg Straight', section: Section.Lower, scoreFn: d => isStraight(d, 5) ? 40 : 0 },
    { name: 'Yahtzee', section: Section.Lower, scoreFn: d => isYahtzee(d) ? 50 : 0 },
    { name: 'Chance', section: Section.Lower, scoreFn: d => sumAll(d) },
];
