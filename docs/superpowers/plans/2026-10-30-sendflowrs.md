# sendflowrs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prepare to launch `sendflowrs.com`, a site for sending a bouquet of ASCII-art flowers that bloom when the link is opened.

**Architecture:** One Cloudflare Worker serves a Vite-built static app and a small JSON API backed by KV. Vector flowers are drawn to a tiny offscreen canvas and converted to coloured characters. Gift codes are encrypted in the browser, with the key kept after `#` in the link.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5, Wrangler 4, `@cloudflare/vitest-plugin` 1.x, `@cloudflare/workers-types`, `qrcode-generator` 2 (the only runtime dependency, loaded on demand). No UI framework.

**Spec:** `docs/superpowers/specs/2026-10-30-sendflowrs-design.md`

## Global Constraints

- Species ids: `rose`, `tulip`, `daisy`, `sunflower`, `lavender`, `cherry`. Bouquet of 1 to 5, duplicates allowed.
- Palette index 0 to 3. Seed: unsigned 32-bit integer.
- Field limits, in UTF-16 units so they match HTML `maxlength`: `to` 40, `from` 40, `note` 280, gift code 64.
- Body limit 2048 bytes. Gift expiry 31,536,000 seconds. Gift ID: 7 base62 characters.
- `POST /api/gifts` limit: 10 per 60 seconds per IP.
- Runtime: `flowers/`, `ascii/`, `gift/`, `crypto/` import nothing from `ui/` or `worker/`.
- Non-QR JavaScript under 30,000 bytes gzipped. No font downloads. No inline scripts or styles, because of the CSP.
- User text reaches the DOM only through `textContent`. Never `innerHTML` with gift data.
- Paper `#f7f0e3`, ink `#3a2f26`. Dark paper `#1f1a16`, dark ink `#e9dfd0`. Serif `Georgia, 'Times New Roman', serif`. Mono `ui-monospace, Consolas, Menlo, monospace`.
- All copy is lowercase-friendly and warm. Exact strings: "Someone sent you flowers" (link preview title), "these flowers have wilted" (missing gift), "send flowers back" (recipient link).

## Review Focus

- A gift with only flowers (no names, note or code) should read as complete, not show empty slots. Test in Task 6.
- Names and notes with HTML, emoji or RTL text must display literally and fit the same limits in browser and Worker. Tests in Tasks 1 and 5.
- A gift code link whose `#key` was stripped or damaged by a chat app must still show the bouquet and note. Tests in Tasks 4 and 6.
- Five of the same species and a lone flower must both look deliberate: heads apart and in bounds. Test in Task 3.
- Clipboard denied or no native share must leave a working way to get the link. Test in Task 7.

---

### Task 1: Project setup and gift format

