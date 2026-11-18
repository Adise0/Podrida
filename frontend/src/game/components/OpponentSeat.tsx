import type { GamePlayer } from "@podrida/shared";
import styled from "styled-components";
import { CardBack } from "../cards/PlayingCard";
import type { Box } from "../layout";
import { fs, g, uu } from "../tokens";
import { BidDots } from "./BidDots";
import { Chip, GameAvatar, RolePills } from "./primitives";

// Everything inside the seat's content box (see layout.ts): avatar 44, name 18, points 20, card
// backs 32 and bid dots 26, in units of u.
const Block = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${uu(4)};
  text-align: center;
`;

const NameLine = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${uu(5)};
  max-width: 100%;
  height: ${uu(18)};
`;

const Name = styled.span<{ $active: boolean }>`
  min-width: 0;
  overflow: hidden;
  color: ${({ $active }) => ($active ? g.goldText : g.text)};
  font-size: ${fs(13)};
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color ${g.ms(300)} ${g.ease};
`;

const Meta = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${uu(6)};
  height: ${uu(20)};
  color: ${g.muted};
  font-size: ${fs(12, 11)};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  b {
    font-weight: 500;
  }

  b[data-negative="true"] {
    color: ${g.danger};
  }
`;

const Backs = styled.span<{ $height: number }>`
  display: flex;
  height: ${({ $height }) => $height}px;

  & > * + * {
    margin-left: -55%;
  }
`;

const Dots = styled.span`
  display: flex;
  align-items: flex-start;
  height: ${uu(26)};
`;

interface OpponentSeatProps {
  player: GamePlayer;
  seat: number;
  box: Box; // The seat's content box.
  u: number;
  back: { w: number; h: number };
  points: number;
  hasCards: boolean;
  bid: number | null;
  won: number;
  activity: "Bidding…" | "Playing…" | null;
  isDealer: boolean;
  isLeader: boolean;
  flash: "met" | "missed" | null;
}

export function OpponentSeat({
  player,
  seat,
  box,
  u,
  back,
  points,
  hasCards,
  bid,
  won,
  activity,
  isDealer,
  isLeader,
  flash,
}: OpponentSeatProps) {
  const isAway = !player.isConnected && !player.isKicked;

  return (
    <Block
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      data-box={`seat ${player.username}`}
    >
      <GameAvatar
        name={player.username}
        avatarUrl={player.avatarUrl}
        seat={seat}
        size={44 * u}
        ring={activity ? "active" : "none"}
        isAway={isAway || player.isKicked}
      />
      <NameLine>
        <Name $active={Boolean(activity)} title={player.username}>
          {player.username}
        </Name>
        <RolePills isDealer={isDealer} isLeader={isLeader} />
      </NameLine>
      <Meta>
        {player.isKicked ? (
          "Removed · plays itself"
        ) : isAway ? (
          "Reconnecting…"
        ) : (
          <b data-negative={points < 0}>{points} pts</b>
        )}
        {activity && <Chip>{activity}</Chip>}
      </Meta>
      <Backs $height={back.h} aria-hidden>
        {hasCards &&
          [0, 1, 2].map((index) => <CardBack key={index} width={back.w} height={back.h} />)}
      </Backs>
      <Dots>
        <BidDots bid={bid} won={won} isBidding={activity === "Bidding…"} flash={flash} />
      </Dots>
    </Block>
  );
}
