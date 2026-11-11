import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { Button, type ButtonVariant } from "./Button";
import { MutedText } from "./Card";
import { Row, Stack } from "./layout";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.space(4)};
  background: rgba(5, 20, 15, 0.6);
  overflow-y: auto;
`;

const Dialog = styled.div`
  width: 100%;
  max-width: 440px;
  padding: ${({ theme }) => theme.space(6)};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Title = styled.h2`
  font-size: 20px;
  margin-bottom: ${({ theme }) => theme.space(4)};
`;

interface ModalProps {
  isOpen: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ isOpen, title, onClose, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // Only on open/close: focusing the first field on every render would steal the focus.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstField = dialogRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    firstField?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <Overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <Title id={titleId}>{title}</Title>
        {children}
      </Dialog>
    </Overlay>,
    document.body,
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  isPending?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode; // Extra content, eg. a "type the username" field.
  confirmDisabled?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  body,
  confirmLabel,
  variant = "primary",
  isPending = false,
  error,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={isPending ? () => {} : onCancel}>
      <Stack>
        <MutedText as="div">{body}</MutedText>
        {children}
        {error}
        <Row $justify="flex-end">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            loading={isPending}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </Row>
      </Stack>
    </Modal>
  );
}
