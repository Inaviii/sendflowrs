import { expect, test } from 'vitest';
import type { Gift } from '../gift/gift';
import { describeBouquet, greeting, signature } from './copy';

const g: Gift = { v: 1, flowers: ['rose', 'rose', 'daisy'], palette: 0, seed: 1 };

test('greets by name or generically', () => {
  expect(greeting({ ...g, to: 'Sam' })).toBe('for Sam');
  expect(greeting(g)).toBe('someone sent you flowers');
  expect(greeting({ ...g, to: '   ' })).toBe('someone sent you flowers');
});

test('describes the bouquet for screen readers', () => {
  expect(describeBouquet(g)).toBe('A bouquet of 2 roses and a daisy.');
  expect(describeBouquet({ ...g, flowers: ['tulip'] })).toBe('A bouquet of a tulip.');
  expect(describeBouquet({ ...g, flowers: ['lavender', 'cherry', 'cherry', 'sunflower'] })).toBe(
    'A bouquet of a lavender sprig, 2 cherry blossoms and a sunflower.',
  );
});

test('signs only when there is a sender', () => {
  expect(signature(g)).toBeNull();
  expect(signature({ ...g, from: '  ' })).toBeNull();
  expect(signature({ ...g, from: 'Alex' })).toBe('from Alex');
});
