import type { Species } from '../gift/gift';

export const WORLD = 100;

export type Placement = {
  species: Species;
  x: number;
  y: number;
  r: number;
  tilt: number;
  delay: number;
  bend: number;
};

type Slot = readonly [x: number, y: number, r: number];

// Hand-placed so every bouquet size looks deliberate; the seed only nudges them.
const SLOTS: readonly (readonly Slot[])[] = [
  [[50, 36, 32]],
  [[26, 38, 21], [74, 38, 21]],
  [[50, 25, 21], [22, 57, 19], [78, 57, 19]],
  [[30, 25, 19], [70, 25, 19], [22, 63, 17], [78, 63, 17]],
  [[50, 19, 17], [18, 35, 16], [82, 35, 16], [30, 67, 15], [70, 67, 15]],
];

const JITTER = 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layoutBouquet(flowers: Species[], seed: number): Placement[] {
  if (flowers.length === 0) return [];
  const random = mulberry32(seed);
  const spread = (size: number) => (random() * 2 - 1) * size;
  const order = flowers.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  const slots = SLOTS[flowers.length - 1] as readonly Slot[];
  return slots.map(([x, y, r], i) => ({
    species: flowers[order[i] as number] as Species,
    x: x + spread(JITTER),
    y: y + spread(JITTER),
    r,
    tilt: spread(0.25),
    delay: (i / slots.length) * 0.2,
    bend: spread(6),
  }));
}
