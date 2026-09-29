// Keep in sync with constants/theme.ts (raw values used by Reanimated/SVG).
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        void: '#050813',
        panel: { DEFAULT: '#0B101E', raised: '#111831' },
        line: '#1C2A4A',
        cyan: { DEFAULT: '#00F0FF', dim: '#0A6F7A' },
        monarch: '#9D4EDD',
        crimson: '#FF0055',
        gold: '#FFC857',
        ink: { DEFAULT: '#E6F7FF', muted: '#7C8DB5' },
      },
      // Custom faces can't be bolded via fontWeight on native, so each weight is its own family.
      fontFamily: {
        sans: ['Rajdhani'],
        'sans-semibold': ['Rajdhani-SemiBold'],
        'sans-bold': ['Rajdhani-Bold'],
        mono: ['SpaceMono'],
        'mono-bold': ['SpaceMono-Bold'],
      },
      letterSpacing: {
        hud: '0.2em',
      },
    },
  },
  plugins: [],
};
