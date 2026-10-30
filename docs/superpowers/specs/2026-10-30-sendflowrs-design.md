# sendflowrs: design

A small website for sending someone a bouquet of animated ASCII-art flowers that bloom when they open the link. Live at `sendflowrs.com`.

## Goals

- It feels personal and cute: a sender can make a gift in under a minute, and a recipient needs nothing but the link.
- It is lightweight: small download, no work done once the bloom has finished.
- Sharing is easy: link, native share sheet, QR code, and plain text.
- It works as a public portfolio project: live URL, clear README, real tests, tidy history.

## Out of scope for the first version

Accounts, scheduled delivery, sending email from the site, read receipts, drag-and-drop bouquet arranging, sound, analytics, selling gift cards or handling payments, and attaching arbitrary links.

## Experience

### Sender

1. Picks 1 to 5 flowers from 6 species: rose, tulip, daisy, sunflower, lavender, cherry blossom. The same species can be picked more than once.
2. Picks one of 4 colour palettes. The bouquet is arranged automatically and previewed live.
3. Optionally adds To (up to 40 characters), From (up to 40), a note (up to 280), and a gift code (up to 64).
4. Presses Send and reaches the share screen.

The composer states that anyone with the full link can see the gift code. If sending fails, everything typed is kept and a retry is offered.

### Share screen

- Copy link.
- Native share sheet through the Web Share API, shown only where the browser supports it.
- QR code generated in the browser, with PNG download. The QR library loads only on this screen.
- Copy as text: the finished bouquet as plain ASCII.

Every page carries the same static link-preview image and the title "Someone sent you flowers". Previews never include gift content.

### Recipient

1. Opens the link and sees "for Sam" (or a generic line if there is no To name) with a prompt to tap.
2. The bouquet grows and blooms over about 6 seconds, then the render loop stops.
3. The note fades in, followed by a "tap to reveal" button if there is a gift code.
4. A "send flowers back" link opens the composer.

With reduced motion turned on, the finished bouquet appears immediately. Screen readers get a text description of the bouquet, and the note is real page text.

### Error states

- Unknown or expired link: a "these flowers have wilted" page with a link to the composer.
- Missing or damaged key after `#`: the bouquet and note still show, and only the code reveal explains the problem.
- Storage or rate limit reached when sending: a friendly "try again shortly" message, keeping what was typed.

## Rendering

Vector petals are drawn to a small offscreen canvas where one pixel is one character cell, with the drawing squashed vertically to allow for cells being taller than wide. Each pixel's alpha picks a character from a density ramp and its colour sets the character's colour. Characters are drawn to the visible canvas from a pre-rendered glyph atlas, so per-frame text drawing stays cheap.

- Grid of at most about 100×60 cells, at up to 30 frames per second.
- The loop stops when the bloom ends and pauses while the tab is hidden.
- If frames run long, the grid drops to a coarser size rather than stuttering.
- A given gift (flowers, palette, seed) always produces the same bouquet.
- The plain-text export uses the same character grid, without colour.

## Architecture

Vite and plain TypeScript with no UI framework. One Cloudflare Worker serves both static assets and the API, with Workers KV for storage. The only runtime dependency is a small QR library, loaded on demand.

| Unit | Job | Depends on |
|---|---|---|
| `src/flowers/` | Vector shapes for each species, drawn at bloom progress 0 to 1; seeded bouquet layout | Canvas API only |
| `src/ascii/` | Converts the small canvas to a coloured character grid; plain-text export | Canvas API only |
| `src/gift/` | Gift type and validation, shared by browser and Worker | Nothing |
| `src/crypto/` | Encrypts and decrypts the gift code | Web Crypto |
| `src/ui/` | Composer, share and recipient screens | All of the above |
| `worker/` | API routes, rate limiting, storage | `src/gift/`, KV |

### Gift format

```json
{
  "v": 1,
  "flowers": ["rose", "daisy"],
  "palette": 2,
  "seed": 48213,
  "to": "Sam",
  "from": "Alex",
  "note": "Happy birthday.",
  "code": { "iv": "...", "ct": "..." }
}
```

