import { expect, test } from 'vitest';
import { HEADS } from './species';

// Records every ellipse the head draws, so its reach can be checked without a real canvas.
function recordingCanvas() {
  const tops: number[] = [];
  const g = new Proxy(
    {
      ellipse: (_x: number, y: number, _rx: number, ry: number) => tops.push(y - ry),
    } as Record<string, unknown>,
    { get: (target, key) => target[key as string] ?? (() => {}), set: () => true },
  );
  return { g: g as unknown as CanvasRenderingContext2D, tops };
}

test('lavender stays within its slot radius above the head centre', () => {
  const { g, tops } = recordingCanvas();
  HEADS.lavender(g, 32, 1, { petal: '#000000', edge: '#000000', centre: '#000000' });
  expect(tops.length).toBeGreaterThan(0);
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(-32);
});
