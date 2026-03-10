import { beforeEach, describe, expect, it } from 'vitest';
import { getModeConfig, MODE_CONFIGS } from '../js/mode-config.js';
import { GameState } from '../js/state.js';

describe('mode configs', () => {
  beforeEach(() => {
    GameState.reset();
  });

  it('duplicate mode allows repeated colors', () => {
    GameState.setVariant('duplicates');
    GameState.setActiveConfig(getModeConfig('duplicates'));

    expect(GameState.setGuessColor('c1')).toBe(true);
    expect(GameState.setGuessColor('c1')).toBe(true);
  });

  it('classic mode rejects repeated colors', () => {
    GameState.setVariant('classic');
    GameState.setActiveConfig(getModeConfig('classic'));

    expect(GameState.setGuessColor('c1')).toBe(true);
    expect(GameState.setGuessColor('c1')).toBe(false);
  });

  it('expert mode uses fewer guesses', () => {
    expect(getModeConfig('expert').maxGuesses).toBe(8);
  });

  it('maps mode ids to labels correctly', () => {
    expect(MODE_CONFIGS.classic.label).toBe('单人经典');
    expect(MODE_CONFIGS.daily.label).toBe('每日挑战');
    expect(MODE_CONFIGS.duplicates.label).toBe('重复色模式');
    expect(MODE_CONFIGS.expert.label).toBe('专家模式');
  });
});
