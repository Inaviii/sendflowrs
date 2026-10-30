export const SPECIES = ['rose', 'tulip', 'daisy', 'sunflower', 'lavender', 'cherry'] as const;
export type Species = (typeof SPECIES)[number];

export type CodePayload = { iv: string; ct: string };

export type Gift = {
  v: 1;
  flowers: Species[];
  palette: number;
  seed: number;
  to?: string;
  from?: string;
  note?: string;
  code?: CodePayload;
};

export const LIMITS = { to: 40, from: 40, note: 280, code: 64, iv: 16, ct: 364, body: 2048 } as const;

const FIELDS = new Set(['v', 'flowers', 'palette', 'seed', 'to', 'from', 'note', 'code']);
const BASE64URL = /^[\w-]+$/;

type Result = { ok: true; gift: Gift } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isSpecies = (x: unknown): x is Species => SPECIES.includes(x as Species);

const badText = (x: unknown, max: number) => x !== undefined && (typeof x !== 'string' || x.length > max);

export function validateGift(input: unknown): Result {
  if (!isRecord(input)) return fail('gift must be an object');
  if (Object.keys(input).some((k) => !FIELDS.has(k))) return fail('unknown field');
  const { v, flowers, palette, seed, to, from, note, code } = input;

  if (v !== 1) return fail('unsupported version');
  if (!Array.isArray(flowers) || flowers.length < 1 || flowers.length > 5 || !flowers.every(isSpecies)) {
    return fail('flowers must be 1 to 5 known species');
  }
  if (!Number.isInteger(palette) || (palette as number) < 0 || (palette as number) > 3) return fail('bad palette');
  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff) return fail('bad seed');
  if (badText(to, LIMITS.to) || badText(from, LIMITS.from) || badText(note, LIMITS.note)) {
    return fail('text field too long');
  }

  const gift: Gift = { v, flowers, palette: palette as number, seed: seed as number };
  if (to !== undefined) gift.to = to as string;
  if (from !== undefined) gift.from = from as string;
  if (note !== undefined) gift.note = note as string;

  if (code !== undefined) {
    if (!isRecord(code) || Object.keys(code).length !== 2) return fail('bad code');
    const { iv, ct } = code;
    if (typeof iv !== 'string' || iv.length !== LIMITS.iv || !BASE64URL.test(iv)) return fail('bad code');
    if (typeof ct !== 'string' || ct.length > LIMITS.ct || !BASE64URL.test(ct)) return fail('bad code');
    gift.code = { iv, ct };
  }
  return { ok: true, gift };
}
