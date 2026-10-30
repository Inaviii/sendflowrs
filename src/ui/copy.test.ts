import { expect, test } from 'vitest';
import type { Gift } from '../gift/gift';
import { charactersLeft, describeBouquet, greeting, namesFromHash, sendBackHref, signature } from './copy';

const g: Gift = { v: 1, flowers: ['rose', 'rose', 'daisy'], palette: 0, seed: 1 };

test('greets by name or generically', () => {
  expect(greeting({ ...g, to: 'Sam' })).toBe('for Sam');
  expect(greeting(g)).toBe('someone sent you flowers');
  expect(greeting({ ...g, to: '   ' })).toBe('someone sent you flowers');
});

test('describes the bouquet for screen readers', () => {
  expect(describeBouquet(g)).toBe('A bouquet of 2 roses and a daisy.');
  expect(describeBouquet({ ...g, flowers: ['tulip'] })).toBe('A bouquet of a tulip.');
  expect(describeBouquet({ ...g, flowers: ['lavender', 'cherry', 'cherry', 'sunflower'] })).toBe(
    'A bouquet of a lavender sprig, 2 cherry blossoms and a sunflower.',
  );
});

test('signs only when there is a sender', () => {
  expect(signature(g)).toBeNull();
  expect(signature({ ...g, from: '  ' })).toBeNull();
  expect(signature({ ...g, from: 'Alex' })).toBe('from Alex');
});

test('counts down only near the note limit', () => {
  expect(charactersLeft(0, 280)).toBeNull();
  expect(charactersLeft(239, 280)).toBeNull();
  expect(charactersLeft(240, 280)).toBe('40 left');
  expect(charactersLeft(280, 280)).toBe('0 left');
});

test('sending flowers back swaps the names, keeping them out of the server request', () => {
  expect(sendBackHref(g)).toBe('/');
  expect(sendBackHref({ ...g, to: 'Sam', from: ' Alex ' })).toBe('/#to=Alex&from=Sam');
  expect(sendBackHref({ ...g, from: 'Zoë & co' })).toBe('/#to=Zo%C3%AB+%26+co');
});

test('reads names back from the link, within the field limits', () => {
  expect(namesFromHash('')).toEqual({ to: '', from: '' });
  expect(namesFromHash('#to=Alex&from=Sam')).toEqual({ to: 'Alex', from: 'Sam' });
  expect(namesFromHash('#to=Zo%C3%AB+%26+co')).toEqual({ to: 'Zoë & co', from: '' });
  expect(namesFromHash(`#to=${'x'.repeat(50)}`).to).toHaveLength(40);
  expect(namesFromHash('#anything-else')).toEqual({ to: '', from: '' });
});
