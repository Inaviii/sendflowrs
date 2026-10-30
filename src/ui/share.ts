import { copyText } from './clipboard';
import { el } from './dom';

const QR_SCALE = 8;
const QR_QUIET_MODULES = 4;

async function drawQr(canvas: HTMLCanvasElement, link: string) {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const modules = qr.getModuleCount();
  const size = (modules + QR_QUIET_MODULES * 2) * QR_SCALE;
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  // Always dark on white, whatever the theme, so every scanner can read it.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.isDark(y, x)) {
        g.fillRect((x + QR_QUIET_MODULES) * QR_SCALE, (y + QR_QUIET_MODULES) * QR_SCALE, QR_SCALE, QR_SCALE);
      }
    }
  }
}

export function downloadPng(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: 'sendflowrs-qr.png' });
    document.body.append(link);
    link.click();
    // Some browsers abort the download if the URL is revoked straight away.
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  });
}

export function showShare(root: HTMLElement, link: string, bouquetText: string, hasCode: boolean): void {
  const status = el('p', { className: 'lede share-status' });
  status.setAttribute('role', 'status');

  const linkBox = el('input', { className: 'link-box', type: 'text', readOnly: true, value: link, ariaLabel: 'Your link' });
  linkBox.addEventListener('focus', () => linkBox.select());

  const textFallback = el('pre', { className: 'text-bouquet', textContent: bouquetText, hidden: true });

  const actions = el(
    'div',
    { className: 'share-actions' },
    el('button', {
      className: 'button button-send',
      type: 'button',
      textContent: 'copy link',
      onclick: async () => {
        if (await copyText(link)) {
          status.textContent = 'link copied';
        } else {
          linkBox.focus();
          linkBox.select();
          status.textContent = 'press copy on your keyboard';
        }
      },
    }),
  );

  if ('share' in navigator) {
    actions.append(
      el('button', {
        className: 'button',
        type: 'button',
        textContent: 'share…',
        onclick: async () => {
          try {
            await navigator.share({ title: 'Someone sent you flowers', url: link });
          } catch (error) {
            if ((error as Error).name !== 'AbortError') status.textContent = "couldn't open sharing, so copy the link instead";
          }
        },
      }),
    );
  }

  actions.append(
    el('button', {
      className: 'button',
      type: 'button',
      textContent: 'copy as text',
      onclick: async () => {
        if (await copyText(bouquetText)) {
          status.textContent = 'bouquet copied';
        } else {
          textFallback.hidden = false;
          status.textContent = 'select the bouquet below and copy it';
        }
      },
    }),
  );

  const qrCanvas = el('canvas', { className: 'qr' });
  qrCanvas.setAttribute('role', 'img');
  qrCanvas.setAttribute('aria-label', 'QR code for your link');
  const qrArea = el(
    'div',
    { className: 'qr-area' },
    qrCanvas,
    el('button', {
      className: 'quiet-link link-button',
      type: 'button',
      textContent: 'download QR code',
      onclick: () => downloadPng(qrCanvas),
    }),
  );
  drawQr(qrCanvas, link).catch(() => {
    qrArea.replaceChildren(el('p', { className: 'lede', textContent: "couldn't draw the QR code, but the link still works" }));
  });

  root.replaceChildren(
    el('h1', { className: 'title', textContent: 'your flowers are ready' }),
    linkBox,
    actions,
    status,
    ...(hasCode
      ? [el('p', { className: 'hint', textContent: 'This link includes the gift code, so anyone with the full link can see it.' })]
      : []),
    qrArea,
    textFallback,
    el('a', { className: 'quiet-link', href: '/', textContent: 'send another bouquet' }),
  );
}