`to`, `from`, `note` and `code` are optional. `v` lets the format change without breaking old links.

### Routes

- `POST /api/gifts`: validates the body, stores the gift with a 1-year expiry, returns `{ "id": "a8f3k2q" }`.
- `GET /api/gifts/:id`: returns the gift, or 404.
- `GET /:id` (7 base62 characters): serves the app, which then fetches the gift.

Unknown API paths return 404. A KV write failure returns 503.

### Storage

KV key: the gift ID. Value: the gift JSON. Expiry: 31,536,000 seconds. Gift IDs are 7 characters from `crypto.getRandomValues`, about 41 bits, so collisions are negligible at this volume.

Cloudflare's free tier allows 100,000 KV reads and 1,000 writes to different keys per day, and 1 GB of storage. Exceeding 1,000 gifts a day would fail sends until the daily reset, which the error state above covers. Moving to the paid plan is the fix if that ever happens.

## Security and abuse

- **Gift codes:** encrypted in the browser with AES-GCM and a random 128-bit key. The key is base64url-encoded after the `#` in the link (`sendflowrs.com/a8f3k2q#key`), which browsers do not send to the server. The server stores only `iv` and `ct`. A database leak exposes no codes; anyone holding the full link can read the code, and the composer says so.
- **No fragment, no key:** links for gifts with no code have no `#` part.
- **Notes:** stored unencrypted, inserted only as text (`textContent`), and links in them are not clickable.
- **Validation:** the Worker rejects a body over 2 KB, unknown species, palette outside 0 to 3, a seed that is not an unsigned 32-bit integer, over-length fields, unknown fields, and a gift code ciphertext too large for a 64-character code.
- **Rate limiting:** `POST /api/gifts` is limited to 10 per 60 seconds per IP using the Workers rate limiting binding. Cloudflare documents this binding as approximate and warns that IP keys can catch people sharing an address. With no accounts there is no better key, so the limit is set well above normal human use. It is a brake on abuse, not a guarantee.
- **Headers:** a strict Content-Security-Policy allowing only same-origin scripts, plus `Referrer-Policy: no-referrer`.
- **Takedown:** the footer lists a report email address. A reported gift is removed by deleting its KV key. The address must be chosen before launch.

## Visual design

`DESIGN.md` in the repo root is the source of truth, written during the build from these decisions:

- **Direction:** "letter paper", quiet and heartfelt, like a card in the post.
- **Light mode:** warm cream paper, brown-black ink, muted flower colours.
- **Dark mode:** follows the device setting with a dim, warm "letter by lamplight" palette. Same design, different colours.
- **Type:** system serif for text, system monospace for flowers. No font downloads.
- **Layout:** one centred column, phone first, shared by all screens.
- **Palettes:** 4 flower colour sets, checked for contrast on both backgrounds.

## Efficiency targets

- Recipient page under 30 KB of gzipped JavaScript, excluding the on-demand QR library. A build script fails over this limit.
- No frames drawn after the bloom ends.

## Testing

**Vitest unit tests**

- Brightness-to-character mapping and plain-text export.
- Gift validation, including bad and oversized input.
- Encryption round trip, and clean failure with the wrong or missing key.
- Bouquet layout is stable for a given seed.

**Worker tests** on Cloudflare's local test runtime (`@cloudflare/vitest-pool-workers`): create, fetch, 404, rejected input, and rate limiting.

**One manual browser run before launch**, at phone and desktop sizes: compose, send, open the link, watch the bloom, reveal the code, scan the QR code, and check reduced motion and dark mode.

## Shipping

- GitHub Actions runs type checks, tests, the build and the size limit on every push.
- The first deploy is done by the project owner, as it needs their Cloudflare account and the `sendflowrs.com` domain. Automatic deploys from `main` are then set up using a token the owner adds as a repository secret.
- The README has a bloom GIF, the live link, a short "how it works" diagram, the security explanation, and size figures measured from the real build.
- Licence: MIT.

## Before launch

Owner tasks: register `sendflowrs.com`, create the Cloudflare account and KV namespace, choose the report email address, and create the public GitHub repository.
