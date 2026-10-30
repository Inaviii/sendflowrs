export const RAMP = ' .:-=+*o#%@';

export const charForAlpha = (alpha: number): string =>
  RAMP[Math.round((alpha / 255) * (RAMP.length - 1))] as string;

export function gridToText(pixels: Uint8ClampedArray, cols: number, rows: number): string {
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) line += charForAlpha(pixels[(x + y * cols) * 4 + 3] as number);
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}
