export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  try {
    if (!clipboard) return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const buildLink = (origin: string, id: string, key?: string): string =>
  `${origin}/${id}${key ? `#${key}` : ''}`;
