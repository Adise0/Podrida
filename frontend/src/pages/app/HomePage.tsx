import styled from "styled-components";
import { PageTitle } from "../../components/PageTitle";
import { SuitRow } from "../../components/Brand";
import { Card, CardHeader } from "../../components/ui/Card";
import { Stack } from "../../components/ui/layout";
import { useUser } from "../../stores/user/store";

const Greeting = styled.h1`
  font-size: 34px;
  color: ${({ theme }) => theme.colors.onFelt};

  ${({ theme }) => theme.media.small} {
    font-size: 28px;
  }
`;

const Lead = styled.p`
  color: ${({ theme }) => theme.colors.onFeltMuted};
  font-size: 17px;
`;

// The lobby will live here.
export function HomePage() {
  const { user } = useUser();
  if (!user) return null;

  const name = user.information.firstName || user.information.username;

  return (
    <Stack $gap={8}>
      <PageTitle>Lobby</PageTitle>
      <Stack $gap={2}>
        <SuitRow />
        <Greeting>Welcome to the table, {name}</Greeting>
        <Lead>Pull up a chair. Games are coming soon.</Lead>
      </Stack>

      <Card>
        <CardHeader
          title="The lobby is being set up"
          description="This is where you'll find open tables and invite friends to a game of Podrida."
        />
      </Card>
    </Stack>
  );
}
