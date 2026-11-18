import styled from "styled-components";
import type { Box } from "../layout";
import { fs, g, uu } from "../tokens";
import { BidDots } from "./BidDots";

const Strip = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${uu(12)};
`;

// Plain primary text: no gold, no accent.
const Label = styled.span`
  color: ${g.text};
  font-size: ${fs(14)};
  font-weight: 600;
  white-space: nowrap;
`;

interface OwnBidStripProps {
  box: Box;
  bid: number | null;
  won: number;
  isBidding: boolean; // The local player's turn to bid: the badge pulses.
  flash: "met" | "missed" | null;
}

// The local player's bid, right above their cards (and above the highest a lifted card reaches).
export function OwnBidStrip({ box, bid, won, isBidding, flash }: OwnBidStripProps) {
  return (
    <Strip style={{ left: box.x, top: box.y, width: box.w, height: box.h }} data-box="own bid">
      <Label>Your bid</Label>
      <BidDots bid={bid} won={won} isBidding={isBidding} flash={flash} scale={1.4} />
    </Strip>
  );
}
