import { expect, test } from 'vitest';
import { buildLink, copyText } from './clipboard';

test('reports clipboard success and failure', async () => {
  expect(await copyText('a', { writeText: async () => {} })).toBe(true);
  expect(
    await copyText('a', {
      writeText: async () => {
        throw new Error('denied');
      },
    }),
  ).toBe(false);
  expect(await copyText('a', undefined)).toBe(false);
});

test('builds links with a key only when one exists', () => {
  expect(buildLink('https://sendflowrs.com', 'a8f3k2q')).toBe('https://sendflowrs.com/a8f3k2q');
  expect(buildLink('https://sendflowrs.com', 'a8f3k2q', 'KEY')).toBe('https://sendflowrs.com/a8f3k2q#KEY');
});
