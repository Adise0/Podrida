import type { GamePlayer } from "@podrida/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import type { GameSettings } from "../settings";
import { darkControl, g, label, panel, uu } from "../tokens";
import { SecondaryButton } from "./primitives";

const appear = keyframes`
  from {
    opacity: 0;
    transform: translateY(calc(-4px * var(--motion, 1)));
  }
`;

// SETTINGS

const Popover = styled.div`
  ${panel}
  position: absolute;
  top: ${uu(70)};
  right: ${uu(76)};
  z-index: 600;
  width: 280px;
  padding: 14px 16px;
  animation: ${appear} ${g.ms(160)} ${g.ease};
`;

const SectionLabel = styled.p`
  ${label}
  margin: 4px 0 8px;
`;

const SettingRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  font-size: 13px;
  cursor: pointer;
`;

const Switch = styled.input`
  appearance: none;
  position: relative;
  flex-shrink: 0;
  width: 34px;
  height: 20px;
  margin: 0;
  border: 1px solid ${g.controlBorder};
  border-radius: 10px;
  background: ${g.control};
  cursor: pointer;
  transition: background ${g.ms(150)} ${g.ease};

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${g.text};
    transition: transform ${g.ms(150)} ${g.ease};
  }

  &:checked {
    border-color: ${g.gold};
    background: ${g.gold};
  }

  &:checked::after {
    background: ${g.dark};
    transform: translateX(14px);
  }
`;

const Segmented = styled.div`
  ${darkControl}
  display: inline-flex;
  padding: 2px;

  button {
    padding: 3px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: ${g.text};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  button[aria-checked="true"] {
    background: ${g.gold};
    color: ${g.dark};
  }
`;

const Separator = styled.hr`
  margin: 10px 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const HostRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  font-size: 13px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const SmallButton = styled(SecondaryButton)`
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
`;

interface SettingsPopoverProps {
  settings: GameSettings;
  onChange: (changes: Partial<GameSettings>) => void;
  onClose: () => void;
  host: {
    players: GamePlayer[];
    onKick: (player: GamePlayer) => void;
    onEndGame: () => void;
  } | null;
}

export function SettingsPopover({ settings, onChange, onClose, host }: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Closes on a click anywhere else, or Esc.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !ref.current?.contains(target) &&
        !(target as Element).closest?.("[data-settings-toggle]")
      )
        onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const toggle = (key: keyof GameSettings, text: string) => (
    <SettingRow>
      {text}
      <Switch
        type="checkbox"
        role="switch"
        checked={Boolean(settings[key])}
        onChange={(event) => onChange({ [key]: event.target.checked })}
      />
    </SettingRow>
  );

  return (
    <Popover ref={ref} role="dialog" aria-label="Settings">
      <SectionLabel>Settings</SectionLabel>
      {toggle("effects", "Sound effects")}
      {toggle("turnChime", "“Your turn” chime")}
      {toggle("doubleClickToPlay", "Double-click to play")}
      <SettingRow as="div">
        Animation speed
        <Segmented role="radiogroup" aria-label="Animation speed">
          <button
            type="button"
            role="radio"
            aria-checked={!settings.fastAnimations}
            onClick={() => onChange({ fastAnimations: false })}
          >
            Normal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.fastAnimations}
            onClick={() => onChange({ fastAnimations: true })}
          >
            Fast
          </button>
        </Segmented>
      </SettingRow>
      {toggle("ruleHints", "Show rule hints")}

      {host && (
        <>
          <Separator />
          <SectionLabel>Host</SectionLabel>
          {host.players.map((player) => (
            <HostRow key={player.userId}>
              <span>{player.username}</span>
              <SmallButton type="button" $danger onClick={() => host.onKick(player)}>
                Kick
              </SmallButton>
            </HostRow>
          ))}
          <HostRow>
            <span>End the game for everyone</span>
            <SmallButton type="button" $danger onClick={host.onEndGame}>
              End game
            </SmallButton>
          </HostRow>
        </>
      )}
    </Popover>
  );
}

// CONFIRMATIONS

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  background: rgba(4, 14, 10, 0.55);
  backdrop-filter: blur(4px);
`;

const Box = styled.div`
  ${panel}
  width: 400px;
  padding: 22px 24px 20px;
  animation: ${appear} ${g.ms(180)} ${g.ease};

  h3 {
    margin: 0 0 8px;
    font-family: ${g.serif};
    font-size: 22px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: ${g.muted};
    font-size: 14px;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
`;

interface ConfirmDialogProps {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  isPending?: boolean;
  error?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  isPending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [onCancel, opener]);

  return createPortal(
    <Backdrop
      className="podrida-game"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <Box role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">{title}</h3>
        <p>{body}</p>
        {error}
        <Actions>
          <SecondaryButton ref={cancelRef} type="button" onClick={onCancel}>
            {cancelLabel}
          </SecondaryButton>
          <SecondaryButton type="button" $danger onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </SecondaryButton>
        </Actions>
      </Box>
    </Backdrop>,
    document.body,
  );
}
