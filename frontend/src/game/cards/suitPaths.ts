import type { Suit } from "@podrida/shared";

// The suit shapes of Adrian Kennard's (RevK) SVG playing cards, CC0 (see frontend/CREDITS.md):
// centred on 0, 800 units wide (clubs a little wider) and 1000 high. The court figures use the
// same ones, so every suit on a card looks alike.
export const suitPaths: Record<Suit, string> = {
  spades:
    "M0 -500C100 -250 355 -100 355 185A150 150 0 0 1 55 185A10 10 0 0 0 35 185C35 385 85 400 130 500L-130 500C-85 400 -35 385 -35 185A10 10 0 0 0 -55 185A150 150 0 0 1 -355 185C-355 -100 -100 -250 0 -500Z",
  hearts:
    "M0 -300C0 -400 100 -500 200 -500C300 -500 400 -400 400 -250C400 0 0 400 0 500C0 400 -400 0 -400 -250C-400 -400 -300 -500 -200 -500C-100 -500 0 -400 -0 -300Z",
  clubs:
    "M30 150C35 385 85 400 130 500L-130 500C-85 400 -35 385 -30 150A10 10 0 0 0 -50 150A210 210 0 1 1 -124 -51A10 10 0 0 0 -110 -65A230 230 0 1 1 110 -65A10 10 0 0 0 124 -51A210 210 0 1 1 50 150A10 10 0 0 0 30 150Z",
  diamonds:
    "M-400 0C-350 0 0 -450 0 -500C0 -450 350 0 400 0C350 0 0 450 0 500C0 450 -350 0 -400 0Z",
};

export const suitLetters: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  clubs: "C",
  diamonds: "D",
};
