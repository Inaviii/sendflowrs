import { encryptCode } from '../crypto/code';
import { PALETTES } from '../flowers/palettes';
import { LIMITS, SPECIES, type Gift, type Species } from '../gift/gift';
import { buildLink } from './clipboard';
import { el, reducedMotion } from './dom';
import { showShare } from './share';
import { createStage } from './stage';

const MAX_FLOWERS = 5;

const LABELS: Record<Species, string> = {
  rose: 'rose',
  tulip: 'tulip',
  daisy: 'daisy',
  sunflower: 'sunflower',
  lavender: 'lavender',
  cherry: 'cherry blossom',
};

function field(label: string, control: HTMLInputElement | HTMLTextAreaElement) {
  return el('label', { className: 'field' }, el('span', { className: 'field-label', textContent: label }), control);
}

function swatches(colours: string[]) {
  const row = el('span', { className: 'swatches' });
  row.setAttribute('aria-hidden', 'true');
  for (const colour of colours) {
    const dot = el('span', { className: 'swatch' });
    dot.style.backgroundColor = colour;
    row.append(dot);
  }
  return row;
}

export function showComposer(root: HTMLElement): void {
  const flowers: Species[] = ['rose', 'daisy', 'tulip'];
  let palette = 0;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] as number;
  const look = () => ({ flowers: [...flowers], palette, seed });

  const canvas = el('canvas', { className: 'bouquet' });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Preview of your bouquet');
  const frame = el('div', { className: 'frame' }, canvas);

  const picker = el('div', { className: 'choices' });
  const chips = el('div', { className: 'chips' });
  const status = el('p', { className: 'problem' });
  status.setAttribute('role', 'alert');
  const send = el('button', { className: 'button button-send', type: 'submit', textContent: 'send these flowers' });

  const to = el('input', { type: 'text', maxLength: LIMITS.to, autocomplete: 'off' });
  const from = el('input', { type: 'text', maxLength: LIMITS.from, autocomplete: 'off' });
  const note = el('textarea', { maxLength: LIMITS.note, rows: 4 });
  const code = el('input', { type: 'text', maxLength: LIMITS.code, autocomplete: 'off', spellcheck: false });

  const form = el('form', { className: 'composer', noValidate: true });
  let stage: ReturnType<typeof createStage>;

  function refresh() {
    chips.replaceChildren(
      ...flowers.map((species, index) =>
        el('button', {
          className: 'chip',
          type: 'button',
          textContent: `${LABELS[species]} ×`,
          ariaLabel: `Remove ${LABELS[species]}`,
          onclick: () => {
            flowers.splice(index, 1);
            refresh();
          },
        }),
      ),
    );
    if (flowers.length === 0) {
      chips.append(el('span', { className: 'hint', textContent: 'pick at least one flower' }));
    }
    for (const button of picker.querySelectorAll('button')) button.disabled = flowers.length >= MAX_FLOWERS;
    send.disabled = flowers.length === 0;
    stage?.setLook(look());
  }

  for (const species of SPECIES) {
    picker.append(
      el('button', {
        className: 'choice',
        type: 'button',
        textContent: `+ ${LABELS[species]}`,
        onclick: () => {
          flowers.push(species);
          refresh();
        },
      }),
    );
  }

  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const palettes = el('div', { className: 'choices', role: 'radiogroup', ariaLabel: 'Colours' });
  PALETTES.forEach((entry, index) => {
    const input = el('input', { type: 'radio', name: 'palette', className: 'palette-input', checked: index === 0 });
    input.addEventListener('change', () => {
      palette = index;
      refresh();
    });
    const { petals } = dark ? entry.dark : entry.light;
    palettes.append(el('label', { className: 'palette' }, input, swatches(petals), entry.name));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (flowers.length === 0) return;
    status.textContent = '';
    send.disabled = true;
    send.textContent = 'sending…';

    const gift: Gift = { v: 1, flowers: [...flowers], palette, seed };
    if (to.value.trim()) gift.to = to.value.trim();
    if (from.value.trim()) gift.from = from.value.trim();
    if (note.value.trim()) gift.note = note.value.trim();

    let key: string | undefined;
    let id: string | undefined;
    let failure = "that didn't send, so please try again";
    try {
      if (code.value.trim()) {
        const encrypted = await encryptCode(code.value.trim());
        gift.code = encrypted.payload;
        key = encrypted.key;
      }
      const response = await fetch('/api/gifts', { method: 'POST', body: JSON.stringify(gift) });
      if (response.status === 429 || response.status === 503) failure = 'lots of flowers today, so try again shortly';
      if (response.ok) id = ((await response.json()) as { id: string }).id;
    } catch {
      // Falls through to the message below, keeping everything typed.
    }

    if (!id) {
      status.textContent = failure;
      send.disabled = false;
      send.textContent = 'send these flowers';
      return;
    }
    const bouquetText = stage.text();
    stage.destroy();
    showShare(root, buildLink(location.origin, id, key), bouquetText, Boolean(key));
  });

  form.append(
    el(
      'fieldset',
      { className: 'group' },
      el('legend', { className: 'field-label', textContent: 'flowers, up to five' }),
      picker,
      chips,
    ),
    el('fieldset', { className: 'group' }, el('legend', { className: 'field-label', textContent: 'colours' }), palettes),
    el('div', { className: 'names' }, field('to', to), field('from', from)),
    field('a note', note),
    field('a gift code', code),
    el('p', {
      className: 'hint',
      textContent:
        'Optional. Buy the card elsewhere and paste its code. It is encrypted in your browser, but anyone with the full link can see it.',
    }),
    status,
    send,
  );

  root.replaceChildren(el('h1', { className: 'title', textContent: 'send someone flowers' }), frame, form);
  stage = createStage(canvas, look());
  refresh();
  if (reducedMotion()) stage.showFinal();
  else stage.play();
}
