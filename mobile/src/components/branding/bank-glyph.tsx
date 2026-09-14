import Svg, { Polygon, Rect } from 'react-native-svg';

interface BankGlyphProps {
  size?: number;
  color?: string;
}

/** The app's bank/temple pictogram — same geometry as the app icon and splash asset. */
export function BankGlyph({ size = 96, color = '#ffffff' }: BankGlyphProps) {
  return (
    <Svg width={size} height={(size * 422) / 471} viewBox="0 0 471.04 422" fill="none">
      <Polygon points="235.52,0 430.56,104 40.48,104" fill={color} />
      <Rect x={29.44} y={122} width={412.16} height={40} rx={8} fill={color} />
      <Rect x={51.52} y={180} width={49.68} height={136} rx={4.8} fill={color} />
      <Rect x={131.1} y={180} width={49.68} height={136} rx={4.8} fill={color} />
      <Rect x={210.68} y={180} width={49.68} height={136} rx={4.8} fill={color} />
      <Rect x={290.26} y={180} width={49.68} height={136} rx={4.8} fill={color} />
      <Rect x={369.84} y={180} width={49.68} height={136} rx={4.8} fill={color} />
      <Rect x={14.72} y={334} width={441.6} height={48} rx={8} fill={color} />
      <Rect x={0} y={402} width={471.04} height={20} rx={8} fill={color} />
    </Svg>
  );
}
