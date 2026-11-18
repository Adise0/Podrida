# Credits

## Playing card court figures and suit shapes

The court card figures (J, Q, K × 4 suits, in `public/cards/court/`) and the suit shapes used for
the pips (`src/game/cards/suitPaths.ts`) come from **Adrian Kennard's (RevK) SVG playing cards**,
based on 19th-century Goodall & Son designs.

- Designs: <https://www.me.uk/cards/>, released by the author under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain). No attribution is
  required, but the author asks for a credit, so here it is: thank you.
- Source: <https://codeberg.org/RevK/SVG-playing-cards>. Note that the repository's own `LICENSE`
  file is GPL v3, which covers its generator code. The artwork is used here under the CC0 grant
  the author states on the designs' page.

The figures were extracted and recoloured to the game's palette with
`scripts/build-court-art.mjs`, which keeps only the drawing layers of the author's source files
(not the scanned reference bitmaps):

```
node scripts/build-court-art.mjs <folder with JS.svg, QS.svg... from the repo's svg/>
```
