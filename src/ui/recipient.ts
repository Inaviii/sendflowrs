import { decryptCode } from '../crypto/code';
import { validateGift, type Gift } from '../gift/gift';
import { copyText } from './clipboard';
import { describeBouquet, greeting, sendBackHref, signature } from './copy';
import { el, reducedMotion } from './dom';
import { downloadPng } from './share';
import { createStage } from './stage';

const VALID_ID = /^[0-9A-Za-z]{7}$/;

function showWilted(root: HTMLElement) {
  root.replaceChildren(
    el('h1', { className: 'title', textContent: 'these flowers have wilted' }),
    el('p', { className: 'lede', textContent: 'This link has expired or was never planted.' }),
    el('a', { className: 'button', href: '/', textContent: 'send some new ones' }),
  );
}

function showUnreachable(root: HTMLElement, retry: () => void) {
  root.replaceChildren(
    el('h1', { className: 'title', textContent: "couldn't reach the flowers" }),
    el('p', { className: 'lede', textContent: 'Check your connection, then try again.' }),
    el('button', { className: 'button', type: 'button', textContent: 'try again', onclick: retry }),
  );
}

function revealer(gift: Gift, key: string): HTMLElement | null {
  if (!gift.code) return null;
  const payload = gift.code;
  const area = el('div', { className: 'reveal' });
  area.setAttribute('aria-live', 'polite');
  const button = el('button', {
    className: 'button',
    type: 'button',
    textContent: 'reveal your gift code',
    onclick: async () => {
      const code = await decryptCode(payload, key);
      if (code === null) {
        area.replaceChildren(
          el('p', {
            className: 'problem',
            textContent: "This link's gift code is missing part of its key, so ask the sender for the full link.",
          }),
        );
        return;
      }
      const copy = el('button', {
        className: 'quiet-link link-button',
        type: 'button',
        textContent: 'copy code',
        onclick: async () => {
          copy.textContent = (await copyText(code)) ? 'copied' : 'select the code above to copy it';
        },
      });
      area.replaceChildren(el('output', { className: 'code', textContent: code }), copy);
    },
  });
  area.append(button);
  return area;
}

// shortcut: the note is left out because wrapping long text on a canvas is fiddly, add it if people ask.
function keepsake(bouquet: HTMLCanvasElement, title: string): HTMLCanvasElement {
  const styles = getComputedStyle(document.documentElement);
  const margin = Math.round(bouquet.width * 0.08);
  const heading = Math.round(bouquet.width * 0.14);
  const image = el('canvas', { width: bouquet.width + margin * 2, height: bouquet.height + heading + margin * 2 });
  const g = image.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = styles.getPropertyValue('--paper');
  g.fillRect(0, 0, image.width, image.height);
  g.drawImage(bouquet, margin, margin + heading);
  g.fillStyle = styles.getPropertyValue('--ink');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = Math.round(heading * 0.5);
  g.font = `italic ${size}px Georgia, serif`;
  // Long names shrink to fit rather than running off the image.
  const fit = Math.min(1, bouquet.width / g.measureText(title).width);
  g.font = `italic ${Math.floor(size * fit)}px Georgia, serif`;
  g.fillText(title, image.width / 2, margin + heading / 2);
  return image;
}

function showGift(root: HTMLElement, gift: Gift, key: string) {
  document.title = 'Someone sent you flowers';
  let stage: ReturnType<typeof createStage>;
  const motion = !reducedMotion();
  const canvas = el('canvas', { className: 'bouquet' });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', describeBouquet(gift));

  const letter = el('div', { className: 'letter' });
  if (gift.note?.trim()) letter.append(el('p', { className: 'note', dir: 'auto', textContent: gift.note.trim() }));
  const signed = signature(gift);
  if (signed) letter.append(el('p', { className: 'signature', dir: 'auto', textContent: signed }));
  const reveal = revealer(gift, key);
  if (reveal) letter.append(reveal);
  const keep = el('div', { className: 'keep-actions' });
  if (motion) {
    keep.append(el('button', { className: 'button', type: 'button', textContent: 'watch again', onclick: () => stage.play() }));
  }
  keep.append(
    el('button', {
      className: 'button',
      type: 'button',
      textContent: 'save this bouquet',
      onclick: () => {
        stage.showFinal();
        downloadPng(keepsake(canvas, greeting(gift)), 'sendflowrs-bouquet.png');
      },
    }),
  );
  letter.append(keep, el('a', { className: 'quiet-link', href: sendBackHref(gift), textContent: 'send flowers back' }));

  const heading = el('h1', { className: 'title', dir: 'auto', textContent: greeting(gift) });
  const frame = el('div', { className: 'frame' }, canvas);

  if (!motion) {
    root.replaceChildren(heading, frame, letter);
    stage = createStage(canvas, gift);
    stage.showFinal();
    return;
  }

  const open = el('button', {
    className: 'button',
    type: 'button',
    textContent: 'open your flowers',
    onclick: () => {
      open.remove();
      frame.hidden = false;
      stage = createStage(canvas, gift);
      stage.play(() => {
        letter.hidden = false;
        letter.classList.add('arrive');
      });
    },
  });
  frame.hidden = true;
  letter.hidden = true;
  root.replaceChildren(heading, open, frame, letter);
}

export async function showRecipient(root: HTMLElement, id: string, key: string): Promise<void> {
  if (!VALID_ID.test(id)) return showWilted(root);
  root.replaceChildren(el('p', { className: 'lede', textContent: 'gathering your flowers…' }));

  let response: Response;
  try {
    response = await fetch(`/api/gifts/${id}`);
  } catch {
    return showUnreachable(root, () => void showRecipient(root, id, key));
  }
  if (response.status === 404) return showWilted(root);
  const result = response.ok ? validateGift(await response.json().catch(() => null)) : null;
  if (!result?.ok) return showUnreachable(root, () => void showRecipient(root, id, key));
  showGift(root, result.gift, key);
}
