import { useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { dismissNotification } from "../stores/notifications/actions";
import type { Notification } from "../stores/notifications/reducer";
import { useNotifications } from "../stores/notifications/store";

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
`;

const Region = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.space(4)};
  bottom: ${({ theme }) => theme.space(4)};
  left: ${({ theme }) => theme.space(4)};
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space(2)};
  pointer-events: none;
`;

const Toast = styled.div<{ $tone: Notification["tone"] }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space(3)};
  width: 100%;
  max-width: 380px;
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border-left: 4px solid
    ${({ theme, $tone }) =>
      ({ info: theme.colors.info, success: theme.colors.success, error: theme.colors.danger })[
        $tone
      ]};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: ${({ theme }) => theme.shadows.card};
  font-size: 14px;
  pointer-events: auto;
  animation: ${slideIn} 160ms ease-out;

  p {
    flex: 1;
  }
`;

const Close = styled.button`
  padding: 0 4px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
`;

function ToastItem({ notification }: { notification: Notification }) {
  const { id, tone, message } = notification;

  useEffect(() => {
    const timer = setTimeout(() => dismissNotification(id), tone === "error" ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [id, tone]);

  return (
    <Toast $tone={tone} role={tone === "error" ? "alert" : "status"}>
      <p>{message}</p>
      <Close type="button" aria-label="Dismiss" onClick={() => dismissNotification(id)}>
        ×
      </Close>
    </Toast>
  );
}

export function Toaster() {
  const { items } = useNotifications();

  return (
    <Region aria-live="polite">
      {items.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </Region>
  );
}
