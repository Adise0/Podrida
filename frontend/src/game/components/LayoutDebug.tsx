import { useEffect, type RefObject } from "react";
import styled from "styled-components";
import { findOverlaps, layoutBoxes, type Box, type GameLayout } from "../layout";

// ?layoutDebug in the URL: outlines every area of the layout and every seat's turn slot, and
// every second checks the elements actually on the page (the ones marked data-box): any two that
// overlap while neither is moving are logged as a warning.

const Outline = styled.div<{ $colour: string }>`
  position: absolute;
  z-index: 2000;
  border: 1px dashed ${({ $colour }) => $colour};
  pointer-events: none;

  span {
    position: absolute;
    left: 2px;
    top: 1px;
    color: ${({ $colour }) => $colour};
    font: 600 10px/1 monospace;
    white-space: nowrap;
  }
`;

const toBox = (rect: DOMRect, origin: DOMRect): Box => ({
  x: rect.left - origin.left,
  y: rect.top - origin.top,
  w: rect.width,
  h: rect.height,
});

// The elements on the page right now, at rest and visible, that aren't inside one another.
function measure(root: HTMLElement): [string, Box][] {
  const origin = root.getBoundingClientRect();
  const elements = [...root.querySelectorAll<HTMLElement>("[data-box]")].filter((element) => {
    if (element.closest("[data-animating='true']")) return false;
    const style = getComputedStyle(element);
    return (
      style.opacity !== "0" && style.visibility !== "hidden" && element.getClientRects().length > 0
    );
  });

  // Nested ones (eg. a seat's parts) share their parent's box: only the outermost counts.
  const outermost = elements.filter(
    (element) => !elements.some((other) => other !== element && other.contains(element)),
  );

  return outermost.map((element) => [
    element.dataset.box ?? "?",
    toBox(element.getBoundingClientRect(), origin),
  ]);
}

export function LayoutDebug({
  layout,
  root,
}: {
  layout: GameLayout;
  root: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    let last = "";
    const check = () => {
      if (!root.current) return;
      const problems = findOverlaps(measure(root.current));
      const key = problems.join("|");
      if (problems.length > 0 && key !== last) {
        console.warn(
          `[layoutDebug] ${problems.length} overlap(s) at ${layout.width}×${layout.height}:`,
          problems,
        );
      }
      last = key;
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [layout, root]);

  const slots = layout.seats.map((seat, index): [string, Box] => [`slot ${index + 1}`, seat.slot]);

  return (
    <>
      {[...layoutBoxes(layout), ...slots, ["my slot", layout.mySlot] as [string, Box]].map(
        ([name, box]) => (
          <Outline
            key={name}
            $colour={name.includes("slot") ? "#ff8" : "#7cf"}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          >
            <span>{name}</span>
          </Outline>
        ),
      )}
    </>
  );
}