**Files:**
- Create: `package.json`, `tsconfig.json`, `worker/tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `wrangler.jsonc`, `index.html`, `src/main.ts`, `LICENSE` (MIT, Inaviii)
- Create: `src/gift/gift.ts`, `src/gift/gift.test.ts`

**Interfaces:**
- Produces, from `src/gift/gift.ts`: `SPECIES` (readonly tuple), `type Species`, `type CodePayload = { iv: string; ct: string }`, `type Gift = { v: 1; flowers: Species[]; palette: number; seed: number; to?: string; from?: string; note?: string; code?: CodePayload }`, `LIMITS = { to: 40, from: 40, note: 280, code: 64, iv: 16, ct: 364, body: 2048 }`, `validateGift(input: unknown): { ok: true; gift: Gift } | { ok: false; error: string }`.

- [ ] **Step 1: Scaffold.** Scripts: `dev` (`vite`), `build` (`vite build`), `test` (`vitest run`), `typecheck` (`tsc --noEmit && tsc --noEmit -p worker`), `size` (Task 8). `vitest.config.ts` has two projects: `unit` (`src/**/*.test.ts`, node environment) and `worker` (`worker/**/*.test.ts`, using `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })`). The root tsconfig covers `src` with DOM types; `worker/tsconfig.json` uses `@cloudflare/workers-types`. `wrangler.jsonc`:

```jsonc
{
  "name": "sendflowrs",
  "main": "worker/index.ts",
  "compatibility_date": "2026-10-30",
  "assets": { "directory": "./dist", "binding": "ASSETS", "not_found_handling": "single-page-application", "run_worker_first": ["/api/*"] },
  "kv_namespaces": [{ "binding": "GIFTS", "id": "REPLACE_WITH_KV_ID" }],
  "ratelimits": [{ "name": "CREATE_LIMIT", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }]
}
```

Run `npm install`. Expected: no peer dependency errors.

- [ ] **Step 2: Write the failing tests** in `src/gift/gift.test.ts`:

```ts
const base = { v: 1, flowers: ['rose'], palette: 0, seed: 1 };
test('accepts a minimal gift', () => expect(validateGift(base).ok).toBe(true));
test('accepts duplicates up to five', () => expect(validateGift({ ...base, flowers: Array(5).fill('daisy') }).ok).toBe(true));
test('counts note limit in UTF-16 units', () => {
  expect(validateGift({ ...base, note: '😀'.repeat(140) }).ok).toBe(true);
  expect(validateGift({ ...base, note: 'x'.repeat(281) }).ok).toBe(false);
});
test('keeps markup as plain data', () => {
  const r = validateGift({ ...base, note: '<img src=x onerror=alert(1)>' });
  expect(r.ok && r.gift.note).toBe('<img src=x onerror=alert(1)>');
});
test.each([
  ['non-object', null], ['wrong version', { ...base, v: 2 }], ['no flowers', { ...base, flowers: [] }],
  ['six flowers', { ...base, flowers: Array(6).fill('rose') }], ['unknown species', { ...base, flowers: ['cactus'] }],
  ['palette 4', { ...base, palette: 4 }], ['fractional palette', { ...base, palette: 1.5 }],
  ['negative seed', { ...base, seed: -1 }], ['seed over 32 bits', { ...base, seed: 2 ** 32 }],
  ['long name', { ...base, to: 'x'.repeat(41) }], ['non-string note', { ...base, note: 5 }],
  ['unknown field', { ...base, admin: true }], ['oversized ct', { ...base, code: { iv: 'a'.repeat(16), ct: 'a'.repeat(365) } }],
  ['bad iv', { ...base, code: { iv: 'short', ct: 'abc' } }], ['extra code field', { ...base, code: { iv: 'a'.repeat(16), ct: 'a', k: 'x' } }],
])('rejects %s', (_n, input) => expect(validateGift(input).ok).toBe(false));
```

- [ ] **Step 3: Run** `npx vitest run --project unit`. Expected: FAIL, `validateGift` missing.
- [ ] **Step 4: Implement `validateGift`.** It returns a fresh object holding only known fields. `iv` is exactly 16 base64url characters and `ct` is 1 to 364 base64url characters.
- [ ] **Step 5: Run** the same command. Expected: PASS. Also run `npm run typecheck`. Expected: no errors.
- [ ] **Step 6: Commit** with message `feat: scaffold project and gift format`, including the spec and this plan.

---

### Task 2: ASCII renderer

**Files:**
- Create: `src/ascii/ascii.ts`, `src/ascii/ascii.test.ts`, `src/ascii/painter.ts`

**Interfaces:**
- Produces, from `ascii.ts`: `RAMP = ' .:-=+*o#%@'`, `charForAlpha(alpha: number): string` (alpha 0 to 255), `gridToText(pixels: Uint8ClampedArray, cols: number, rows: number): string`.
- Produces, from `painter.ts`: `createPainter(canvas: HTMLCanvasElement, cols: number, rows: number, cssWidth: number): { paint(pixels: Uint8ClampedArray): void; cellAspect: number }`, where `cellAspect` is cell height divided by cell width.

- [ ] **Step 1: Write the failing tests:**

```ts
test('maps alpha across the ramp', () => {
  expect(charForAlpha(0)).toBe(' ');
  expect(charForAlpha(255)).toBe('@');
  expect(RAMP.indexOf(charForAlpha(128))).toBeGreaterThan(2);
});
test('exports rows and trims trailing spaces', () => {
  const px = new Uint8ClampedArray(2 * 2 * 4);
  px[3] = 255; // first cell opaque
  expect(gridToText(px, 2, 2)).toBe('@\n');
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/ascii`. Expected: FAIL.
- [ ] **Step 3: Implement `ascii.ts`.** `charForAlpha` rounds `alpha / 255 * (RAMP.length - 1)`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Implement `painter.ts`.** Measure a cell from the mono font with `measureText`, and size the canvas for `devicePixelRatio`. Keep a lazily built atlas: colours are quantised to 4 bits per channel, and each new colour gets one row of `RAMP` glyphs in an offscreen canvas, rendered on first use. `paint` clears the canvas and `drawImage`s one atlas cell for each non-space character. This is checked visually in Task 3.
- [ ] **Step 6: Commit** with message `feat: add ASCII renderer`.

---

### Task 3: Flowers, palettes and the look check

This is the biggest risk to the project. **Stop for the owner's approval at Step 7.**

**Files:**
- Create: `src/flowers/layout.ts`, `src/flowers/layout.test.ts`, `src/flowers/species.ts`, `src/flowers/draw.ts`, `src/flowers/palettes.ts`, `src/flowers/palettes.test.ts`, `dev/gallery.html`, `dev/gallery.ts`

**Interfaces:**
- Consumes: `Species` and `RAMP`-based `createPainter` from Tasks 1 and 2.
- Produces, from `layout.ts`: `WORLD = 100` (logical units per side), `type Placement = { species: Species; x: number; y: number; r: number; tilt: number; delay: number; bend: number }`, `layoutBouquet(flowers: Species[], seed: number): Placement[]`.
- Produces, from `draw.ts`: `drawBouquet(g: CanvasRenderingContext2D, placements: Placement[], colours: Colours, progress: number): void`, where `g` is already scaled to WORLD units and `progress` is 0 to 1. Also `BLOOM_SECONDS = 6`.
- Produces, from `palettes.ts`: `type Colours = { petals: string[]; centre: string; stem: string }`, `PALETTES: { name: string; light: Colours; dark: Colours }[]` with 4 entries.

- [ ] **Step 1: Write the failing tests:**

```ts
const counts = [['rose'], Array(5).fill('daisy'), ['rose','tulip','daisy','sunflower','lavender']];
test.each(counts)('is stable for a seed', (...f) => expect(layoutBouquet(f, 7)).toEqual(layoutBouquet(f, 7)));
test('varies with seed', () => expect(layoutBouquet(counts[2], 1)).not.toEqual(layoutBouquet(counts[2], 2)));
test.each(counts)('keeps heads apart and in bounds', (...f) => {
  for (const seed of [0, 1, 4294967295]) {
    const p = layoutBouquet(f, seed);
    expect(p).toHaveLength(f.length);
    p.forEach((a, i) => {
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(WORLD);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      p.slice(i + 1).forEach(b => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.r + b.r) * 0.9));
    });
  }
});
```

In `palettes.test.ts`, implement WCAG contrast inside the test and assert every `petals`, `centre` and `stem` colour reaches at least 3:1 against `#f7f0e3` (light) or `#1f1a16` (dark), and that there are 4 palettes.

