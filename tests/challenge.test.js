import { describe, expect, it } from 'vitest';
import {
    buildChallengeIntroContent,
    buildShareText,
    buildChallengeUrl,
    parseChallengePayload,
} from '../js/share.js';
import { FEEDBACK } from '../js/engine.js';

describe('buildChallengeUrl', () => {
    const baseUrl = 'https://mastermind.rustypiano.com/';

    it('encodes a secret code array into a base64 URL parameter', () => {
        const url = buildChallengeUrl(['c1', 'c2', 'c3', 'c4'], baseUrl);
        expect(url).toMatch(/^\S+\?challenge=.+$/);
        expect(url.startsWith(baseUrl)).toBe(true);
    });

    it('produces a decodable classic payload that round-trips correctly', () => {
        const secret = ['c3', 'c5', 'c1', 'c7'];
        const url = buildChallengeUrl(secret, baseUrl);
        const encoded = url.split('?challenge=')[1];
        const decoded = JSON.parse(atob(encoded));
        expect(decoded).toEqual({
            v: 2,
            m: 'classic',
            s: secret,
        });
        expect(parseChallengePayload(encoded)).toEqual({
            secretCode: secret,
            variant: 'classic',
            challengeSource: null,
            challengeTargetRounds: null,
        });
    });

    it('supports optional challenge metadata in v2 payloads', () => {
        const secret = ['c1', 'c2', 'c3', 'c4'];
        const url = buildChallengeUrl(secret, baseUrl, {
            variant: 'classic',
            source: 'result_share',
            targetRounds: 4,
        });
        const encoded = url.split('?challenge=')[1];

        expect(parseChallengePayload(encoded)).toEqual({
            secretCode: secret,
            variant: 'classic',
            challengeSource: 'result_share',
            challengeTargetRounds: 4,
        });
    });

    it('strips existing query params from the base URL', () => {
        const url = buildChallengeUrl(['c1', 'c2', 'c3', 'c4'], 'https://example.com/?foo=bar');
        expect(url).toMatch(/^https:\/\/example\.com\/\?challenge=/);
        expect(url).not.toContain('foo=bar');
    });

    it('strips existing hash from the base URL', () => {
        const url = buildChallengeUrl(['c1', 'c2', 'c3', 'c4'], 'https://example.com/#section');
        expect(url).toMatch(/^https:\/\/example\.com\/\?challenge=/);
        expect(url).not.toContain('#section');
    });

    it('supports 5-slot challenge payloads when the variant is provided', () => {
        const secret = ['c1', 'c2', 'c3', 'c4', 'c5'];
        const url = buildChallengeUrl(secret, baseUrl, { variant: 'hard' });
        const encoded = url.split('?challenge=')[1];
        expect(parseChallengePayload(encoded)).toEqual({
            secretCode: secret,
            variant: 'hard',
            challengeSource: null,
            challengeTargetRounds: null,
        });
    });

    it('keeps backward compatibility with old classic payloads', () => {
        const encoded = btoa(JSON.stringify({ s: ['c1', 'c2', 'c3', 'c4'] }));

        expect(parseChallengePayload(encoded)).toEqual({
            secretCode: ['c1', 'c2', 'c3', 'c4'],
            variant: 'classic',
            challengeSource: null,
            challengeTargetRounds: null,
        });
    });

    it('rejects invalid or incompatible challenge payloads', () => {
        const invalidClassicLength = btoa(JSON.stringify({ s: ['c1', 'c2', 'c3', 'c4', 'c5'] }));
        const invalidVariant = btoa(JSON.stringify({ v: 1, m: 'daily', s: ['c1', 'c2', 'c3', 'c4'] }));

        expect(parseChallengePayload('not-base64')).toBeNull();
        expect(parseChallengePayload(invalidClassicLength)).toBeNull();
        expect(parseChallengePayload(invalidVariant)).toBeNull();
    });
});

describe('buildChallengeIntroContent', () => {
    it('uses a comparison prompt when the inviter score is available', () => {
        expect(buildChallengeIntroContent({
            variant: 'classic',
            challengeTargetRounds: 4,
        })).toMatchObject({
            title: '经典模式 好友挑战',
            body: '朋友用了 4 步。你能更少吗？',
            actionLabel: '开始挑战',
        });
    });

    it('falls back to a generic prompt without inviter score', () => {
        expect(buildChallengeIntroContent({
            variant: 'hard',
            challengeTargetRounds: null,
        })).toMatchObject({
            title: '困难模式 好友挑战',
            body: '朋友留下了一道密码，来破解吧。',
            actionLabel: '开始挑战',
        });
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
