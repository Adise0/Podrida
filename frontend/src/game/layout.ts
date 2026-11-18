// The game screen's layout: one pure function from the window size and the table to a box for
// every element. Nothing is placed by hand anywhere else, so one check can prove that nothing
// overlaps (see findOverlaps, the ?layoutDebug overlay, and scripts/check-game-layout.ts).
//
// Top to bottom: the top bar, the table (the opponents on an arc around the centre block), the
// local player's turn slot and bid strip, the hand (with headroom for lifted cards), and the
// bottom bar. Everything is sized from a unit u that follows the window, the cards from the space
// that's left once everything else has its share.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SeatSide = "top" | "left" | "right";

export interface SeatLayout {
  box: Box; // The whole seat, turn slot included.
  content: Box; // Avatar, name, points, card backs, bid dots.
  slot: Box; // The turn arrow's place: on the side facing the centre, always kept empty.
  side: SeatSide;
  angle: number; // On the arc: 180 left, 90 top, 0 right.
}

export interface GameLayout {
  width: number;
  height: number;
  u: number;
  topBar: Box;
  bottomBar: Box;
  bottom: { left: Box; centre: Box; right: Box };
  seats: SeatLayout[]; // The opponents, clockwise from the local player's left.
  centre: Box; // The whole centre block, measured as one unit.
  cardsRow: Box; // Trump and trick, with the name tags under them.
  trump: Box;
  trick: Box; // Fits the biggest trick of this table.
  tagsTop: number;
  lastAction: Box;
  heading: Box;
  hint: Box;
  mySlot: Box;
  bidStrip: Box;
  hand: Box; // Headroom for lifted cards included.
  handCardsTop: number; // Where the cards rest.
  centrePoint: { x: number; y: number }; // The turn arrow curves around it.
  handCard: { w: number; h: number };
  tableCard: { w: number; h: number };
  backCard: { w: number; h: number };
  trickOffset: number;
}

// Sizes, in units of u.
const U = {
  topBar: 72,
  bottomBar: 72,
  barPadding: 24,
  edge: 20, // Seats from the frame's sides.
  tablePad: 10,
  seatWidth: 140,
  seatContent: 154, // Avatar 44, name 18, points 20, card backs 32, bid dots 26, and the gaps.
  slot: 24,
  slotGap: 4,
  seatGapMin: 24, // Between any seat and the centre block (and never under 24px).
  seatSpacing: 16, // Between two seats.
  trumpGap: 40,
  lift: 6, // The winning trick card rises this much.
  tags: 16,
  lastAction: 18,
  heading: 30,
  hint: 18,
  summaryWidth: 400,
  belowCentre: 10,
  bidStrip: 30,
  headroom: 28, // Over the hand: a selected card rises 24.
  handGap: 28, // Between the cards and the bottom bar.
  handSideMargin: 40,
  bottomLeft: 300,
  bottomRight: 340,
  bottomGap: 16,
  maxHandCard: 180,
};

const CARD_RATIO = 1.4; // Height / width.
const TABLE_TO_HAND = 0.86; // Table cards are a bit smaller than the hand's.
const VISIBLE_STRIP = 0.3; // Of an overlapped hand card: the corner index always shows.
const TRICK_OFFSET = 0.38; // Of the table card's width: each trick card's index shows.
const TRICK_OFFSET_MIN = 0.25; // Down to the corner index's width before cards shrink.
const MIN_HAND_CARD = 48;

const anglesByCount: Record<number, number[]> = {
  1: [90],
  2: [135, 45],
  3: [180, 90, 0],
  4: [180, 120, 60, 0],
  5: [180, 135, 90, 45, 0],
};

export const unitFor = (viewportWidth: number, viewportHeight: number) =>
  Math.min(1.6, Math.max(0.8, Math.min(viewportWidth / 1440, viewportHeight / 960)));

const right = (box: Box) => box.x + box.w;
const bottom = (box: Box) => box.y + box.h;

export const overlaps = (a: Box, b: Box) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);

