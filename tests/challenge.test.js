import { describe, expect, it } from 'vitest';
import { buildShareText, buildChallengeUrl } from '../js/share.js';
import { FEEDBACK } from '../js/engine.js';

describe('buildChallengeUrl', () => {
    const baseUrl = 'https://mastermind.rustypiano.com/';

    it('encodes a secret code array into a base64 URL parameter', () => {
        const url = buildChallengeUrl(['c1', 'c2', 'c3', 'c4'], baseUrl);
        expect(url).toMatch(/^\S+\?challenge=.+$/);
        expect(url.startsWith(baseUrl)).toBe(true);
    });

    it('produces a decodable payload that round-trips correctly', () => {
        const secret = ['c3', 'c5', 'c1', 'c7'];
        const url = buildChallengeUrl(secret, baseUrl);
        const encoded = url.split('?challenge=')[1];
        const decoded = JSON.parse(atob(encoded));
        expect(decoded.s).toEqual(secret);
    });

    it('strips existing query params from the base URL', () => {
        const url = buildChallengeUrl(['c1', 'c2'], 'https://example.com/?foo=bar');
        expect(url).toMatch(/^https:\/\/example\.com\/\?challenge=/);
        expect(url).not.toContain('foo=bar');
    });

    it('strips existing hash from the base URL', () => {
        const url = buildChallengeUrl(['c1', 'c2'], 'https://example.com/#section');
        expect(url).toMatch(/^https:\/\/example\.com\/\?challenge=/);
        expect(url).not.toContain('#section');
    });

    it('handles 5-slot secrets (hard/expert mode)', () => {
        const secret = ['c1', 'c2', 'c3', 'c4', 'c5'];
        const url = buildChallengeUrl(secret, baseUrl);
        const encoded = url.split('?challenge=')[1];
        const decoded = JSON.parse(atob(encoded));
        expect(decoded.s).toEqual(secret);
    });
});

describe('buildShareText with challenge mode', () => {
    const baseHistory = [
        { feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
        { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT] },
    ];

    it('uses challenge title and challenge URL for challenge results', () => {
        const text = buildShareText({
            mode: 'dual',
            variant: 'classic',
            challengeKey: null,
            isChallenge: true,
            challengeUrl: 'https://mastermind.rustypiano.com/?challenge=abc123',
            rounds: 2,
            maxGuesses: 10,
            win: true,
            history: baseHistory,
        });

        expect(text).toContain('密码机 解锁了好友的密码挑战！');
        expect(text).toContain('https://mastermind.rustypiano.com/?challenge=abc123');
        expect(text).not.toContain('双人对战');
    });

    it('uses site URL for normal dual results', () => {
        const text = buildShareText({
            mode: 'dual',
            variant: 'classic',
            challengeKey: null,
            isChallenge: false,
            rounds: 2,
            maxGuesses: 10,
            win: true,
            history: baseHistory,
        });

        expect(text).toContain('密码机 双人对战');
        expect(text).toContain('https://mastermind.rustypiano.com/');
    });

    it('uses site URL when isChallenge is true but challengeUrl is missing', () => {
        const text = buildShareText({
            mode: 'dual',
            variant: 'classic',
            challengeKey: null,
            isChallenge: true,
            challengeUrl: undefined,
            rounds: 2,
            maxGuesses: 10,
            win: true,
            history: baseHistory,
        });

        // Falls back to SITE_URL because challengeUrl is falsy
        expect(text).toContain('https://mastermind.rustypiano.com/');
    });

    it('daily variant takes priority over isChallenge for the title', () => {
        const text = buildShareText({
            mode: 'single',
            variant: 'daily',
            challengeKey: '2026-03-10',
            isChallenge: true,
            rounds: 3,
            maxGuesses: 10,
            win: true,
            history: baseHistory,
        });

        // Daily title takes precedence
        expect(text).toContain('密码机 每日挑战 2026-03-10');
    });
});
