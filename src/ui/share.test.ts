import { afterEach, expect, test, vi } from 'vitest';
import { downloadPng } from './share';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('keeps the download URL alive after the click, then cleans up', () => {
  vi.useFakeTimers();
  const events: string[] = [];
  const anchor = { click: () => events.push('click'), remove: () => events.push('remove') };
  vi.stubGlobal('document', {
    createElement: () => Object.assign(anchor, { append() {} }),
    body: { append: () => events.push('attach') },
  });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => events.push('revoke') });

  downloadPng({ toBlob: (done: (b: Blob) => void) => done(new Blob()) } as unknown as HTMLCanvasElement);

  expect(events).toEqual(['attach', 'click']);
  vi.runAllTimers();
  expect(events).toEqual(['attach', 'click', 'remove', 'revoke']);
});

test('downloads under the name it is given', () => {
  vi.useFakeTimers();
  const anchor = { click() {}, remove() {}, append() {}, download: '' };
  vi.stubGlobal('document', { createElement: () => anchor, body: { append() {} } });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL() {} });

  downloadPng({ toBlob: (done: (b: Blob) => void) => done(new Blob()) } as unknown as HTMLCanvasElement, 'bouquet.png');

  expect(anchor.download).toBe('bouquet.png');
});
