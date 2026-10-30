import { expect, test } from 'vitest';
import { PALETTES } from './palettes';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test('there are four palettes', () => expect(PALETTES).toHaveLength(4));

test.each(PALETTES.map((p) => [p.name, p] as const))('%s has enough contrast on both papers', (_name, p) => {
  for (const c of [...p.light.petals, p.light.centre, p.light.stem]) {
    expect(contrast(c, '#f7f0e3'), c).toBeGreaterThanOrEqual(3);
  }
  for (const c of [...p.dark.petals, p.dark.centre, p.dark.stem]) {
    expect(contrast(c, '#1f1a16'), c).toBeGreaterThanOrEqual(3);
  }
});
