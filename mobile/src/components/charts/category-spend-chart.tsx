import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChartColors } from '@/hooks/use-theme';
import { roundedRectPath } from '@/lib/chart-geometry';
import { formatMoney } from '@/lib/format';

import type { CategorySpend } from '@/features/dashboard/api';

const VIEW_W = 320;
const BAR_H = 20;
const RADIUS = 4;
const GAP = 2;
const MAX_SLOTS = 6; // categorical token ceiling — the rest folds into "Other"

interface Segment {
  name: string;
  amount: number;
  color: string;
}

export function CategorySpendChart({ categories }: { categories: CategorySpend[] }) {
  const chart = useChartColors();

  const sorted = [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, MAX_SLOTS);
  const rest = sorted.slice(MAX_SLOTS);
  const otherAmount = rest.reduce((sum, c) => sum + c.amount, 0);

  const segments: Segment[] = top.map((c, i) => ({ name: c.name, amount: c.amount, color: chart.categorical[i] }));
  if (otherAmount > 0) segments.push({ name: 'Other', amount: otherAmount, color: chart.muted });

  const total = segments.reduce((sum, s) => sum + s.amount, 0);

  if (segments.length === 0 || total <= 0) {
    return (
      <ThemedView type="backgroundElement" style={{ borderRadius: Spacing.three, padding: Spacing.three }}>
        <ThemedText type="small" themeColor="textSecondary">
          No categorized spending yet.
        </ThemedText>
      </ThemedView>
    );
  }

  const gapTotal = GAP * (segments.length - 1);
  const availableWidth = VIEW_W - gapTotal;

  let cursor = 0;
  const bars = segments.map((segment, i) => {
    const width = (segment.amount / total) * availableWidth;
    const x = cursor;
    cursor += width + GAP;
    return (
      <Path
        key={segment.name}
        d={roundedRectPath(x, 0, width, BAR_H, RADIUS, { tl: i === 0, bl: i === 0, tr: i === segments.length - 1, br: i === segments.length - 1 })}
        fill={segment.color}
      />
    );
  });

  return (
    <ThemedView type="backgroundElement" style={{ borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three }}>
      <Svg width="100%" height={BAR_H} viewBox={`0 0 ${VIEW_W} ${BAR_H}`}>
        {bars}
      </Svg>

      <ThemedView style={{ gap: Spacing.one }}>
        {segments.map((segment) => (
          <ThemedView key={segment.name} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ThemedView style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: segment.color }} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {segment.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {Math.round((segment.amount / total) * 100)}%
            </ThemedText>
            <ThemedText type="smallBold">{formatMoney(segment.amount)}</ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
  );
}
