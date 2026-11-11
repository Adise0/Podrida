import type { ButtonHTMLAttributes } from "react";
import styled, { css } from "styled-components";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface StyledProps {
  $variant: ButtonVariant;
  $block: boolean;
  $small: boolean;
}

const variants = {
  primary: css`
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
    border-color: ${({ theme }) => theme.colors.accent};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.accentHover};
      border-color: ${({ theme }) => theme.colors.accentHover};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceSunken};
    }
  `,
  ghost: css`
    background: transparent;
    color: inherit;
    border-color: transparent;

    &:hover:not(:disabled) {
      background: rgba(127, 127, 127, 0.12);
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.danger};
    border-color: ${({ theme }) => theme.colors.danger};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerSoft};
    }
  `,
};

const StyledButton = styled.button<StyledProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space(2)};
  width: ${({ $block }) => ($block ? "100%" : "auto")};
  min-height: ${({ $small }) => ($small ? "34px" : "42px")};
  padding: 0 ${({ theme, $small }) => theme.space($small ? 3 : 4)};
  border: 1px solid;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ $small }) => ($small ? "14px" : "15px")};
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;

  ${({ $variant }) => variants[$variant]}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  small?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  small = false,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <StyledButton
      type={type}
      $variant={variant}
      $block={block}
      $small={small}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner $size={16} />}
      {children}
    </StyledButton>
  );
}
