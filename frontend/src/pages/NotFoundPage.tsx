import styled from "styled-components";
import { Brand } from "../components/Brand";
import { PageTitle } from "../components/PageTitle";
import { Card, CardHeader } from "../components/ui/Card";
import { TextLink } from "../components/ui/layout";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space(8)};
  min-height: 100vh;
  padding: ${({ theme }) => `${theme.space(12)} ${theme.space(4)}`};

  & > section {
    width: 100%;
    max-width: 440px;
  }
`;

export function NotFoundPage() {
  return (
    <Page>
      <PageTitle>Not found</PageTitle>
      <Brand />
      <Card>
        <CardHeader
          as="h1"
          title="That card isn't in the deck"
          description="The page you're looking for doesn't exist."
        />
        <TextLink to="/">Back to the table</TextLink>
      </Card>
    </Page>
  );
}
