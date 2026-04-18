import { describe, expect, it, vi } from 'vitest';
import {
  getDeviceType,
  trackEvent,
  trackGameFinish,
  trackGameStart,
  trackGuessSubmit,
  trackHomeView,
  trackModeClick,
} from '../js/analytics.js';

describe('getDeviceType', () => {
  it('detects mobile browsers', () => {
    expect(getDeviceType({ userAgentData: { mobile: true } })).toBe('mobile');
    expect(getDeviceType({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('mobile');
  });

  it('falls back to desktop', () => {
    expect(getDeviceType({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe('desktop');
  });
});

describe('trackEvent', () => {
  it('is a no-op when analytics is unavailable', () => {
    expect(trackEvent('home_view', { is_first_session: true }, null)).toBe(false);
  });

  it('forwards the event name and flat payload to the analytics client', () => {
    const analytics = vi.fn();

    expect(trackEvent('mode_click', {
      mode: 'single',
      variant: 'classic',
      nested: { ignored: true },
    }, analytics)).toBe(true);

    expect(analytics).toHaveBeenCalledWith('mode_click', {
      mode: 'single',
      variant: 'classic',
    });
  });
});

describe('analytics event helpers', () => {
  it('tracks the home view with first-session and device context', () => {
    const tracker = vi.fn();

    trackHomeView({ isFirstSession: true, deviceType: 'mobile' }, tracker);

    expect(tracker).toHaveBeenCalledWith('home_view', {
      is_first_session: true,
      device_type: 'mobile',
    });
  });

  it('tracks representative funnel events with compact payloads', () => {
    const tracker = vi.fn();

    trackModeClick({ mode: 'single', variant: 'daily' }, tracker);
    trackGameFinish({ variant: 'daily', win: false, roundsUsed: 10 }, tracker);

    expect(tracker).toHaveBeenNthCalledWith(1, 'mode_click', {
      mode: 'single',
      variant: 'daily',
    });
    expect(tracker).toHaveBeenNthCalledWith(2, 'game_finish', {
      variant: 'daily',
      win: false,
      rounds_used: 10,
      is_practice: false,
    });
  });

  it('marks daily practice events separately from official daily runs', () => {
    const tracker = vi.fn();

    trackGameStart({ variant: 'daily', isChallenge: false, isPractice: true }, tracker);
    trackGuessSubmit({ variant: 'daily', round: 2, isPractice: true }, tracker);
    trackGameFinish({ variant: 'daily', win: true, roundsUsed: 5, isPractice: true }, tracker);

    expect(tracker).toHaveBeenNthCalledWith(1, 'game_start', {
      variant: 'daily',
      is_challenge: false,
      is_practice: true,
    });
    expect(tracker).toHaveBeenNthCalledWith(2, 'guess_submit', {
      variant: 'daily',
      round: 2,
      is_practice: true,
    });
    expect(tracker).toHaveBeenNthCalledWith(3, 'game_finish', {
      variant: 'daily',
      win: true,
      rounds_used: 5,
      is_practice: true,
    });
  });
});
