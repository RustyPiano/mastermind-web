export const MODE_CONFIGS = Object.freeze({
  classic: Object.freeze({
    label: '单人经典',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false,
  }),
  daily: Object.freeze({
    label: '每日挑战',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false,
  }),
  duplicates: Object.freeze({
    label: '重复色模式',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: true,
  }),
  expert: Object.freeze({
    label: '专家模式',
    codeLength: 4,
    maxGuesses: 8,
    allowDuplicates: false,
  }),
});

export function getModeConfig(modeId) {
  return MODE_CONFIGS[modeId] ?? MODE_CONFIGS.classic;
}
