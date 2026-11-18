// Checks the game screen's layout for overlaps at every supported window size and player count.
//
//   node --experimental-strip-types scripts/check-game-layout.ts
//
// Exits with 1 if any layout has two areas overlapping, or anything outside the frame.
import { computeLayout, layoutProblems } from "../src/game/layout.ts";

const windows = [
  [1024, 768],
  [1280, 720],
  [1280, 800],
  [1440, 900],
  [1440, 960],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
  [1366, 768],
  [1600, 1200],
];

// The most cards a hand gets, by player count (the longest round).
const maxCards: Record<number, number> = { 2: 26, 3: 17, 4: 13, 5: 10, 6: 8 };

let failures = 0;

windows.forEach(([width, height]) => {
  const frame = { width: width - 40, height: height - 40 };
  const sizes: string[] = [];

  [2, 3, 4, 5, 6].forEach((players) => {
    const layout = computeLayout(frame.width, frame.height, players, maxCards[players], {
      width,
      height,
    });
    const problems = layoutProblems(layout);
    sizes.push(`${players}p ${layout.handCard.w}/${layout.tableCard.w}`);

    if (problems.length > 0) {
      failures += 1;
      console.log(`✗ ${width}×${height}, ${players} players: ${problems.join("; ")}`);
    }

    // The hand row fits with the corner of every card showing.
    const strip =
      (frame.width - 2 * 40 * layout.u - layout.handCard.w) / Math.max(1, maxCards[players] - 1);
    if (strip < layout.handCard.w * 0.3 - 0.5) {
      failures += 1;
      console.log(
        `✗ ${width}×${height}, ${players} players: hand overlap too tight (${strip.toFixed(0)}px)`,
      );
    }
  });

  console.log(
    `${width}×${height}  u=${computeLayout(frame.width, frame.height, 4, 13, { width, height }).u.toFixed(2)}  cards (hand/table): ${sizes.join("  ")}`,
  );
});

console.log(failures === 0 ? "\nNo overlaps." : `\n${failures} problem layouts.`);
process.exit(failures === 0 ? 0 : 1);
