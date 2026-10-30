import { expect, test } from 'vitest';
import { RAMP, charForAlpha, gridToText } from './ascii';

test('maps alpha across the ramp', () => {
  expect(charForAlpha(0)).toBe(' ');
  expect(charForAlpha(255)).toBe('@');
  expect(RAMP.indexOf(charForAlpha(128))).toBeGreaterThan(2);
});

test('exports rows and trims trailing spaces', () => {
  const px = new Uint8ClampedArray(2 * 2 * 4);
  px[3] = 255; // first cell opaque
  expect(gridToText(px, 2, 2)).toBe('@\n');
});
