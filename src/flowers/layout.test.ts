import { expect, test } from 'vitest';
import type { Species } from '../gift/gift';
import { WORLD, layoutBouquet } from './layout';

const bouquets: Species[][] = [
  ['rose'],
  ['tulip', 'daisy'],
  ['rose', 'cherry', 'lavender'],
  ['sunflower', 'sunflower', 'daisy', 'tulip'],
  Array(5).fill('daisy') as Species[],
  ['rose', 'tulip', 'daisy', 'sunflower', 'lavender'],
];

test.each(bouquets.map((b) => [b]))('is stable for a seed: %j', (f) => {
  expect(layoutBouquet(f, 7)).toEqual(layoutBouquet(f, 7));
});

test('varies with seed', () => {
  const f = bouquets[5] as Species[];
  expect(layoutBouquet(f, 1)).not.toEqual(layoutBouquet(f, 2));
});

test.each(bouquets.map((b) => [b]))('keeps heads apart and in bounds: %j', (f) => {
  for (const seed of [0, 1, 123456, 4294967295]) {
    const p = layoutBouquet(f, seed);
    expect(p).toHaveLength(f.length);
    expect(p.map((a) => a.species).sort()).toEqual([...f].sort());
    p.forEach((a, i) => {
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(WORLD);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      p.slice(i + 1).forEach((b) =>
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.r + b.r) * 0.9),
      );
    });
  }
});
