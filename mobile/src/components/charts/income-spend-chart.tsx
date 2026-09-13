import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChartColors, useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { roundedRectPath } from '@/lib/chart-geometry';

const VIEW_W = 320;
const VIEW_H = 60;
const BAR_MAX_W = 190;
const BAR_H = 14;
const BAR_RADIUS = 4;
const LABEL_X = BAR_MAX_W + 12;
const INCOME_Y = 8;
const SPEND_Y = INCOME_Y + BAR_H + 14;

/** Compact income-vs-spend bars for one account, on a shared diverging blue/red scale. */
export function IncomeSpendChart({ income, spend, title }: { income: number; spend: number; title: string }) {
  const theme = useTheme();
  const chart = useChartColors();
  const max = Math.max(income, spend, 1);
  const incomeW = (income / max) * BAR_MAX_W;
  const spendW = (spend / max) * BAR_MAX_W;
  const net = income - spend;

  return (
    <ThemedView type="backgroundElement" style={{ borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two }}>
      <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <ThemedText type="default">{title}</ThemedText>
        <ThemedText type="smallBold" style={{ color: net >= 0 ? chart.deltaGood : chart.deltaBad }}>
          {net >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(net))}
        </ThemedText>
      </ThemedView>

      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Path d={roundedRectPath(0, INCOME_Y, incomeW, BAR_H, BAR_RADIUS, { tr: true, br: true })} fill={chart.income} />
        <SvgText x={LABEL_X} y={INCOME_Y + BAR_H - 3} fontSize={12} fill={theme.textSecondary}>
          {formatMoney(income)}
        </SvgText>

        <Path d={roundedRectPath(0, SPEND_Y, spendW, BAR_H, BAR_RADIUS, { tr: true, br: true })} fill={chart.spend} />
        <SvgText x={LABEL_X} y={SPEND_Y + BAR_H - 3} fontSize={12} fill={theme.textSecondary}>
          {formatMoney(spend)}
        </SvgText>
      </Svg>
    </ThemedView>
  );
}
