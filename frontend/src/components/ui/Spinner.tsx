import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.span.attrs({ role: "status", "aria-label": "Loading" })<{
  $size?: number;
}>`
  display: inline-block;
  flex-shrink: 0;
  width: ${({ $size = 20 }) => $size}px;
  height: ${({ $size = 20 }) => $size}px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 700ms linear infinite;
`;

const FullPage = styled.div`
  display: grid;
  place-items: center;
  min-height: 100vh;
  color: ${({ theme }) => theme.colors.onFeltMuted};
`;

export function FullPageSpinner() {
  return (
    <FullPage>
      <Spinner $size={32} />
    </FullPage>
  );
}
