import { beforeEach, describe, expect, it } from 'vitest';
import { getModeConfig, MODE_CONFIGS, SINGLE_PRESET_IDS } from '../js/mode-config.js';
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

  it('defines the 5-slot difficulty ladder for hard and expert', () => {
    expect(getModeConfig('hard')).toMatchObject({
      codeLength: 5,
      maxGuesses: 12,
      paletteColorCount: 7,
    });
    expect(getModeConfig('expert')).toMatchObject({
      codeLength: 5,
      maxGuesses: 10,
      paletteColorCount: 8,
    });
  });

  it('exports the single-player preset list and labels', () => {
    expect(SINGLE_PRESET_IDS).toEqual(['starter', 'classic', 'hard', 'expert']);
    expect(MODE_CONFIGS.starter.label).toBe('入门模式');
    expect(MODE_CONFIGS.classic.label).toBe('经典模式');
    expect(MODE_CONFIGS.hard.label).toBe('困难模式');
    expect(MODE_CONFIGS.daily.label).toBe('每日挑战');
    expect(MODE_CONFIGS.duplicates.label).toBe('重复色模式');
    expect(MODE_CONFIGS.expert.label).toBe('专家模式');
  });
});
