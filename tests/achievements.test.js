import { describe, expect, it } from 'vitest';
import { FEEDBACK } from '../js/engine.js';
import {
    ACHIEVEMENTS,
    createDefaultStats,
    normalizeStats,
    recordGameResult,
} from '../js/stats.js';

function makeResult(overrides) {
    return {
        mode: 'single',
        variant: 'classic',
        challengeKey: null,
        rounds: 5,
        maxGuesses: 10,
        win: true,
        history: [
            { feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
        ],
        finishedAt: '2026-03-10T08:00:00.000Z',
        ...overrides,
    };
}

describe('achievements', () => {
    describe('ACHIEVEMENTS constant', () => {
        it('exports human-readable labels for each achievement', () => {
            expect(ACHIEVEMENTS.FIRST_TRY).toBe('一发入魂');
            expect(ACHIEVEMENTS.LAST_CHANCE).toBe('极限绝杀');
            expect(ACHIEVEMENTS.BLIND).toBe('盲人摸象');
        });
    });

    describe('schema', () => {
        it('includes achievements array in default stats', () => {
            const defaults = createDefaultStats();
            expect(defaults.achievements).toEqual([]);
        });

        it('preserves existing achievements through normalizeStats', () => {
            const stats = normalizeStats({ achievements: ['FIRST_TRY'] });
            expect(stats.achievements).toEqual(['FIRST_TRY']);
        });

        it('defaults to empty array when achievements field is missing', () => {
            const stats = normalizeStats({ version: 1 });
            expect(stats.achievements).toEqual([]);
        });

        it('defaults to empty array when achievements is not an array', () => {
            const stats = normalizeStats({ achievements: 'corrupted' });
            expect(stats.achievements).toEqual([]);
        });
    });

    describe('FIRST_TRY — win on the very first guess', () => {
        it('unlocks when rounds === 1 and win is true', () => {
            const stats = recordGameResult(null, makeResult({ rounds: 1, win: true }));
            expect(stats.achievements).toContain('FIRST_TRY');
        });

        it('does NOT unlock when rounds > 1', () => {
            const stats = recordGameResult(null, makeResult({ rounds: 2, win: true }));
            expect(stats.achievements).not.toContain('FIRST_TRY');
        });

        it('does NOT unlock on a loss even with rounds === 1', () => {
            // rounds === 1 + loss shouldn't happen logically, but guard anyway
            const stats = recordGameResult(null, makeResult({ rounds: 1, win: false }));
            expect(stats.achievements).not.toContain('FIRST_TRY');
        });
    });

    describe('LAST_CHANCE — win using the very last allowed guess', () => {
        it('unlocks when rounds === maxGuesses and win is true', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 10,
                maxGuesses: 10,
                win: true,
            }));
            expect(stats.achievements).toContain('LAST_CHANCE');
        });

        it('does NOT unlock when rounds < maxGuesses', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 9,
                maxGuesses: 10,
                win: true,
            }));
            expect(stats.achievements).not.toContain('LAST_CHANCE');
        });

        it('does NOT unlock on a loss at maxGuesses', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 10,
                maxGuesses: 10,
                win: false,
            }));
            expect(stats.achievements).not.toContain('LAST_CHANCE');
        });
    });

    describe('BLIND — first guess yields all NONE feedback', () => {
        it('unlocks when first guess feedback is all NONE', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: false,
                history: [
                    { feedback: [FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
                    { feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
                ],
            }));
            expect(stats.achievements).toContain('BLIND');
        });

        it('does NOT unlock when first guess has any EXACT peg', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: [
                    { feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
                ],
            }));
            expect(stats.achievements).not.toContain('BLIND');
        });

        it('does NOT unlock when first guess has any MISPLACED peg', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: [
                    { feedback: [FEEDBACK.NONE, FEEDBACK.MISPLACED, FEEDBACK.NONE, FEEDBACK.NONE] },
                ],
            }));
            expect(stats.achievements).not.toContain('BLIND');
        });

        it('does NOT unlock when first guess has a mix of EXACT and MISPLACED', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: [
                    { feedback: [FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.NONE, FEEDBACK.NONE] },
                ],
            }));
            expect(stats.achievements).not.toContain('BLIND');
        });

        it('checks only the first guess, ignoring subsequent ones', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: [
                    { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT] },
                    { feedback: [FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
                ],
            }));
            // Second guess is all NONE, but BLIND only checks the first
            expect(stats.achievements).not.toContain('BLIND');
        });
    });

    describe('deduplication', () => {
        it('does not duplicate achievements across multiple games', () => {
            let stats = recordGameResult(null, makeResult({ rounds: 1, win: true }));
            expect(stats.achievements.filter(a => a === 'FIRST_TRY')).toHaveLength(1);

            stats = recordGameResult(stats, makeResult({
                rounds: 1,
                win: true,
                variant: 'starter',
            }));
            expect(stats.achievements.filter(a => a === 'FIRST_TRY')).toHaveLength(1);
        });
    });

    describe('multiple achievements in one game', () => {
        it('can unlock FIRST_TRY and BLIND simultaneously if first guess is all NONE and rounds === 1', () => {
            // This scenario is logically impossible (can't win with all NONE), but the logic should handle it
            // In practice rounds === 1 + win means the first guess was all EXACT,
            // so BLIND should NOT be unlocked at the same time
            const stats = recordGameResult(null, makeResult({
                rounds: 1,
                win: true,
                history: [
                    { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT] },
                ],
            }));
            expect(stats.achievements).toContain('FIRST_TRY');
            expect(stats.achievements).not.toContain('BLIND');
        });

        it('can unlock LAST_CHANCE and BLIND simultaneously', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 10,
                maxGuesses: 10,
                win: true,
                history: [
                    { feedback: [FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
                    ...Array(9).fill({ feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] }),
                ],
            }));
            expect(stats.achievements).toContain('LAST_CHANCE');
            expect(stats.achievements).toContain('BLIND');
        });
    });

    describe('edge: no history', () => {
        it('does not crash when history is undefined', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: undefined,
            }));
            expect(stats.achievements).not.toContain('BLIND');
        });

        it('does not crash when history is empty', () => {
            const stats = recordGameResult(null, makeResult({
                rounds: 5,
                win: true,
                history: [],
            }));
            expect(stats.achievements).not.toContain('BLIND');
        });
    });
});
