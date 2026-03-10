export const COLORS = [
  { id: 'c1', name: '红', bg: '#ff453a' },
  { id: 'c2', name: '橙', bg: '#ff9f0a' },
  { id: 'c3', name: '黄', bg: '#ffd60a' },
  { id: 'c4', name: '绿', bg: '#32d74b' },
  { id: 'c5', name: '蓝', bg: '#0a84ff' },
  { id: 'c6', name: '紫', bg: '#bf5af2' },
  { id: 'c7', name: '白', bg: '#ffffff' },
  { id: 'c8', name: '青', bg: '#64d2ff' },
];

export const MAX_GUESSES = 10;
export const CODE_LENGTH = 4;
export const ALLOW_DUPLICATE_COLORS = false;
export const DEFAULT_MODE_ID = 'classic';

export function getAvailableColors(colorCount = COLORS.length) {
  return COLORS.slice(0, colorCount);
}