- [ ] **Step 2: Run** `npx vitest run --project unit src/flowers`. Expected: FAIL.
- [ ] **Step 3: Implement `layoutBouquet` and `PALETTES`.** Use fixed slot positions per bouquet size, with small seeded jitter from a mulberry32 PRNG. Shuffle which flower takes which slot with the seed. Stems converge at the bottom centre of the world.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Implement the species and `drawBouquet`.** Each species draws at opening 0 to 1. Petal alpha fades from base to tip so the ramp shows shading. Species character: rose (layered spiral), tulip (closed cup), daisy (many thin petals, large contrast centre), sunflower (dense petals, big dark centre), lavender (a spike of small florets), cherry (5 notched petals). Stems grow first, then each head opens after its `delay`, with eased timing.
- [ ] **Step 6: Build `dev/gallery.html`.** It is not in the production build. It shows all 6 species singly and a 5-flower bouquet per palette, in light and dark, with a replay button. Run with `npx vite` and open `/dev/gallery.html`. Use the pipeline from the spec at 72 columns.
- [ ] **Step 7: Owner look check.** Screenshot the gallery in the browser and show the owner. Revise shapes until the owner approves. Each species must be recognisable and petals must be distinct, not blobs. Do not start Task 4 without approval.
- [ ] **Step 8: Commit** with message `feat: add flower species, bouquet layout and palettes`.

