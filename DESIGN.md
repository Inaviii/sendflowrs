# Design: letter paper

The site is a card in the post. The flowers are the only colour and the only spectacle; everything around them is paper and ink.

## Colour

| Token | Light | Dark ("by lamplight") |
|---|---|---|
| `--paper` | `#f7f0e3` | `#1f1a16` |
| `--ink` | `#3a2f26` | `#e9dfd0` |
| `--ink-soft` | `#6b5c4e` | `#b5a897` |
| `--rule` | `#d9cdb8` | `#453a30` |
| `--problem` | `#9c2f27` | `#f0998f` |

Dark mode follows the device setting. It is the same design with different colours. Flower palettes live in `src/flowers/palettes.ts`, each with light and dark sets at 3:1 contrast or better against the paper.

## Type

- **Serif** (`Georgia, 'Times New Roman', serif`) for all text. Titles are italic at regular weight, like a handwritten salutation.
- **Mono** (`ui-monospace, Consolas, Menlo, monospace`) only for the flowers and gift codes, which really are character data.
- No font downloads, by project constraint.

## Layout

One centred column, at most 34rem wide with a 1rem gutter, phone first. No cards or panels: content sits directly on the paper, separated by space and hairline rules. The composer is the one exception: its bouquet preview stays in view, as a small sticky picture on phones and a sticky left column from 52rem up.

## Controls

Outlined rectangles with a 2px radius that fill with ink on hover. There is no accent colour. Focus rings, selection and scrollbars all use paper and ink.

## Flowers

Dense filled characters from the ramp ` .:-=+*o#%@`, with petals separated by lighter, darker-toned rims. Line-art glyphs (`/ \ | -`) were tried and rejected by the owner.

## Motion

There is one authored moment: the 6-second bloom, where flowers open as they grow. The letter then arrives once with a short fade. In the composer, adding a flower or shuffling replays a 1.5-second bloom. Nothing else animates beyond small hover colour changes, and reduced motion shows the finished bouquet at once.
