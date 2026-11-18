import type { ReactNode } from "react";
import styled from "styled-components";
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

const SeatBox = styled.li<{ $isEmpty?: boolean; $isAway?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  min-width: 0;
  padding: ${({ theme }) => `${theme.space(4)} ${theme.space(3)}`};
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
  action?: ReactNode; // Eg. the host's "Kick" button.
}

export function Seat({
  username,
  avatarUrl,
  isHost,
  isYou,
  isConnected,
  isKicked,
  action,
}: SeatProps) {
  const isAway = isKicked || !isConnected;

  return (
    <SeatBox $isAway={isAway}>
      <Avatar src={avatarUrl} name={username} size={56} decorative />
      <Name title={username}>{username}</Name>
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

export function EmptySeat() {
  return (
    <SeatBox $isEmpty aria-label="Open seat">
      <EmptyCircle aria-hidden>+</EmptyCircle>
      <Name>Open seat</Name>
      <Badges />
    </SeatBox>
  );
}
