export type Colours = { petals: string[]; centre: string; stem: string };

export const PALETTES: { name: string; light: Colours; dark: Colours }[] = [
  {
    name: 'rosewater',
    light: { petals: ['#b5342c', '#a8437a', '#b9531c'], centre: '#8f6400', stem: '#4f6b3a' },
    dark: { petals: ['#f08a80', '#e98ac0', '#f2a45f'], centre: '#f0c95a', stem: '#86b56a' },
  },
  {
    name: 'wildflower',
    light: { petals: ['#6b4aa0', '#2f6fa3', '#b03a78'], centre: '#8f6400', stem: '#3f6f50' },
    dark: { petals: ['#b79cf0', '#7fb8ea', '#ee8fc0'], centre: '#f0c95a', stem: '#7fbf95' },
  },
  {
    name: 'sunlit',
    light: { petals: ['#b5560a', '#8f6f00', '#b5342c'], centre: '#5f3d12', stem: '#5a6b2a' },
    dark: { petals: ['#f4a84f', '#ecd05a', '#f08a70'], centre: '#c98d4a', stem: '#a3b860' },
  },
  {
    name: 'dusk',
    light: { petals: ['#3f5a8a', '#7a4a8a', '#8a3f5a'], centre: '#9a5a1a', stem: '#4a6a60' },
    dark: { petals: ['#8fa8dc', '#c49adc', '#dc8fa8'], centre: '#ecc07a', stem: '#80aa9c' },
  },
];