---

### Task 4: Gift code encryption

**Files:**
- Create: `src/crypto/code.ts`, `src/crypto/code.test.ts`

**Interfaces:**
- Consumes: `CodePayload`, `LIMITS`.
- Produces: `encryptCode(code: string): Promise<{ payload: CodePayload; key: string }>`, `decryptCode(payload: CodePayload, key: string): Promise<string | null>`. `key` is base64url with no padding, 22 characters.

- [ ] **Step 1: Write the failing tests:**

```ts
test('round trips, including emoji and the longest code', async () => {
  for (const code of ['ABCD-1234', '🎁'.repeat(32), 'x'.repeat(64)]) {
    const { payload, key } = await encryptCode(code);
    expect(key).toMatch(/^[\w-]{22}$/);
    expect(payload.iv).toHaveLength(16);
    expect(payload.ct.length).toBeLessThanOrEqual(LIMITS.ct);
    expect(JSON.stringify(payload)).not.toContain('ABCD');
    expect(await decryptCode(payload, key)).toBe(code);
  }
});
test('returns null for wrong, damaged or empty keys', async () => {
  const { payload } = await encryptCode('secret');
  const other = (await encryptCode('x')).key;
  for (const bad of [other, 'not a key', '', 'A'.repeat(22)]) expect(await decryptCode(payload, bad)).toBeNull();
});
test('returns null for tampered ciphertext', async () => {
  const { payload, key } = await encryptCode('secret');
  const ct = (payload.ct[0] === 'A' ? 'B' : 'A') + payload.ct.slice(1);
  expect(await decryptCode({ ...payload, ct }, key)).toBeNull();
});
test('encrypting twice gives different output', async () => {
  const a = await encryptCode('same'), b = await encryptCode('same');
  expect(a.payload.ct).not.toBe(b.payload.ct);
  expect(a.key).not.toBe(b.key);
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/crypto`. Expected: FAIL.
- [ ] **Step 3: Implement** with `crypto.subtle` AES-GCM, a random 128-bit key and a random 12-byte IV. `decryptCode` catches all failures and returns `null`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with message `feat: add browser encryption for gift codes`.

---

### Task 5: Worker API

**Files:**
- Create: `worker/index.ts`, `worker/index.test.ts`, `public/_headers`, `public/favicon.svg`

**Interfaces:**
- Consumes: `validateGift`, `LIMITS`.
- Produces: `POST /api/gifts` returning 201 `{ id }`; `GET /api/gifts/:id` returning 200 with the gift JSON. Errors are JSON `{ error }` with status 400, 404, 413, 429 or 503.

- [ ] **Step 1: Write the failing tests** using `exports.default.fetch` and `env` from `cloudflare:workers`:

