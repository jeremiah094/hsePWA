interface RoundedCorners {
  tl?: boolean;
  tr?: boolean;
  br?: boolean;
  bl?: boolean;
}

/** SVG path for a rect with only the requested corners rounded (radius clamped to fit). */
export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  corners: RoundedCorners = {},
): string {
  if (width <= 0 || height <= 0) return '';
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const tl = corners.tl ? r : 0;
  const tr = corners.tr ? r : 0;
  const br = corners.br ? r : 0;
  const bl = corners.bl ? r : 0;

  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : `L ${x + width} ${y}`,
    `V ${y + height - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : `L ${x + width} ${y + height}`,
    `H ${x + bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : `L ${x} ${y + height}`,
    `V ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : `L ${x} ${y}`,
    'Z',
  ].join(' ');
}
