import type { CodePayload } from '../gift/gift';

const AES = 'AES-GCM';

function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encryptCode(code: string): Promise<{ payload: CodePayload; key: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey('raw', raw, AES, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: AES, iv }, cryptoKey, new TextEncoder().encode(code));
  return {
    payload: { iv: toBase64url(iv), ct: toBase64url(new Uint8Array(ct)) },
    key: toBase64url(raw),
  };
}

export async function decryptCode(payload: CodePayload, key: string): Promise<string | null> {
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', fromBase64url(key), AES, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: AES, iv: fromBase64url(payload.iv) },
      cryptoKey,
      fromBase64url(payload.ct),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null; // a missing or damaged key is expected when chat apps mangle links
  }
}
