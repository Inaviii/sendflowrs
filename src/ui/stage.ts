import { gridToText } from '../ascii/ascii';
import { createPainter } from '../ascii/painter';
import { BLOOM_SECONDS, drawBouquet } from '../flowers/draw';
import { WORLD, layoutBouquet, type Placement } from '../flowers/layout';
import { PALETTES } from '../flowers/palettes';
import type { Gift } from '../gift/gift';

export type Look = Pick<Gift, 'flowers' | 'palette' | 'seed'>;

const MAX_COLS = 72;
const SLOW_COLS = 48;
const CSS_PER_COL = 6;
const FRAME_MS = 1000 / 30;
const MAX_STEP_MS = 250;
const SLOW_FRAME_MS = 40;
const SLOW_CHECK_FRAMES = 15;
const TEXT_COLS = 48;
const TEXT_ROWS = 24;

const darkMode = matchMedia('(prefers-color-scheme: dark)');

function draw(g: CanvasRenderingContext2D, cols: number, rows: number, placements: Placement[], palette: number, progress: number) {
  const entry = PALETTES[palette] as (typeof PALETTES)[number];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cols, rows);
  g.setTransform(cols / WORLD, 0, 0, rows / WORLD, 0, 0);
  drawBouquet(g, placements, darkMode.matches ? entry.dark : entry.light, progress);
  return g.getImageData(0, 0, cols, rows).data;
}

function smallCanvas(cols: number, rows: number) {
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  return small.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
}

export function createStage(canvas: HTMLCanvasElement, look: Look, cssPerCol = CSS_PER_COL) {
  let placements = layoutBouquet(look.flowers, look.seed);
  let palette = look.palette;
  let progress = 1;
  let maxCols = MAX_COLS;
  let frameId = 0;
  let painter: ReturnType<typeof createPainter>;
  let cols = 0;
  let small: CanvasRenderingContext2D;

  function build() {
    const width = canvas.parentElement?.clientWidth || 320;
    cols = Math.min(maxCols, Math.floor(width / cssPerCol));
    painter = createPainter(canvas, cols, width);
    small = smallCanvas(cols, painter.rows);
  }

  const paint = () => painter.paint(draw(small, cols, painter.rows, placements, palette, progress));

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function play(onDone?: () => void, seconds = BLOOM_SECONDS) {
    stop();
    let elapsed = 0;
    let last = performance.now();
    let drawn = 0;
    let cost = 0;
    progress = 0;
    paint(); // otherwise whatever was last drawn stays up until the first tick

    const tick = (now: number) => {
      const delta = now - last;
      if (delta < FRAME_MS) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      last = now;
      // A hidden tab gets no frames, so capping the step makes the bloom wait for it while slow devices still progress.
      elapsed += Math.min(delta, MAX_STEP_MS);
      progress = Math.min(1, elapsed / (seconds * 1000));

      const started = performance.now();
      paint();
      cost += performance.now() - started;
      drawn++;
      if (drawn === SLOW_CHECK_FRAMES && cost / drawn > SLOW_FRAME_MS && cols > SLOW_COLS) {
        maxCols = SLOW_COLS;
        build();
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        frameId = 0;
        onDone?.();
      }
    };
    frameId = requestAnimationFrame(tick);
  }

  function showFinal() {
    stop();
    progress = 1;
    paint();
  }

  // Repaint only when idle: a running bloom picks up the change on its next frame.
  const repaintIfIdle = () => {
    if (!frameId) paint();
  };
  const onResize = () => {
    build();
    repaintIfIdle();
  };

  darkMode.addEventListener('change', repaintIfIdle);
  addEventListener('resize', onResize);
  build();

  return {
    play,
    showFinal,
    setLook(next: Look) {
      placements = layoutBouquet(next.flowers, next.seed);
      palette = next.palette;
      repaintIfIdle();
    },
    /** The finished bouquet as plain characters, at a fixed size that pastes well. */
    text() {
      const pixels = draw(smallCanvas(TEXT_COLS, TEXT_ROWS), TEXT_COLS, TEXT_ROWS, placements, palette, 1);
      return gridToText(pixels, TEXT_COLS, TEXT_ROWS).replace(/^\n+/, '').trimEnd();
    },
    destroy() {
      stop();
      darkMode.removeEventListener('change', repaintIfIdle);
      removeEventListener('resize', onResize);
    },
  };
}
