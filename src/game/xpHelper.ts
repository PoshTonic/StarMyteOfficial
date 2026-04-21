/**
 * XP required to advance from `level` to `level + 1`.
 * Tiered multiplier curve starting at 50 XP for level 1→2.
 * L1–9: 1.6x, L10–24: 1.2x, L25–34: 1.1x, L35–49: 1.075x, L50–99: 1.035x, L100+: 1.005x
 */
export function xpForLevel(level: number): number {
  let xp = 50;
  for (let i = 2; i <= level; i++) {
    if (i <= 10) xp *= 1.6;
    else if (i <= 25) xp *= 1.2;
    else if (i <= 35) xp *= 1.1;
    else if (i <= 50) xp *= 1.075;
    else if (i <= 100) xp *= 1.035;
    else xp *= 1.005;
  }
  return Math.floor(xp);
}

const SUFFIXES: [number, string][] = [
  [1e21, "S"],
  [1e18, "Qn"],
  [1e15, "Qd"],
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/**
 * Format large numbers with abbreviated suffixes.
 * Under 10,000: raw number. Above: xx.xxK / xxxK / xx.xxM etc.
 */
export function formatNumber(n: number): string {
  if (n < 10000) return n.toLocaleString();

  for (const [threshold, suffix] of SUFFIXES) {
    if (n >= threshold) {
      const value = n / threshold;
      if (value < 100) {
        return value.toFixed(2) + suffix;
      }
      return Math.floor(value) + suffix;
    }
  }

  return n.toLocaleString();
}
