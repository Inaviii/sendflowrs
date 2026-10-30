import { createPainter } from '../src/ascii/painter';
import { BLOOM_SECONDS, drawBouquet } from '../src/flowers/draw';
import { WORLD, layoutBouquet } from '../src/flowers/layout';
import { PALETTES } from '../src/flowers/palettes';
import { SPECIES, type Species } from '../src/gift/gift';

const COLS = 72;
const CSS_WIDTH = 340;
const grid = document.getElementById('grid') as HTMLElement;

const scenes: { label: string; flowers: Species[]; palette: number; seed: number }[] = [
  ...SPECIES.map((s, i) => ({ label: s, flowers: [s], palette: i % 4, seed: i + 1 })),
  ...PALETTES.map((p, i) => ({
    label: `${p.name}: five mixed`,
    flowers: ['rose', 'daisy', 'tulip', 'sunflower', 'cherry'] as Species[],
    palette: i,
    seed: i * 11 + 3,
  })),
  { label: 'three with lavender', flowers: ['lavender', 'rose', 'lavender'], palette: 1, seed: 5 },
  { label: 'five daisies', flowers: Array(5).fill('daisy') as Species[], palette: 0, seed: 9 },
];

const stages = scenes.map((scene) => {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  const caption = document.createElement('figcaption');
  caption.textContent = scene.label;
  figure.append(canvas, caption);
  grid.append(figure);
  const painter = createPainter(canvas, COLS, CSS_WIDTH);
  const small = document.createElement('canvas');
  small.width = COLS;
  small.height = painter.rows;
  const g = small.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const placements = layoutBouquet(scene.flowers, scene.seed);
  return (progress: number) => {
    const palette = PALETTES[scene.palette]!;
    const colours = document.body.classList.contains('dark') ? palette.dark : palette.light;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, COLS, painter.rows);
    g.setTransform(COLS / WORLD, 0, 0, painter.rows / WORLD, 0, 0);
    drawBouquet(g, placements, colours, progress);
    painter.paint(g.getImageData(0, 0, COLS, painter.rows).data);
  };
});

let startedAt = performance.now();
let held: number | null = null;
function frame(now: number) {
  const progress = held ?? Math.min(1, (now - startedAt) / (BLOOM_SECONDS * 1000));
  stages.forEach((draw) => draw(progress));
  if (progress < 1) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const on = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', fn);
on('replay', () => {
  held = null;
  startedAt = performance.now();
  requestAnimationFrame(frame);
});
on('end', () => {
  held = 1;
  requestAnimationFrame(frame);
});
on('theme', () => {
  document.body.classList.toggle('dark');
  held = 1;
  requestAnimationFrame(frame);
});
