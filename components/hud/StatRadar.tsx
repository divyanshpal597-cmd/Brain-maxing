import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { fonts, palette } from '@/constants/theme';
import { STAT_KEYS, type HunterStats } from '@/types/hunter';

interface Props {
  stats: HunterStats;
  size?: number;
}

/** Four-axis attribute radar. Scales to the hunter's highest stat so growth stays visible. */
export function StatRadar({ stats, size = 160 }: Props) {
  const c = size / 2;
  const r = c - 22;
  const max = Math.max(20, ...STAT_KEYS.map((k) => stats[k])) * 1.1;
  // STR top, AGI right, END bottom, PER left.
  const angles = STAT_KEYS.map((_, i) => -Math.PI / 2 + (i * Math.PI) / 2);
  const point = (i: number, scale: number) => {
    const a = angles[i]!;
    return [c + Math.cos(a) * r * scale, c + Math.sin(a) * r * scale] as const;
  };
  const ring = (scale: number) => STAT_KEYS.map((_, i) => point(i, scale).join(',')).join(' ');
  const shape = STAT_KEYS.map((k, i) => point(i, stats[k] / max).join(',')).join(' ');

  return (
    <Svg width={size} height={size} accessibilityLabel="Attribute radar">
      {[0.33, 0.66, 1].map((s) => (
        <Polygon key={s} points={ring(s)} fill="none" stroke={palette.line} strokeWidth={1} />
      ))}
      {STAT_KEYS.map((_, i) => {
        const [x, y] = point(i, 1);
        return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={palette.line} strokeWidth={1} />;
      })}
      <Polygon points={shape} fill={palette.cyan + '33'} stroke={palette.cyan} strokeWidth={2} />
      {STAT_KEYS.map((k, i) => {
        const [x, y] = point(i, 1.22);
        return (
          <SvgText
            key={k}
            x={x}
            y={y + 4}
            fill={palette.textMuted}
            fontSize={11}
            fontFamily={fonts.monoBold}
            textAnchor="middle"
          >
            {k}
          </SvgText>
        );
      })}
    </Svg>
  );
}
