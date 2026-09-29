/**
 * HUNTER SYSTEM design tokens. Single source of truth — tailwind.config.js
 * imports this so NativeWind classes and raw style values never drift.
 */
export const palette = {
  void: '#050813',
  panel: '#0B101E',
  panelRaised: '#111831',
  line: '#1C2A4A',
  cyan: '#00F0FF',
  cyanDim: '#0A6F7A',
  monarch: '#9D4EDD',
  crimson: '#FF0055',
  gold: '#FFC857',
  text: '#E6F7FF',
  textMuted: '#7C8DB5',
} as const;

export const fonts = {
  sans: 'Rajdhani',
  sansSemiBold: 'Rajdhani-SemiBold',
  sansBold: 'Rajdhani-Bold',
  mono: 'SpaceMono',
  monoBold: 'SpaceMono-Bold',
} as const;

export const rankColors: Record<string, string> = {
  E: '#7C8DB5',
  D: '#4ADE80',
  C: palette.cyan,
  B: '#3B82F6',
  A: palette.monarch,
  S: palette.gold,
};
