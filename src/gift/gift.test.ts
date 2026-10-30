import { expect, test } from 'vitest';
import { validateGift } from './gift';

const base = { v: 1, flowers: ['rose'], palette: 0, seed: 1 };

test('accepts a minimal gift', () => expect(validateGift(base).ok).toBe(true));

test('accepts duplicates up to five', () =>
  expect(validateGift({ ...base, flowers: Array(5).fill('daisy') }).ok).toBe(true));

test('counts note limit in UTF-16 units', () => {
  expect(validateGift({ ...base, note: '😀'.repeat(140) }).ok).toBe(true);
  expect(validateGift({ ...base, note: 'x'.repeat(281) }).ok).toBe(false);
});

test('keeps markup as plain data', () => {
  const r = validateGift({ ...base, note: '<img src=x onerror=alert(1)>' });
  expect(r.ok && r.gift.note).toBe('<img src=x onerror=alert(1)>');
});

test.each([
  ['non-object', null],
  ['wrong version', { ...base, v: 2 }],
  ['no flowers', { ...base, flowers: [] }],
  ['six flowers', { ...base, flowers: Array(6).fill('rose') }],
  ['unknown species', { ...base, flowers: ['cactus'] }],
  ['palette 4', { ...base, palette: 4 }],
  ['fractional palette', { ...base, palette: 1.5 }],
  ['negative seed', { ...base, seed: -1 }],
  ['seed over 32 bits', { ...base, seed: 2 ** 32 }],
  ['long name', { ...base, to: 'x'.repeat(41) }],
  ['non-string note', { ...base, note: 5 }],
  ['unknown field', { ...base, admin: true }],
  ['oversized ct', { ...base, code: { iv: 'a'.repeat(16), ct: 'a'.repeat(365) } }],
  ['bad iv', { ...base, code: { iv: 'short', ct: 'abc' } }],
  ['extra code field', { ...base, code: { iv: 'a'.repeat(16), ct: 'a', k: 'x' } }],
])('rejects %s', (_name, input) => expect(validateGift(input).ok).toBe(false));
