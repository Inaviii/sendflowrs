import { expect, test } from 'vitest';
import { LIMITS } from '../gift/gift';
import { decryptCode, encryptCode } from './code';

test('round trips, including emoji and the longest code', async () => {
  for (const code of ['ABCD-1234', '🎁'.repeat(32), 'x'.repeat(64), '€'.repeat(64)]) {
    const { payload, key } = await encryptCode(code);
    expect(key).toMatch(/^[\w-]{22}$/);
    expect(payload.iv).toHaveLength(16);
    expect(payload.ct.length).toBeLessThanOrEqual(LIMITS.ct);
    expect(JSON.stringify(payload)).not.toContain('ABCD');
    expect(await decryptCode(payload, key)).toBe(code);
  }
});

test('returns null for wrong, damaged or empty keys', async () => {
  const { payload } = await encryptCode('secret');
  const other = (await encryptCode('x')).key;
  for (const bad of [other, 'not a key', '', 'A'.repeat(22)]) {
    expect(await decryptCode(payload, bad)).toBeNull();
  }
});

test('returns null for tampered ciphertext', async () => {
  const { payload, key } = await encryptCode('secret');
  const ct = (payload.ct[0] === 'A' ? 'B' : 'A') + payload.ct.slice(1);
  expect(await decryptCode({ ...payload, ct }, key)).toBeNull();
});

test('encrypting twice gives different output', async () => {
  const a = await encryptCode('same');
  const b = await encryptCode('same');
  expect(a.payload.ct).not.toBe(b.payload.ct);
  expect(a.key).not.toBe(b.key);
});
