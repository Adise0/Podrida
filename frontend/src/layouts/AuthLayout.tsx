import { Outlet } from "react-router";
import styled from "styled-components";
import { Brand } from "../components/Brand";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space(8)};
  min-height: 100vh;
  padding: ${({ theme }) => `${theme.space(12)} ${theme.space(4)} ${theme.space(10)}`};

  ${({ theme }) => theme.media.small} {
    gap: ${({ theme }) => theme.space(6)};
    padding-top: ${({ theme }) => theme.space(8)};
  }
`;

const Content = styled.main`
  width: 100%;
  max-width: 440px;
`;

// Login, register and every page an email link lands on: one card, centred on the table.
export function AuthLayout() {
  return (
    <Page>
      <Brand />
      <Content>
        <Outlet />
      </Content>
    </Page>
  );
}