```ts
const post = (body: unknown, ip = crypto.randomUUID()) => exports.default.fetch('http://x/api/gifts', {
  method: 'POST', headers: { 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const gift = { v: 1, flowers: ['rose'], palette: 0, seed: 1 };

test('creates then fetches a gift', async () => {
  const res = await post(gift);
  expect(res.status).toBe(201);
  const { id } = await res.json();
  expect(id).toMatch(/^[0-9A-Za-z]{7}$/);
  expect(await (await exports.default.fetch(`http://x/api/gifts/${id}`)).json()).toEqual(gift);
});
test('stores with a one-year expiry', async () => {
  const before = Date.now() / 1000;
  const { id } = await (await post(gift)).json();
  const key = (await env.GIFTS.list()).keys.find(k => k.name === id);
  expect(key.expiration).toBeGreaterThanOrEqual(Math.floor(before) + 31536000);
});
test('round trips markup and emoji literally at max length', async () => {
  const g = { ...gift, to: '<b>'.repeat(13), note: '😀'.repeat(140) };
  const { id } = await (await post(g)).json();
  expect(await (await exports.default.fetch(`http://x/api/gifts/${id}`)).json()).toEqual(g);
});
test('accepts the largest valid gift', async () => {
  const big = { ...gift, flowers: Array(5).fill('sunflower'), seed: 4294967295, to: 'é'.repeat(40), from: 'é'.repeat(40), note: '€'.repeat(280), code: { iv: 'a'.repeat(16), ct: 'a'.repeat(364) } };
  expect((await post(big)).status).toBe(201);
});
test('rejects bad JSON, invalid gifts and oversized bodies', async () => {
  expect((await post('{nope')).status).toBe(400);
  expect((await post({ ...gift, palette: 9 })).status).toBe(400);
  expect((await post('x'.repeat(2049))).status).toBe(413);
});
test('returns 404 for unknown and malformed ids and paths', async () => {
  for (const p of ['/api/gifts/AAAAAAA', '/api/gifts/..%2f', '/api/other']) expect((await exports.default.fetch(`http://x${p}`)).status).toBe(404);
});
test('rate limits creation per IP without blocking others', async () => {
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await post(gift, '203.0.113.9')).status);
  expect(statuses).toContain(429);
  expect((await post(gift, '203.0.113.10')).status).toBe(201);
});
```

Run `npm run build` first if the plugin requires `./dist` to exist. If the local rate limiter is not enforced in the test runtime, say so in the task report and test the 429 path by overriding the binding through the plugin's `miniflare` option.

- [ ] **Step 2: Run** `npx vitest run --project worker`. Expected: FAIL.
- [ ] **Step 3: Implement `worker/index.ts`.** `newId()` uses `crypto.getRandomValues` with rejection sampling to avoid bias. Order for POST: rate limit (key `cf-connecting-ip`), read the body as text and reject over 2048 bytes measured with `TextEncoder`, parse, validate, then `GIFTS.put` with `expirationTtl: 31536000`. A KV exception returns 503. Anything else under `/api/` returns 404. The Worker never logs gift contents.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Add `public/_headers`:**

```txt
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
```

- [ ] **Step 6: Verify the headers on a gift route.** Run `npm run build && npx wrangler dev`, then `curl -sI http://localhost:8787/abc1234`. Expected: 200 with the CSP and referrer headers. Cloudflare's docs do not confirm `_headers` applies to the single-page fallback. If the headers are missing, add `/*` handling: list non-asset paths in `run_worker_first`, serve `env.ASSETS.fetch(new URL('/', req.url))` and set the headers in the Worker.
- [ ] **Step 7: Commit** with message `feat: add gift API with validation and rate limiting`.

---

### Task 6: Stage and recipient screen, DESIGN.md

**Files:**
- Create: `DESIGN.md`, `src/styles.css`, `src/ui/stage.ts`, `src/ui/recipient.ts`, `src/ui/copy.ts`, `src/ui/copy.test.ts`
- Modify: `src/main.ts`, `index.html`

