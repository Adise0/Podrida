// Builds the court card figures (J, Q, K × 4 suits) used on the game's cards, from Adrian Kennard's
// (RevK) SVG playing cards: https://codeberg.org/RevK/SVG-playing-cards, designs released under
// CC0 (https://www.me.uk/cards/). See frontend/CREDITS.md.
//
//   node scripts/build-court-art.mjs <folder with JS.svg, QS.svg... from the repo's svg/> [out]
//
// The source files are the author's working files (4-5 MB each, mostly a scanned bitmap used for
// tracing). Like the author's own generator (makecourt.c / makecards.c), this keeps only the named
// layers: four fills (Gold, Red, Blue, Black) and two outlines (Stroke, Thin), recolours them to
// the game's palette, adds the small suit pips held by the figure, and mirrors the half figure to
// make the classic double-headed card. Coordinates are rounded to one decimal.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , sourceDir, outDir = "public/cards/court"] = process.argv;

if (!sourceDir) {
  console.error("Usage: node scripts/build-court-art.mjs <source svg folder> [out folder]");
  process.exit(1);
}

// The game's palette (see src/game/tokens.ts). Outlines go to the card black.
const palette = {
  Gold: "#D8BC7E",
  Red: "#B5402F",
  Blue: "#2E4A6B",
  Black: "#1F2623",
  Stroke: "#1F2623",
  Thin: "#1F2623",
};
const suitColour = { S: "#1F2623", C: "#1F2623", H: "#B5402F", D: "#B5402F" };

// The generator's "new" suit shapes, centred on 0, 800 wide and 1000 high (in a 1200 box).
const suitPath = {
  S: "M0 -500C100 -250 355 -100 355 185A150 150 0 0 1 55 185A10 10 0 0 0 35 185C35 385 85 400 130 500L-130 500C-85 400 -35 385 -35 185A10 10 0 0 0 -55 185A150 150 0 0 1 -355 185C-355 -100 -100 -250 0 -500Z",
  H: "M0 -300C0 -400 100 -500 200 -500C300 -500 400 -400 400 -250C400 0 0 400 0 500C0 400 -400 0 -400 -250C-400 -400 -300 -500 -200 -500C-100 -500 0 -400 -0 -300Z",
  C: "M30 150C35 385 85 400 130 500L-130 500C-85 400 -35 385 -30 150A10 10 0 0 0 -50 150A210 210 0 1 1 -124 -51A10 10 0 0 0 -110 -65A230 230 0 1 1 110 -65A10 10 0 0 0 124 -51A210 210 0 1 1 50 150A10 10 0 0 0 30 150Z",
  D: "M-400 0C-350 0 0 -450 0 -500C0 -450 350 0 400 0C350 0 0 450 0 500C0 450 -350 0 -400 0Z",
};

// The suit pips each figure holds: x, y (from the bottom), size, rotation, as in makecourt.c.
const pips = {
  JS: [
    [910, 1454, 75, 35],
    [845, 1359, 75, 33],
    [780, 1261, 75, 33],
  ],
  QS: [
    [1188, 1065, 90, -40],
    [1194, 957, 90, -40],
    [1096, 967, 90, -40],
    [1022, 1053, 90, -40],
    [918, 1149, 90, -40],
    [897, 1274, 90, -40],
  ],
  KS: [
    [495, 1388, 90, -10],
    [528, 1249, 90, -5],
    [839, 1360, 90, 20],
    [795, 1251, 90, 20],
  ],
  JH: [
    [546, 1000, 100, 0],
    [615, 1000, 100, 180],
    [883, 1224, 75, 30],
    [915, 1289, 75, 30],
    [954, 1354, 75, 30],
    [220, 1367, 75, 60],
    [155, 1272, 75, 60],
    [52, 1272, 75, 60],
    [96, 1175, 75, 60],
  ],
  QH: [
    [967, 812, 75, 30],
    [1013, 933, 75, 15],
    [1041, 1058, 75, 3],
    [1054, 1184, 75, 5],
    [1068, 1301, 75, 10],
  ],
  KH: [
    [988, 1199, 90, 85],
    [958, 1298, 90, 60],
    [975, 1089, 90, 110],
    [922, 997, 90, 130],
  ],
  JC: [
    [504, 1272, 75, 0],
    [504, 1156, 75, 0],
    [826, 1357, 75, 0],
  ],
  QC: [
    [1017, 1099, 90, -45],
    [1125, 1022, 90, -45],
    [1229, 940, 90, -45],
  ],
  KC: [
    [893, 1141, 90, 5],
    [927, 1279, 90, 15],
    [992, 1399, 90, 25],
  ],
  JD: [
    [650, 1000, 200, 0],
    [894, 1402, 50, -26],
    [852, 1377, 50, -22],
    [806, 1361, 50, -14],
    [757, 1350, 50, -6],
    [706, 1345, 50, 0],
    [656, 1347, 50, 5],
    [607, 1353, 50, 10],
    [560, 1363, 50, 15],
  ],
  QD: [
    [650, 1000, 100, 0],
    [580, 995, 100, 0],
    [510, 990, 100, 0],
  ],
  KD: [
    [650, 1000, 120, 0],
    [570, 1000, 120, 0],
    [400, 1360, 170, -15],
    [435, 1235, 150, -10],
    [453, 1115, 130, -5],
    [460, 1018, 110, 0],
    [450, 930, 100, 10],
    [1259, 1000, 90, 60],
    [1173, 948, 90, 50],
    [1094, 880, 90, 40],
    [1038, 791, 90, 30],
  ],
};

