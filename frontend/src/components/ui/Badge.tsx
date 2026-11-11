import styled from "styled-components";

export type BadgeTone = "neutral" | "success" | "danger" | "info" | "warning";

export const Badge = styled.span<{ $tone?: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  padding: 2px ${({ theme }) => theme.space(2)};
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: ${({ theme, $tone = "neutral" }) =>
    ({
      neutral: theme.colors.surfaceSunken,
      success: theme.colors.successSoft,
      danger: theme.colors.dangerSoft,
      info: theme.colors.infoSoft,
      warning: theme.colors.warningSoft,
    })[$tone]};
  color: ${({ theme, $tone = "neutral" }) =>
    ({
      neutral: theme.colors.textMuted,
      success: theme.colors.success,
      danger: theme.colors.danger,
      info: theme.colors.info,
      warning: theme.colors.warning,
    })[$tone]};
`;
