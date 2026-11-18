import type { ReactNode } from "react";
import styled, { keyframes } from "styled-components";
import { Avatar } from "../Avatar";
import { Badge } from "../ui/Badge";

export const SeatGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: ${({ theme }) => theme.space(3)};
  margin: 0;
  padding: 0;
  list-style: none;
`;

// A new seat (a person joining, a bot added) fades in.
const seatIn = keyframes`
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to { opacity: 1; transform: none; }
`;

const SeatBox = styled.li<{ $isEmpty?: boolean; $isAway?: boolean; $isButton?: boolean }>`
  position: relative;
  animation: ${({ $isEmpty }) => ($isEmpty ? "none" : seatIn)} 240ms ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  min-width: 0;
  padding: ${({ theme, $isButton }) => ($isButton ? 0 : `${theme.space(4)} ${theme.space(3)}`)};
  border: 1px ${({ $isEmpty }) => ($isEmpty ? "dashed" : "solid")}
    ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme, $isEmpty }) => ($isEmpty ? "transparent" : theme.colors.surfaceSunken)};
  color: ${({ theme, $isEmpty }) => ($isEmpty ? theme.colors.textMuted : theme.colors.text)};
  text-align: center;

  & > span:first-child {
    opacity: ${({ $isAway }) => ($isAway ? 0.45 : 1)};
    transition: opacity 200ms ease;
  }
`;

const Name = styled.span`
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BotTag = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 400;
`;

const Badges = styled.span`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${({ theme }) => theme.space(1)};
  min-height: 22px;
`;

const EmptyCircle = styled.span`
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 2px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: 50%;
  font-size: 22px;
`;

interface SeatProps {
  username: string;
  avatarUrl?: string;
  isHost?: boolean;
  isYou?: boolean;
  isConnected: boolean;
  isKicked?: boolean;
  isBot?: boolean; // "(Bot)" after the name.
  action?: ReactNode; // Eg. the host's "Kick" button, or a bot's controls.
}

export function Seat({
  username,
  avatarUrl,
  isHost,
  isYou,
  isConnected,
  isKicked,
  isBot,
  action,
}: SeatProps) {
  const isAway = isKicked || !isConnected;

  return (
    <SeatBox $isAway={isAway}>
      <Avatar src={avatarUrl} name={username} size={56} decorative />
      <Name title={isBot ? `${username} (Bot)` : username}>
        {username}
        {isBot && <BotTag> (Bot)</BotTag>}
      </Name>
      <Badges>
        {isHost && <Badge $tone="warning">Host</Badge>}
        {isYou && <Badge $tone="info">You</Badge>}
        {isKicked ? (
          <Badge $tone="danger">Removed</Badge>
        ) : (
          !isConnected && <Badge>Reconnecting…</Badge>
        )}
      </Badges>
      {action}
    </SeatBox>
  );
}

// The host's open seats are buttons: a click opens the add-bot menu (`children`, see BotControls).
const SeatButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  width: 100%;
  height: 100%;
  padding: ${({ theme }) => `${theme.space(4)} ${theme.space(3)}`};
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &:hover,
  &[aria-expanded="true"] {
    color: ${({ theme }) => theme.colors.text};
  }

  &:hover ${EmptyCircle}, &[aria-expanded="true"] ${EmptyCircle} {
    border-color: ${({ theme }) => theme.colors.gold};
    color: ${({ theme }) => theme.colors.gold};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }
`;

interface EmptySeatProps {
  onClick?: () => void; // Makes it a button (the host's).
  isOpen?: boolean;
  children?: ReactNode; // Shown next to it while open.
}

export function EmptySeat({ onClick, isOpen, children }: EmptySeatProps) {
  if (!onClick) {
    return (
      <SeatBox $isEmpty aria-label="Open seat">
        <EmptyCircle aria-hidden>+</EmptyCircle>
        <Name>Open seat</Name>
        <Badges />
      </SeatBox>
    );
  }

  return (
    <SeatBox $isEmpty $isButton>
      <SeatButton type="button" onClick={onClick} aria-expanded={isOpen} aria-haspopup="dialog">
        <EmptyCircle aria-hidden>+</EmptyCircle>
        <Name>Open seat</Name>
        <Badges>
          <BotTag>Add a bot</BotTag>
        </Badges>
      </SeatButton>
      {children}
    </SeatBox>
  );
}
