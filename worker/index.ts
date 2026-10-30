import { LIMITS, validateGift } from '../src/gift/gift';

type Env = Cloudflare.Env;

const ONE_YEAR = 31_536_000;
const ID_LENGTH = 7;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_PATH = /^\/api\/gifts\/([0-9A-Za-z]{7})$/;

const json = (body: unknown, status: number) => Response.json(body, { status });
const error = (message: string, status: number) => json({ error: message }, status);

export function newId(): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2))) {
      // Rejecting the top of the byte range keeps every character equally likely.
      if (byte < ALPHABET.length * 4 && id.length < ID_LENGTH) id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}

async function createGift(request: Request, env: Env): Promise<Response> {
  const { success } = await env.CREATE_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' });
  if (!success) return error('too many gifts, try again shortly', 429);

  if (Number(request.headers.get('content-length')) > LIMITS.body) return error('gift too large', 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > LIMITS.body) return error('gift too large', 413);

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return error('body is not valid JSON', 400);
  }
  const result = validateGift(input);
  if (!result.ok) return error(result.error, 400);

  const id = newId();
  try {
    await env.GIFTS.put(id, JSON.stringify(result.gift), { expirationTtl: ONE_YEAR });
  } catch {
    return error('could not store the gift', 503);
  }
  return json({ id }, 201);
}

async function readGift(id: string, env: Env): Promise<Response> {
  const stored = await env.GIFTS.get(id);
  if (stored === null) return error('gift not found', 404);
  return new Response(stored, { headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (pathname === '/api/gifts' && request.method === 'POST') return createGift(request, env);
    const id = request.method === 'GET' ? ID_PATH.exec(pathname)?.[1] : undefined;
    return id ? readGift(id, env) : error('not found', 404);
  },
} satisfies ExportedHandler<Env>;
