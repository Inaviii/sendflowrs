import type { Gift, Species } from '../gift/gift';

const NAMES: Record<Species, [one: string, many: string]> = {
  rose: ['rose', 'roses'],
  tulip: ['tulip', 'tulips'],
  daisy: ['daisy', 'daisies'],
  sunflower: ['sunflower', 'sunflowers'],
  lavender: ['lavender sprig', 'lavender sprigs'],
  cherry: ['cherry blossom', 'cherry blossoms'],
};

export function greeting(gift: Gift): string {
  const to = gift.to?.trim();
  return to ? `for ${to}` : 'someone sent you flowers';
}

export function signature(gift: Gift): string | null {
  const from = gift.from?.trim();
  return from ? `from ${from}` : null;
}

export function describeBouquet(gift: Pick<Gift, 'flowers'>): string {
  const counts = new Map<Species, number>();
  for (const f of gift.flowers) counts.set(f, (counts.get(f) ?? 0) + 1);
  const parts = [...counts].map(([species, n]) => (n === 1 ? `a ${NAMES[species][0]}` : `${n} ${NAMES[species][1]}`));
  const last = parts.pop() as string;
  return `A bouquet of ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`;
}
