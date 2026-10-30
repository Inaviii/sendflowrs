import { env, exports } from 'cloudflare:workers';
import { expect, test } from 'vitest';

const post = (body: unknown, ip: string = crypto.randomUUID()) =>
  exports.default.fetch('http://x/api/gifts', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (path: string) => exports.default.fetch(`http://x${path}`);
const gift = { v: 1, flowers: ['rose'], palette: 0, seed: 1 };
const idFrom = async (res: Response) => ((await res.json()) as { id: string }).id;

test('creates then fetches a gift', async () => {
  const res = await post(gift);
  expect(res.status).toBe(201);
  const id = await idFrom(res);
  expect(id).toMatch(/^[0-9A-Za-z]{7}$/);
  expect(await (await get(`/api/gifts/${id}`)).json()).toEqual(gift);
});

test('stores with a one-year expiry', async () => {
  const before = Math.floor(Date.now() / 1000);
  const id = await idFrom(await post(gift));
  const key = (await env.GIFTS.list()).keys.find((k) => k.name === id);
  expect(key?.expiration).toBeGreaterThanOrEqual(before + 31536000);
});

test('round trips markup and emoji literally at max length', async () => {
  const g = { ...gift, to: '<b>'.repeat(13), note: '😀'.repeat(140) };
  const id = await idFrom(await post(g));
  expect(await (await get(`/api/gifts/${id}`)).json()).toEqual(g);
});

test('accepts the largest valid gift', async () => {
  const big = {
    ...gift,
    flowers: Array(5).fill('sunflower'),
    seed: 4294967295,
    to: 'é'.repeat(40),
    from: 'é'.repeat(40),
    note: '€'.repeat(280),
    code: { iv: 'a'.repeat(16), ct: 'a'.repeat(364) },
  };
  expect((await post(big)).status).toBe(201);
});

test('rejects bad JSON, invalid gifts and oversized bodies', async () => {
  expect((await post('{nope')).status).toBe(400);
  expect((await post({ ...gift, palette: 9 })).status).toBe(400);
  expect((await post('x'.repeat(2049))).status).toBe(413);
});

test('returns 404 for unknown and malformed ids and paths', async () => {
  for (const p of ['/api/gifts/AAAAAAA', '/api/gifts/..%2f', '/api/other']) {
    expect((await get(p)).status).toBe(404);
  }
});

test('rate limits creation per IP without blocking others', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) statuses.push((await post(gift, '203.0.113.9')).status);
  expect(statuses).toContain(429);
  expect((await post(gift, '203.0.113.10')).status).toBe(201);
});