// Every pair of boxes that overlap, by name.
export function findOverlaps(boxes: [string, Box][]): string[] {
  const found: string[] = [];
  boxes.forEach(([nameA, a], index) => {
    boxes.slice(index + 1).forEach(([nameB, b]) => {
      if (overlaps(a, b)) found.push(`${nameA} × ${nameB}`);
    });
  });
  return found;
}

// The boxes that must never overlap: every area of the screen.
export const layoutBoxes = (layout: GameLayout): [string, Box][] => [
  ["topBar", layout.topBar],
  ["bottomBar", layout.bottomBar],
  ...layout.seats.map((seat, index): [string, Box] => [`seat${index + 1}`, seat.box]),
  ["centre", layout.centre],
  ["mySlot", layout.mySlot],
  ["bidStrip", layout.bidStrip],
  ["hand", layout.hand],
];

// Problems with a layout: overlaps, and anything outside the frame.
export function layoutProblems(layout: GameLayout): string[] {
  const boxes = layoutBoxes(layout);
  const outside = boxes
    .filter(
      ([, box]) =>
        box.x < -0.5 ||
        box.y < -0.5 ||
        right(box) > layout.width + 0.5 ||
        bottom(box) > layout.height + 0.5,
    )
    .map(([name]) => `${name} outside the frame`);
  return [...findOverlaps(boxes), ...outside];
}

interface Attempt {
  handCard: number;
  offset: number;
}

