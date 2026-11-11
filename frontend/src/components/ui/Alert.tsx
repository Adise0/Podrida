import type { ReactNode } from "react";
import styled from "styled-components";

export type AlertTone = "info" | "success" | "error" | "warning";

const Box = styled.div<{ $tone: AlertTone }>`
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border-left: 4px solid
    ${({ theme, $tone }) =>
      ({
        info: theme.colors.info,
        success: theme.colors.success,
        error: theme.colors.danger,
        warning: theme.colors.gold,
      })[$tone]};
  background: ${({ theme, $tone }) =>
    ({
      info: theme.colors.infoSoft,
      success: theme.colors.successSoft,
      error: theme.colors.dangerSoft,
      warning: theme.colors.warningSoft,
    })[$tone]};
  color: ${({ theme }) => theme.colors.text};
  font-size: 14px;

  & > * + * {
    margin-top: ${({ theme }) => theme.space(2)};
  }
`;

export function Alert({ tone = "info", children }: { tone?: AlertTone; children: ReactNode }) {
  return (
    <Box $tone={tone} role={tone === "error" ? "alert" : "status"}>
      {children}
    </Box>
  );
}
