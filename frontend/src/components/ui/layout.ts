import { Link } from "react-router";
import styled from "styled-components";

export const Stack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $gap = 4 }) => theme.space($gap)};
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean; $justify?: string }>`
  display: flex;
  align-items: center;
  flex-wrap: ${({ $wrap = true }) => ($wrap ? "wrap" : "nowrap")};
  justify-content: ${({ $justify = "flex-start" }) => $justify};
  gap: ${({ theme, $gap = 3 }) => theme.space($gap)};
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(4)};
`;

// Two fields side by side, stacked on phones.
export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space(3)};

  ${({ theme }) => theme.media.small} {
    grid-template-columns: 1fr;
  }
`;

export const TextLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: not-allowed;
  }
`;

export const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
  }
`;

export const Code = styled.code`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surfaceSunken};
  word-break: break-all;
`;