function build(
  width: number,
  height: number,
  u: number,
  players: number,
  attempt: Attempt,
  extra: number,
): GameLayout {
  const px = (units: number) => units * u;
  const seatGap = Math.max(24, px(U.seatGapMin));
  const opponents = Math.max(1, players - 1);
  const angles = anglesByCount[opponents] ?? anglesByCount[5];

  const handCard = {
    w: Math.floor(attempt.handCard),
    h: Math.floor(attempt.handCard * CARD_RATIO),
  };
  const tableW = Math.floor(attempt.handCard * TABLE_TO_HAND);
  const tableCard = { w: tableW, h: Math.floor(tableW * CARD_RATIO) };
  const backCard = { w: Math.round(px(22)), h: Math.round(px(32)) };
  const trickOffset = Math.round(tableW * attempt.offset);

  // Leftover height (tall screens, once the cards are as big as they get) goes to spacing.
  const topPad = px(U.tablePad) + extra * 0.3;
  const seatToCentre = seatGap + extra * 0.4;
  const centreToMine = px(U.belowCentre) + extra * 0.3;

  const topBar = { x: 0, y: 0, w: width, h: px(U.topBar) };
  const bottomBar = { x: 0, y: height - px(U.bottomBar), w: width, h: px(U.bottomBar) };

  // The local player's area, from the bottom up.
  const handCardsTop = bottomBar.y - px(U.handGap) - handCard.h;
  const hand = {
    x: px(U.handSideMargin) / 2,
    y: handCardsTop - px(U.headroom),
    w: width - px(U.handSideMargin),
    h: px(U.headroom) + handCard.h,
  };
  const bidStripWidth = Math.min(width - px(U.handSideMargin), px(360));
  const bidStrip = {
    x: (width - bidStripWidth) / 2,
    y: hand.y - px(4) - px(U.bidStrip),
    w: bidStripWidth,
    h: px(U.bidStrip),
  };
  const mySlot = {
    x: width / 2 - px(U.slot) / 2,
    y: bidStrip.y - px(4) - px(U.slot),
    w: px(U.slot),
    h: px(U.slot),
  };

  // The centre block: trump and trick, then the last action, the heading and the hint.
  const topSeatHeight = px(U.seatContent) + px(U.slotGap) + px(U.slot);
  const seatsTop = topBar.h + topPad;
  const centreY = seatsTop + topSeatHeight + seatToCentre;
  const trickWidth = tableW + (players - 1) * trickOffset;
  const cardsWidth = tableW + px(U.trumpGap) + trickWidth;
  const centreWidth = Math.max(cardsWidth, px(U.summaryWidth));
  const cx = width / 2;
  const cardsRowHeight = px(U.lift) + tableCard.h + px(4) + px(U.tags);
  const cardsRow = { x: cx - cardsWidth / 2, y: centreY, w: cardsWidth, h: cardsRowHeight };
  const trump = { x: cardsRow.x, y: centreY + px(U.lift), w: tableW, h: tableCard.h };
  const trick = {
    x: cardsRow.x + tableW + px(U.trumpGap),
    y: centreY + px(U.lift),
    w: trickWidth,
    h: tableCard.h,
  };
  const lastAction = {
    x: cx - centreWidth / 2,
    y: bottom(cardsRow) + px(6),
    w: centreWidth,
    h: px(U.lastAction),
  };
  const heading = { ...lastAction, y: bottom(lastAction) + px(4), h: px(U.heading) };
  const hint = { ...lastAction, y: bottom(heading) + px(2), h: px(U.hint) };
  const centre = { x: cx - centreWidth / 2, y: centreY, w: centreWidth, h: bottom(hint) - centreY };

  // The own area stays anchored to the hand: what's left of the leftover height (centreToMine)
  // ends up between it and the centre block.
  void centreToMine;

  // THE ARC: placed once the centre block's size is known, so it always clears it.
  const sideWidth = px(U.seatWidth) + px(U.slotGap) + px(U.slot);
  const sideHeight = px(U.seatContent);
  const hasSides = angles.includes(180);
  const tableHeight = bottom(centre) - seatsTop;
  const maxReach = width / 2 - px(U.edge) - (hasSides ? sideWidth / 2 : px(U.seatWidth) / 2);

  // The least reach that keeps the top seats apart, and the side seats clear of the centre.
  const topAngles = angles.filter((angle) => angle > 0 && angle < 180).sort((a, b) => b - a);
  let needed = 0;
  topAngles.forEach((angle, index) => {
    if (index === 0) return;
    const spread = Math.abs(
      Math.cos((angle * Math.PI) / 180) - Math.cos((topAngles[index - 1] * Math.PI) / 180),
    );
    needed = Math.max(needed, (px(U.seatWidth) + px(U.seatSpacing)) / spread);
  });
  if (hasSides) needed = Math.max(needed, centreWidth / 2 + seatGap + sideWidth / 2);

  // Wide screens: the extra width spreads the seats, up to an arc 1.8 times as wide as it's high.
  const reach = Math.min(maxReach, Math.max(needed, Math.min(maxReach, (1.8 * tableHeight) / 2)));
  const cardsMid = trump.y + tableCard.h / 2;

  const seats: SeatLayout[] = angles.map((angle) => {
    const cos = Math.cos((angle * Math.PI) / 180);

    if (angle === 180 || angle === 0) {
      const side: SeatSide = angle === 180 ? "left" : "right";
      const x = cx + cos * reach - sideWidth / 2;
      const y = Math.max(cardsMid - sideHeight / 2, seatsTop + topSeatHeight + px(12));
      const box = { x, y, w: sideWidth, h: sideHeight };
      const contentX = side === "left" ? x : x + px(U.slot) + px(U.slotGap);
      const slotX = side === "left" ? x + px(U.seatWidth) + px(U.slotGap) : x;
      return {
        box,
        content: { x: contentX, y, w: px(U.seatWidth), h: sideHeight },
        slot: { x: slotX, y: y + px(22) - px(U.slot) / 2, w: px(U.slot), h: px(U.slot) },
        side,
        angle,
      };
    }

    const x = cx + cos * reach - px(U.seatWidth) / 2;
    const box = { x, y: seatsTop, w: px(U.seatWidth), h: topSeatHeight };
    return {
      box,
      content: { x, y: seatsTop, w: px(U.seatWidth), h: px(U.seatContent) },
      slot: {
        x: x + px(U.seatWidth) / 2 - px(U.slot) / 2,
        y: seatsTop + px(U.seatContent) + px(U.slotGap),
        w: px(U.slot),
        h: px(U.slot),
      },
      side: "top",
      angle,
    };
  });

  // The bottom bar's three columns.
  const barInner = width - 2 * px(U.barPadding);
  const leftW = Math.min(px(U.bottomLeft), barInner * 0.3);
  const rightW = Math.min(px(U.bottomRight), barInner * 0.32);
  const bottomLeft = { x: px(U.barPadding), y: bottomBar.y, w: leftW, h: bottomBar.h };
  const bottomRight = {
    x: width - px(U.barPadding) - rightW,
    y: bottomBar.y,
    w: rightW,
    h: bottomBar.h,
  };
  const bottomCentre = {
    x: right(bottomLeft) + px(U.bottomGap),
    y: bottomBar.y,
    w: bottomRight.x - px(U.bottomGap) - (right(bottomLeft) + px(U.bottomGap)),
    h: bottomBar.h,
  };

  return {
    width,
    height,
    u,
    topBar,
    bottomBar,
    bottom: { left: bottomLeft, centre: bottomCentre, right: bottomRight },
    seats,
    centre,
    cardsRow,
    trump,
    trick,
    tagsTop: trump.y + tableCard.h + px(4),
    lastAction,
    heading,
    hint,
    mySlot,
    bidStrip,
    hand,
    handCardsTop,
    centrePoint: { x: cx, y: cardsMid },
    handCard,
    tableCard,
    backCard,
    trickOffset,
  };
}

