import { WORLD, type Placement } from './layout';
import type { Colours } from './palettes';
import { HEADS, darken } from './species';

export const BLOOM_SECONDS = 6;

const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const stemPoint = (p: Placement, t: number): [number, number] => {
  const baseX = WORLD / 2;
  const ctrlX = (baseX + p.x) / 2 + p.bend;
  const ctrlY = (WORLD + p.y) / 2;
  const u = 1 - t;
  return [u * u * baseX + 2 * u * t * ctrlX + t * t * p.x, u * u * WORLD + 2 * u * t * ctrlY + t * t * p.y];
};

function drawStem(g: CanvasRenderingContext2D, p: Placement, grow: number, colour: string) {
  g.strokeStyle = colour;
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(WORLD / 2, WORLD);
  for (let t = 0.05; t <= grow; t += 0.05) g.lineTo(...stemPoint(p, t));
  g.lineTo(...stemPoint(p, grow));
  g.stroke();

  const leaf = Math.max(0, (grow - 0.35) / 0.65);
  if (leaf <= 0) return;
  const [x, y] = stemPoint(p, 0.45);
  const side = p.x < WORLD / 2 ? -1 : 1;
  g.save();
  g.translate(x, y);
  g.rotate(side * 0.9);
  g.fillStyle = colour;
  g.beginPath();
  g.ellipse(0, -p.r * 0.34 * leaf, p.r * 0.14 * leaf, p.r * 0.34 * leaf, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** `g` must already be scaled so WORLD units fill the canvas. */
export function drawBouquet(g: CanvasRenderingContext2D, placements: Placement[], colours: Colours, progress: number) {
  // Each flower opens the whole time it grows, and all finish together at progress 1.
  const grows = placements.map((p) => ease((progress - p.delay) / (1 - p.delay)));
  placements.forEach((p, i) => {
    if ((grows[i] as number) > 0) drawStem(g, p, grows[i] as number, colours.stem);
  });
  placements.forEach((p, i) => {
    const grow = grows[i] as number;
    if (grow <= 0) return;
    const [x, y] = stemPoint(p, grow);
    g.save();
    g.translate(x, y);
    g.rotate(p.tilt * (p.species === 'tulip' || p.species === 'lavender' ? 0.5 : 1) + (1 - grow) * 0.7);
    const petal = colours.petals[i % colours.petals.length] as string;
    HEADS[p.species](g, p.r, grow, { petal, edge: darken(petal), centre: colours.centre });
    g.restore();
  });
}
