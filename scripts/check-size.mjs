// Fails the build if the JavaScript every visitor downloads outgrows the budget.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = Number(process.argv[2] ?? 30_000);
const dir = 'dist/assets';
// The QR library loads only on the share screen.
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('qrcode-'));
if (files.length === 0) {
  console.error('No JavaScript in dist/assets. Run the build first.');
  process.exit(1);
}
const total = files.reduce((sum, f) => sum + gzipSync(readFileSync(`${dir}/${f}`)).length, 0);
console.log(`${total} bytes gzipped of ${LIMIT} allowed (${files.join(', ')})`);
if (total > LIMIT) process.exit(1);