// Everything that isn't a card, top to bottom, in units of u.
const fixedHeight =
  U.topBar +
  U.tablePad +
  U.seatContent +
  U.slotGap +
  U.slot +
  U.seatGapMin +
  U.lift +
  4 +
  U.tags +
  6 +
  U.lastAction +
  4 +
  U.heading +
  2 +
  U.hint +
  U.belowCentre +
  U.slot +
  4 +
  U.bidStrip +
  4 +
  U.headroom +
  U.handGap +
  U.bottomBar;

// The card heights, per unit of the hand card's width: the hand's and the table's.
const cardHeights = CARD_RATIO + CARD_RATIO * TABLE_TO_HAND;

// The layout for this window and table. maxCards: the most cards a hand gets in this game, so the
// cards keep one size all game long.
export function computeLayout(
  frameWidth: number,
  frameHeight: number,
  players: number,
  maxCards: number,
  viewport = { width: frameWidth + 40, height: frameHeight + 40 },
): GameLayout {
  const u = unitFor(viewport.width, viewport.height);
  const px = (units: number) => units * u;

  // As big as the height allows, the hand row fits the width, and a cap for huge screens.
  const byHeight = (frameHeight - px(fixedHeight)) / cardHeights;
  const byWidth = (frameWidth - px(U.handSideMargin) * 2) / (1 + (maxCards - 1) * VISIBLE_STRIP);
  let handCard = Math.max(MIN_HAND_CARD, Math.min(byHeight, byWidth, px(U.maxHandCard)));
  let offset = TRICK_OFFSET;

  // Tighten until nothing overlaps: the trick's offsets first, then the cards.
  for (let tries = 0; tries < 60; tries += 1) {
    const extra = Math.max(0, frameHeight - px(fixedHeight) - handCard * cardHeights);
    const layout = build(frameWidth, frameHeight, u, players, { handCard, offset }, extra);

    if (layoutProblems(layout).length === 0 || handCard <= MIN_HAND_CARD) return layout;

    if (offset > TRICK_OFFSET_MIN) offset = Math.max(TRICK_OFFSET_MIN, offset - 0.04);
    else handCard = Math.max(MIN_HAND_CARD, handCard * 0.96);
  }

  return build(frameWidth, frameHeight, u, players, { handCard, offset }, 0);
}

// ?layoutDebug in the URL turns on the overlay that outlines every box (components/LayoutDebug).
export const isLayoutDebug = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("layoutDebug");