// The extra stroke the generator adds to the king of hearts.
const extraStroke = { KH: "M1020,185l-25,30 30,25M975.9082,215H995m-35,25 35,-55v55" };

// The <g> with this Inkscape label, and everything up to its matching </g>.
function layer(svg, label) {
  const start = svg.search(new RegExp(`<g\\b[^>]*inkscape:label="${label}"`));
  if (start === -1) return null;

  const tag = /<\/?g\b[^>]*?(\/?)>/g;
  tag.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tag.exec(svg))) {
    if (match[0].startsWith("</")) depth -= 1;
    else if (!match[1]) depth += 1;
    if (depth === 0) return svg.slice(start, tag.lastIndex);
  }
  throw new Error(`Unclosed layer ${label}`);
}

// One decimal is plenty at 1300 × 2000.
const compact = (d) =>
  d
    .replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (number) => String(Math.round(Number(number) * 10) / 10))
    .replace(/\s*([a-zA-Z])\s*/g, "$1")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .replace(/,-/g, "-")
    .replace(/ -/g, "-");

function layerPaths(svg, label) {
  const group = layer(svg, label);
  if (!group) return [];
  if (
    /<g\b[^>]*inkscape:label="[^"]*"[^>]*\btransform=/.test(group.slice(0, group.indexOf(">") + 1))
  ) {
    throw new Error(`Layer ${label} has a transform, which the art doesn't expect`);
  }
  return [...group.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map((match) => compact(match[1]));
}

mkdirSync(outDir, { recursive: true });
let total = 0;

for (const card of Object.keys(pips)) {
  const svg = readFileSync(join(sourceDir, `${card}.svg`), "utf8");
  const suit = card[1];
  const parts = [];

  for (const [label, colour] of Object.entries(palette)) {
    const paths = layerPaths(svg, label);
    if (label === "Stroke" && extraStroke[card]) paths.push(extraStroke[card]);
    if (paths.length === 0) continue;

    // Each source path is its own element: a path's first "m" is absolute, joining them would
    // change that.
    const body = paths.map((d) => `<path d="${d}"/>`).join("");
    const isOutline = label === "Stroke" || label === "Thin";
    parts.push(
      isOutline
        ? `<g fill="none" stroke="${colour}" stroke-width="${label === "Thin" ? 3 : 6}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
        : `<g fill="${colour}">${body}</g>`,
    );
  }

  // The pips: the generator's 1200-unit suit shape, scaled to the pip's size.
  const pipMarks = pips[card]
    .map(([x, y, size, rotation]) => {
      const scale = Math.round((size / 1200) * 10000) / 10000;
      return `<path transform="translate(${x} ${2000 - y})rotate(${rotation})scale(${scale})" d="${suitPath[suit]}"/>`;
    })
    .join("");
  parts.push(`<g fill="${suitColour[suit]}">${pipMarks}</g>`);

  // Half a figure, and the same turned over: the classic double-headed court card. Stretched to
  // whatever frame the card gives it.
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 2000" preserveAspectRatio="none"><defs><g id="f">${parts.join("")}</g></defs><use href="#f"/><use href="#f" transform="rotate(180 650 1000)"/></svg>\n`;

  writeFileSync(join(outDir, `${card}.svg`), out);
  total += out.length;
  console.log(`${card}.svg  ${(out.length / 1024).toFixed(0)} KB`);
}

console.log(`Total ${(total / 1024).toFixed(0)} KB`);
