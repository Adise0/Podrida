import type { ReactNode } from "react";
import styled from "styled-components";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(1.5)};
`;

const Title = styled.h1`
  font-size: 30px;
  color: ${({ theme }) => theme.colors.onFelt};
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.onFeltMuted};
`;

// The title of a page, written on the felt above its cards.
export function PageHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <Wrapper>
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
    </Wrapper>
  );
}