**Interfaces:**
- Consumes: `drawBouquet`, `layoutBouquet`, `PALETTES`, `createPainter`, `gridToText`, `decryptCode`, `BLOOM_SECONDS`, `WORLD`.
- Produces, from `stage.ts`: `createStage(canvas: HTMLCanvasElement, look: Pick<Gift, 'flowers' | 'palette' | 'seed'>): { play(onDone?: () => void): void; showFinal(): void; setLook(look): void; text(): string; destroy(): void }`.
- Produces, from `copy.ts`: `greeting(gift: Gift): string`, `describeBouquet(gift: Gift): string`, `signature(gift: Gift): string | null`.
- Produces, from `recipient.ts`: `showRecipient(root: HTMLElement, id: string, key: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests:**

```ts
const g = { v: 1, flowers: ['rose', 'rose', 'daisy'], palette: 0, seed: 1 } as Gift;
test('greets by name or generically', () => {
  expect(greeting({ ...g, to: 'Sam' })).toBe('for Sam');
  expect(greeting(g)).toBe('someone sent you flowers');
  expect(greeting({ ...g, to: '   ' })).toBe('someone sent you flowers');
});
test('describes the bouquet for screen readers', () => expect(describeBouquet(g)).toBe('A bouquet of 2 roses and a daisy.'));
test('signs only when there is a sender', () => {
  expect(signature(g)).toBeNull();
  expect(signature({ ...g, from: 'Alex' })).toBe('from Alex');
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement `copy.ts`.** Plurals: `rose/roses`, `tulip/tulips`, `daisy/daisies`, `sunflower/sunflowers`, `lavender sprig/lavender sprigs`, `cherry blossom/cherry blossoms`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Implement `stage.ts`.** Columns: `min(72, floor(cssWidth / 6))`, with rows from `cellAspect`. Drive with `requestAnimationFrame`, drawing at most 30 frames per second. Time advances only while the tab is visible. After the first 15 drawn frames, if the mean frame cost exceeds 40 ms, rebuild at 48 columns once. Stop requesting frames when progress reaches 1. Pick light or dark colours with `matchMedia('(prefers-color-scheme: dark)')`, and repaint the current frame on change. Repaint on resize after the bloom finishes. `text()` draws the finished bouquet at a fixed 48 columns and returns `gridToText`.
- [ ] **Step 6: Implement `recipient.ts` and routing.** In `main.ts`, path `/` goes to the composer (a placeholder until Task 7), any other path to `showRecipient`. A path that is not 7 base62 characters goes straight to the wilted page without a request.
  - States: loading; `404` shows "these flowers have wilted" with a link to `/`; a network or other failure shows "couldn't reach the flowers" with a retry that keeps the page.
  - Flow: tap prompt, bloom, then fade in the note (`white-space: pre-wrap`) and signature, then the reveal button, then "send flowers back".
  - Reduced motion: skip the prompt and the bloom, and call `showFinal()`.
  - Reveal: `decryptCode`. On `null`, show "this link's gift code is missing part of its key, so ask the sender for the full link". Show a Copy button beside a revealed code.
  - The canvas has `role="img"` and `aria-label` from `describeBouquet`.
- [ ] **Step 7: Write `DESIGN.md`** from the spec's Visual design section and the Global Constraints, and write `src/styles.css` from it. Add the static link-preview tags to `index.html`: title "Someone sent you flowers", description, and `og:image` `https://sendflowrs.com/og.png` (image added in Task 8). Add a footer with a "report a gift" link to `mailto:REPORT_EMAIL_HERE`, which the owner replaces before launch.
- [ ] **Step 8: Check in a browser.** Run `npm run build && npx wrangler dev`, create gifts with `curl`, and check these with the console open: full gift; flowers only; note containing `<img src=x onerror=alert(1)>`; a gift with a code and no `#`; an unknown ID; `/nonsense`; reduced motion; dark mode. Wrap `requestAnimationFrame` with a counter through the browser tool and confirm the count stops rising after the bloom. Expected: no CSP or console errors in any case, and the markup appears literally.
- [ ] **Step 9: Commit** with message `feat: add recipient screen and design system`.

---

### Task 7: Composer and share screen

**Files:**
- Create: `src/ui/composer.ts`, `src/ui/share.ts`, `src/ui/clipboard.ts`, `src/ui/clipboard.test.ts`
- Modify: `src/main.ts`, `src/styles.css`, `package.json` (add `qrcode-generator`)

**Interfaces:**
- Consumes: `createStage`, `validateGift`, `encryptCode`, `SPECIES`, `LIMITS`, `PALETTES`.
- Produces, from `clipboard.ts`: `copyText(text: string, clipboard?: Pick<Clipboard, 'writeText'>): Promise<boolean>`, `buildLink(origin: string, id: string, key?: string): string`.
- Produces: `showComposer(root: HTMLElement): void` from `composer.ts`, `showShare(root: HTMLElement, link: string, bouquetText: string, hasCode: boolean): void` from `share.ts`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('reports clipboard success and failure', async () => {
  expect(await copyText('a', { writeText: async () => {} })).toBe(true);
  expect(await copyText('a', { writeText: async () => { throw new Error('denied'); } })).toBe(false);
  expect(await copyText('a', undefined)).toBe(false);
});
test('builds links with a key only when one exists', () => {
  expect(buildLink('https://sendflowrs.com', 'a8f3k2q')).toBe('https://sendflowrs.com/a8f3k2q');
  expect(buildLink('https://sendflowrs.com', 'a8f3k2q', 'KEY')).toBe('https://sendflowrs.com/a8f3k2q#KEY');
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/ui/clipboard`. Expected: FAIL.
- [ ] **Step 3: Implement `copyText` and `buildLink`** in `src/ui/clipboard.ts`. `copyText` defaults its second argument to `navigator.clipboard` only when `navigator` exists, and returns false when there is no clipboard.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Implement `composer.ts`.** Species buttons add a flower; bouquet chips remove one; add buttons are disabled at 5. Send is disabled at 0. Palette picker has 4 options. Fields use `maxlength` from `LIMITS`. The code field sits under the warning "anyone with the full link can see this code". The stage preview updates live, with a new random seed only on load, so the bouquet does not jump while typing. Blank optional fields are left out of the gift, and text is trimmed. Encrypt, then `POST`. While sending, disable Send. On failure, keep every field and show "that didn't send, so please try again" (or "lots of flowers today, so try again shortly" on 429 or 503).
- [ ] **Step 6: Implement `share.ts`.**
  - The link shows in a read-only input, always visible. If `copyText` returns false, select the input and say "press copy on your keyboard".
  - Native share button only if `navigator.share` exists. Ignore `AbortError`.
  - QR: dynamic `import('qrcode-generator')`, error correction level M, drawn on a canvas with a quiet zone and always dark on white, whatever the theme. PNG download through `toBlob`. The manual chunk must be named so Task 8 can exclude it: `manualChunks: { qr: ['qrcode-generator'] }`.
  - Copy as text copies `bouquetText`, which the composer gets from `stage.text()`.
  - If a gift code was included, repeat the warning here.
- [ ] **Step 7: Check in a browser** under `wrangler dev`: send with everything filled, open the link in a new tab, reveal the code, copy the text, download the QR and decode it (scan with a phone or a decoder), then stop the Worker and press Send to confirm typed text survives. Expected: all work with no CSP or console errors.
- [ ] **Step 8: Commit** with message `feat: add composer and share screen`.

---

### Task 8: Size check, CI, README and launch prep

**Files:**
- Create: `scripts/check-size.mjs`, `.github/workflows/ci.yml`, `README.md`, `public/og.png`, `docs/readme/bloom.gif`
- Modify: `package.json`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write `scripts/check-size.mjs`.** Gzip every `dist/assets/*.js` except files beginning `qr-`, print the total, and exit 1 above 30,000 bytes. Add it as `npm run size`.
- [ ] **Step 2: Run** `npm run build && npm run size`. Expected: passes and prints a total. Temporarily lower the limit to 1 to confirm it exits 1, then restore it.
- [ ] **Step 3: Add `ci.yml`.** On push and pull request, on Node 24: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npm run size`.
- [ ] **Step 4: Create `public/og.png`** at 1200×630 (a paper background with a finished bouquet, captured from the gallery) and `docs/readme/bloom.gif` (a screen recording of one bloom).
- [ ] **Step 5: Write `README.md`:** bloom GIF, live link, what it is, a short how-it-works diagram (vectors → tiny canvas → characters), the security explanation including what the key after `#` does and does not protect, measured size figures, local setup, deploy steps, and licence.
- [ ] **Step 6: Run the full manual pass** from the spec's Testing section at 375 px and desktop widths, in a production build under `wrangler dev`. Fix what it finds using `superpowers:systematic-debugging` if a first fix fails.
- [ ] **Step 7: Run everything.** `npm run typecheck && npm run build && npm test && npm run size`. Expected: all pass.
- [ ] **Step 8: Commit** with message `chore: add CI, size check and README`.
- [ ] **Step 9: Hand over to the owner.** List the launch tasks: run `npx wrangler kv namespace create GIFTS` and put its ID in `wrangler.jsonc`, replace `REPORT_EMAIL_HERE` in the footer, `npx wrangler deploy`, attach the domain, create the GitHub repo, and push. Automatic deploys are added after this first deploy, using a token the owner stores as a repository secret. The Worker must not go live until the report email is in place.
