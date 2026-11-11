import type { ReactNode } from "react";
import styled from "styled-components";

// The cream "playing card" panel everything sits on.
export const Card = styled.section<{ $padded?: boolean }>`
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border-radius: ${({ theme }) => theme.radii.lg};
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: ${({ theme, $padded = true }) => ($padded ? theme.space(7) : 0)};

  ${({ theme }) => theme.media.small} {
    padding: ${({ theme, $padded = true }) => ($padded ? theme.space(5) : 0)};
  }
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(1.5)};
  margin-bottom: ${({ theme }) => theme.space(5)};
`;

const Title = styled.h2`
  font-size: 22px;
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
`;

export function CardHeader({
  title,
  description,
  as,
}: {
  title: ReactNode;
  description?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Header>
      <Title as={as}>{title}</Title>
      {description && <Description>{description}</Description>}
    </Header>
  );
}

export const MutedText = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
`;
