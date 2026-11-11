import { Link } from "react-router";
import styled from "styled-components";

const BrandLink = styled(Link)`
  display: inline-flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space(2)};
  color: ${({ theme }) => theme.colors.onFelt};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 26px;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: -0.02em;
`;

const Suits = styled.span`
  font-size: 15px;
  letter-spacing: 2px;

  span:nth-child(even) {
    color: ${({ theme }) => theme.colors.accent};
    filter: brightness(1.35);
  }
`;

export function SuitRow() {
  return (
    <Suits aria-hidden="true">
      <span>♠</span>
      <span>♥</span>
      <span>♣</span>
      <span>♦</span>
    </Suits>
  );
}

export function Brand() {
  return (
    <BrandLink to="/">
      Podrida
      <SuitRow />
    </BrandLink>
  );
}
