import { useEffect, useRef } from "react";
import styled from "styled-components";
import { g } from "../tokens";

const Arrow = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  transition: opacity 250ms ${g.ease};
  will-change: transform;

  svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 0 4px rgba(216, 188, 126, 0.6));
  }
`;

interface Point {
  x: number;
  y: number;
}

interface TurnArrowProps {
  target: Point | null; // The centre of the active seat's turn slot; null: nobody's turn.
  centre: Point; // The table's centre: the arrow points away from it, toward the seat.
  size: number;
}

const duration = 350;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// The gold arrow showing whose turn it is. At rest it sits in that seat's turn slot (a space kept
// empty for it), pointing at the seat. When the turn moves it travels a curve around the table's
// centre to the next slot, drawn above everything while it moves. Nobody's turn: it fades in place.
export function TurnArrow({ target, centre, size }: TurnArrowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const resting = useRef<Point | null>(null);
  const frame = useRef(0);

  // Stops a curve in flight only when the arrow goes away for good.
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const place = ({ x, y }: Point, moving: boolean) => {
      const angle = (Math.atan2(y - centre.y, x - centre.x) * 180) / Math.PI;
      element.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${angle}deg)`;
      element.style.zIndex = moving ? "900" : "5";
      element.dataset.animating = moving ? "true" : "";
    };

    element.style.opacity = target ? "1" : "0";
    if (!target) return;

    const from = resting.current;

    // Already there (or on its way there): an unrelated update leaves it alone.
    if (from && from.x === target.x && from.y === target.y) return;
    resting.current = target;

    if (!from || prefersReducedMotion()) {
      cancelAnimationFrame(frame.current);
      place(target, false);
      return;
    }

    // Around the centre: the angle and the distance change together, the short way round (over
    // the top when both ways are about as long, so it never cuts through the hand).
    const a0 = Math.atan2(from.y - centre.y, from.x - centre.x);
    const r0 = Math.hypot(from.x - centre.x, from.y - centre.y);
    const a1 = Math.atan2(target.y - centre.y, target.x - centre.x);
    const r1 = Math.hypot(target.x - centre.x, target.y - centre.y);
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.sin(a0 + delta / 2) > 0.01 && Math.abs(Math.abs(delta) - Math.PI) < 0.35) {
      delta -= Math.sign(delta || 1) * 2 * Math.PI;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const angle = a0 + delta * eased;
      const radius = r0 + (r1 - r0) * eased;
      const point = {
        x: centre.x + Math.cos(angle) * radius,
        y: centre.y + Math.sin(angle) * radius,
      };
      place(t < 1 ? point : target, t < 1);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
  }, [target, centre.x, centre.y, size]);

  return (
    <Arrow
      ref={ref}
      style={{ width: size, height: size, opacity: 0 }}
      aria-hidden
      data-box="turn arrow"
    >
      {/* Points right; rotated to face the seat. */}
      <svg viewBox="0 0 24 24">
        <path d="M6 4 L20 12 L6 20 L9.5 12 Z" fill={g.gold} />
      </svg>
    </Arrow>
  );
}
