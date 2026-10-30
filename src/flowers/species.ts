import type { Species } from '../gift/gift';

type G = CanvasRenderingContext2D;
type Ink = { petal: string; edge: string; centre: string };

const TAU = Math.PI * 2;

/** Darker shade of a #rrggbb colour, used for petal rims. */
export function darken(hex: string): string {
  const channel = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// Dense fills with a lighter, darker-toned rim: the rim differs in both character and colour, so petals stay separate.
function shape(g: G, path: () => void, ink: Ink, size: number, fill = ink.petal) {
  path();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.min(2.2, size * 0.16);
  g.lineJoin = 'round';
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000';
  g.stroke();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = `${ink.edge}a0`;
  g.stroke();
}

function ring(g: G, count: number, turn: number, draw: () => void) {
  for (let i = 0; i < count; i++) {
    g.save();
    g.rotate((i / count) * TAU + turn);
    draw();
    g.restore();
  }
}

const oval = (g: G, x: number, y: number, rx: number, ry: number, angle = 0) => () => {
  g.beginPath();
  g.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), angle, 0, TAU);
};

const pointed = (g: G, length: number, width: number) => () => {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(width, -length * 0.3, width, -length * 0.7, 0, -length);
  g.bezierCurveTo(-width, -length * 0.7, -width, -length * 0.3, 0, 0);
  g.closePath();
};

function daisy(g: G, r: number, open: number, ink: Ink) {
  const length = r * open;
  ring(g, 10, 0, () => shape(g, oval(g, 0, -length * 0.62, length * 0.17, length * 0.38), ink, length));
  shape(g, oval(g, 0, 0, length * 0.3, length * 0.3), ink, length, ink.centre);
}

function sunflower(g: G, r: number, open: number, ink: Ink) {
  const length = r * open;
  ring(g, 12, 0.26, () => shape(g, pointed(g, length * 0.92, length * 0.2), ink, length));
  ring(g, 12, 0, () => shape(g, pointed(g, length, length * 0.2), ink, length));
  shape(g, oval(g, 0, 0, length * 0.46, length * 0.46), ink, length, ink.centre);
  g.fillStyle = ink.edge;
  ring(g, 8, 0, () => {
    oval(g, 0, -length * 0.26, length * 0.05, length * 0.05)();
    g.fill();
  });
  oval(g, 0, 0, length * 0.07, length * 0.07)();
  g.fill();
}

function rose(g: G, r: number, open: number, ink: Ink) {
  const size = r * open;
  ring(g, 5, 0, () => shape(g, oval(g, 0, -size * 0.52, size * 0.48, size * 0.48), ink, size));
  ring(g, 4, 0.6, () => shape(g, oval(g, 0, -size * 0.3, size * 0.34, size * 0.34), ink, size));
  shape(g, oval(g, 0, 0, size * 0.34, size * 0.34), ink, size);
  // The spiral is what says "rose" at this resolution.
  g.strokeStyle = `${ink.edge}c0`;
  g.lineWidth = Math.min(2.2, size * 0.16);
  g.beginPath();
  for (let a = 0; a < TAU * 1.6; a += 0.3) {
    const reach = size * (0.03 + (a / (TAU * 1.6)) * 0.26);
    g.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
  }
  g.stroke();
}

function tulip(g: G, r: number, open: number, ink: Ink) {
  const size = r * open;
  const height = size * 1.55;
  const width = size * 0.5;
  const petal = (angle: number, shift: number) => {
    g.save();
    g.translate(shift, height * 0.5);
    g.rotate(angle);
    shape(
      g,
      () => {
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(width * 1.2, -height * 0.1, width, -height * 0.72, 0, -height);
        g.bezierCurveTo(-width, -height * 0.72, -width * 1.2, -height * 0.1, 0, 0);
        g.closePath();
      },
      ink,
      size,
    );
    g.restore();
  };
  petal(-0.14 - 0.14 * open, -width * 0.2);
  petal(0.14 + 0.14 * open, width * 0.2);
  petal(0, 0);
}

function lavender(g: G, r: number, open: number, ink: Ink) {
  const size = r * open;
  const height = size * 2;
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const along = t / (tiers - 1);
    const y = height * 0.5 - along * height;
    const spread = size * 0.2 * (1 - along * 0.75);
    const floret = size * 0.2 * (1 - along * 0.45);
    shape(g, oval(g, -spread, y, floret * 0.85, floret * 0.7, -0.5), ink, size);
    shape(g, oval(g, spread, y, floret * 0.85, floret * 0.7, 0.5), ink, size);
  }
  shape(g, oval(g, 0, -height * 0.58, size * 0.09, size * 0.14), ink, size);
}

function cherry(g: G, r: number, open: number, ink: Ink) {
  const length = r * open;
  const width = length * 0.56;
  ring(g, 5, 0, () =>
    shape(
      g,
      () => {
        // The notch at the tip is what makes this read as a blossom rather than a daisy.
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(width, -length * 0.2, width * 1.1, -length * 1.05, width * 0.34, -length);
        g.lineTo(0, -length * 0.74);
        g.lineTo(-width * 0.34, -length);
        g.bezierCurveTo(-width * 1.1, -length * 1.05, -width, -length * 0.2, 0, 0);
        g.closePath();
      },
      ink,
      length,
    ),
  );
  shape(g, oval(g, 0, 0, length * 0.15, length * 0.15), ink, length, ink.centre);
}

export const HEADS: Record<Species, (g: G, r: number, open: number, ink: Ink) => void> = {
  rose,
  tulip,
  daisy,
  sunflower,
  lavender,
  cherry,
};
