export const SINGLE_PRESET_IDS = Object.freeze([
  'starter',
  'classic',
  'hard',
  'expert',
]);

export const MODE_CONFIGS = Object.freeze({
  starter: Object.freeze({
    label: '入门模式',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false,
    paletteColorCount: 6,
  }),
  classic: Object.freeze({
    label: '经典模式',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false,
    paletteColorCount: 7,
  }),
  daily: Object.freeze({
    label: '每日挑战',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false,
    paletteColorCount: 7,
  }),
  duplicates: Object.freeze({
    label: '重复色模式',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: true,
    paletteColorCount: 7,
  }),
  hard: Object.freeze({
    label: '困难模式',
    codeLength: 5,
    maxGuesses: 12,
    allowDuplicates: false,
    paletteColorCount: 7,
  }),
  expert: Object.freeze({
    label: '专家模式',
    codeLength: 5,
    maxGuesses: 10,
    allowDuplicates: false,
    paletteColorCount: 8,
  }),
});

export function getModeConfig(modeId) {
  return MODE_CONFIGS[modeId] ?? MODE_CONFIGS.classic;
}

export function isSinglePresetVariant(modeId) {
  return SINGLE_PRESET_IDS.includes(modeId);
}
