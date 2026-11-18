import type { ButtonHTMLAttributes, ReactNode } from "react";
import styled, { css, keyframes } from "styled-components";
import { API_URL } from "../../api/client";
import { avatarFills, darkControl, fs, g, uu } from "../tokens";

// TOOLTIPS: a dark label under the element, on hover and keyboard focus.

const TooltipHost = styled.span`
  position: relative;
  display: inline-flex;

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    z-index: 50;
    padding: 6px 10px;
    border: 1px solid ${g.controlBorder};
    border-radius: 6px;
    background: rgba(8, 22, 17, 0.96);
    color: ${g.text};
    font-family: ${g.sans};
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -4px);
    transition:
      opacity 150ms ${g.ease},
      transform 150ms ${g.ease};
  }

  &[data-align="right"]::after {
    left: auto;
    right: 0;
    transform: translate(0, -4px);
  }

  &:hover::after,
  &:focus-within::after {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  &[data-align="right"]:hover::after,
  &[data-align="right"]:focus-within::after {
    transform: translate(0, 0);
  }
`;

export function Tooltip({
  text,
  align,
  children,
}: {
  text: string;
  align?: "right";
  children: ReactNode;
}) {
  return (
    <TooltipHost data-tooltip={text} data-align={align}>
      {children}
    </TooltipHost>
  );
}

// BUTTONS

const IconButtonBox = styled.button<{ $active?: boolean }>`
  ${darkControl}
  position: relative;
  display: grid;
  place-items: center;
  width: ${uu(40)};
  height: ${uu(40)};
  padding: 0;
  cursor: pointer;

  svg {
    width: ${uu(20)};
    height: ${uu(20)};
  }
  transition: border-color 150ms ${g.ease};

  &:hover {
    border-color: rgba(255, 255, 255, 0.28);
  }

  ${({ $active }) =>
    $active &&
    css`
      border-color: ${g.gold};
      color: ${g.goldText};
    `}
`;

const Dot = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${g.gold};
  box-shadow: 0 0 6px ${g.gold};
`;

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // The tooltip and the accessible name.
  active?: boolean;
  hasDot?: boolean;
  align?: "right";
}

export function IconButton({ label, active, hasDot, align, children, ...props }: IconButtonProps) {
  return (
    <Tooltip text={label} align={align}>
      <IconButtonBox type="button" aria-label={label} $active={active} {...props}>
        {children}
        {hasDot && <Dot aria-hidden />}
      </IconButtonBox>
    </Tooltip>
  );
}

export const SecondaryButton = styled.button<{ $danger?: boolean }>`
  ${darkControl}
  height: ${uu(42)};
  padding: 0 ${uu(18)};
  font-family: ${g.sans};
  font-size: ${fs(14)};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: rgba(255, 255, 255, 0.28);
  }

  ${({ $danger }) =>
    $danger &&
    css`
      border-color: ${g.danger};
      color: #f0a596;

      &:hover {
        border-color: #e07a65;
      }
    `}
`;

export const Chip = styled.span`
  ${darkControl}
  display: inline-flex;
  align-items: center;
  height: ${uu(20)};
  padding: 0 ${uu(7)};
  border-radius: 6px;
  color: ${g.goldText};
  font-family: ${g.sans};
  font-size: ${fs(11, 11)};
  font-weight: 600;
  white-space: nowrap;
`;

// AVATARS

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px ${g.gold}, 0 0 0 0 rgba(216, 188, 126, 0.55); }
  50% { box-shadow: 0 0 0 2px ${g.gold}, 0 0 8px 4px rgba(216, 188, 126, 0.45); }
`;

const AvatarCircle = styled.span<{
  $size: number;
  $fill: string;
  $ring: AvatarRing;
  $away: boolean;
}>`
  position: relative;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: ${({ $fill }) => $fill};
  color: ${g.text};
  font-family: ${g.serif};
  font-size: ${({ $size }) => Math.round($size * 0.42)}px;
  font-weight: 600;
  line-height: 1;
  opacity: ${({ $away }) => ($away ? 0.4 : 1)};
  transition: opacity 300ms ${g.ease};

  ${({ $ring }) =>
    $ring === "local" &&
    css`
      box-shadow: 0 0 0 2px ${g.gold};
    `}

  ${({ $ring }) =>
    $ring === "active" &&
    css`
      animation: ${pulse} 2s ease-in-out infinite;
    `}

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
`;

export type AvatarRing = "none" | "local" | "active";

interface GameAvatarProps {
  name: string;
  avatarUrl?: string;
  seat: number; // Picks the fill when there's no picture.
  size: number;
  ring?: AvatarRing;
  isAway?: boolean;
}

const initials = (name: string) =>
  name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

// Only the initials (or the picture) and the turn ring: roles go after the name (RolePills).
export function GameAvatar({
  name,
  avatarUrl,
  seat,
  size,
  ring = "none",
  isAway = false,
}: GameAvatarProps) {
  const src = avatarUrl?.startsWith("/") ? `${API_URL}${avatarUrl}` : avatarUrl;

  return (
    <AvatarCircle
      $size={size}
      $fill={avatarFills[seat % avatarFills.length]}
      $ring={ring}
      $away={isAway}
      aria-hidden
    >
      {src ? <img src={src} alt="" draggable={false} /> : initials(name)}
    </AvatarCircle>
  );
}

// ROLES: small pills after a player's name, never on the avatar.

const Pill = styled.span<{ $kind: "dealer" | "leader" }>`
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  min-width: ${uu(18)};
  height: ${uu(18)};
  padding: 0 ${uu(5)};
  border-radius: ${uu(9)};
  font-family: ${g.sans};
  font-size: ${fs(10, 10)};
  font-weight: 700;
  line-height: 1;

  ${({ $kind }) =>
    $kind === "dealer"
      ? css`
          border: 1px solid ${g.controlBorder};
          background: ${g.control};
          color: ${g.goldText};
        `
      : css`
          background: ${g.gold};
          color: ${g.dark};
          font-size: ${fs(8, 8)};
        `}
`;

export function RolePills({ isDealer, isLeader }: { isDealer: boolean; isLeader: boolean }) {
  return (
    <>
      {isDealer && (
        <Tooltip text="Dealer">
          <Pill $kind="dealer" aria-label="Dealer">
            D
          </Pill>
        </Tooltip>
      )}
      {isLeader && (
        <Tooltip text="Leads this trick">
          <Pill $kind="leader" aria-label="Leads this trick">
            ▶
          </Pill>
        </Tooltip>
      )}
    </>
  );
}
