import { RAMP } from './ascii';

const FONT_FAMILY = "ui-monospace, Consolas, Menlo, monospace";
const REFERENCE_SIZE = 16;
// Colours are bucketed to 4 bits per channel so the atlas stays small.
const bucket = (c: number) => c >> 4;
const unbucket = (b: number) => (b << 4) | 8;

export function createPainter(canvas: HTMLCanvasElement, cols: number, cssWidth: number) {
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is unavailable');

  g.font = `bold ${REFERENCE_SIZE}px ${FONT_FAMILY}`;
  const glyphRatio = g.measureText('@').width / REFERENCE_SIZE;
  const dpr = globalThis.devicePixelRatio || 1;
  const cellW = Math.max(1, Math.round((cssWidth / cols) * dpr));
  const fontSize = cellW / glyphRatio;
  const cellH = Math.ceil(fontSize * 1.15);
  const rows = Math.round((cols * cellW) / cellH); // keeps the drawing area square on screen

  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(canvas.height / canvas.width) * cssWidth}px`;

  const atlas = document.createElement('canvas');
  atlas.width = cellW * RAMP.length;
  atlas.height = cellH;
  let atlasG = atlas.getContext('2d') as CanvasRenderingContext2D;
  const rowsByColour = new Map<number, number>();

  function rowFor(key: number): number {
    const known = rowsByColour.get(key);
    if (known !== undefined) return known;
    const row = rowsByColour.size;
    if ((row + 1) * cellH > atlas.height) {
      const old = document.createElement('canvas');
      old.width = atlas.width;
      old.height = atlas.height;
      (old.getContext('2d') as CanvasRenderingContext2D).drawImage(atlas, 0, 0);
      atlas.height *= 2; // resizing clears the canvas and its context state
      atlasG = atlas.getContext('2d') as CanvasRenderingContext2D;
      atlasG.drawImage(old, 0, 0);
    }
    atlasG.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    atlasG.textBaseline = 'middle';
    atlasG.textAlign = 'center';
    atlasG.fillStyle = `rgb(${unbucket(key >> 8)},${unbucket((key >> 4) & 15)},${unbucket(key & 15)})`;
    for (let i = 1; i < RAMP.length; i++) {
      atlasG.fillText(RAMP[i] as string, (i + 0.5) * cellW, (row + 0.5) * cellH);
    }
    rowsByColour.set(key, row);
    return row;
  }

  const last = RAMP.length - 1;
  return {
    rows,
    paint(pixels: Uint8ClampedArray) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (x + y * cols) * 4;
          const glyph = Math.round(((pixels[i + 3] as number) / 255) * last);
          if (glyph === 0) continue;
          const key =
            (bucket(pixels[i] as number) << 8) | (bucket(pixels[i + 1] as number) << 4) | bucket(pixels[i + 2] as number);
          const row = rowFor(key);
          g.drawImage(atlas, glyph * cellW, row * cellH, cellW, cellH, x * cellW, y * cellH, cellW, cellH);
        }
      }
    },
  };
}
