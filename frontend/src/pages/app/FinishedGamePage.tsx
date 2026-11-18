import { roundSchedule } from "@podrida/shared";
import { useEffect } from "react";
import { useParams } from "react-router";
import styled from "styled-components";
import { gamesApi } from "../../api/games";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Card, CardHeader } from "../../components/ui/Card";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { ScoreTable, StandingsStrip } from "../../game/components/ScoreSheet";
import { g, panel } from "../../game/tokens";
import { useRequest } from "../../hooks/useRequest";
import { formatDateTime } from "../../lib/format";
import { useUser } from "../../stores/user/store";
import { PageHeading } from "./PageHeading";

// The same dark sheet as in the game.
const Sheet = styled.section`
  ${panel}
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  font-family: ${g.sans};
  overflow-x: auto;
`;

const Winner = styled.p`
  color: ${g.goldText};
  font-family: ${g.serif};
  font-size: 22px;
  font-weight: 600;
`;

export function FinishedGamePage() {
  const { gameId = "" } = useParams();
  const { user } = useUser();
  const load = useRequest(gamesApi.getFinished);
  const runLoad = load.run;

  useEffect(() => {
    runLoad(gameId);
  }, [gameId, runLoad]);

  const game = load.data;

  if (!user) return null;

  if (!game) {
    return load.error ? (
      <Card>
        <PageTitle>Finished game</PageTitle>
        <CardHeader title="Can't open this game" />
        <Stack>
          <ErrorAlert error={load.error} />
          <TextLink to="/games/finished">Back to finished games</TextLink>
        </Stack>
      </Card>
    ) : (
      <Row $justify="center">
        <Spinner $size={28} />
      </Row>
    );
  }

  // The local player first, then the seat order, like in the game.
  const seats = game.players.map((player, seat) => ({
    ...player,
    seat,
    bot: player.bot?.difficulty,
  }));
  const mine = seats.findIndex((player) => player.userId === user.id);
  const ordered = mine === -1 ? seats : [...seats.slice(mine), ...seats.slice(0, mine)];
  const totals = Object.fromEntries(game.players.map((player) => [player.userId, player.total]));
  const names = Object.fromEntries(game.players.map((player) => [player.userId, player.username]));
  const winners = game.players.filter((player) => player.isWinner);
  const best = winners[0]?.total ?? 0;
  const winnerNames = winners.map((player) =>
    player.userId === user.id ? "You" : player.username,
  );
  const winnerText =
    winnerNames.length === 1
      ? `${winnerNames[0]} won with ${best}`
      : `${winnerNames.slice(0, -1).join(", ")} & ${winnerNames.at(-1)} won with ${best}`;

  return (
    <Stack $gap={6}>
      <PageTitle>{game.roomName}</PageTitle>
      <Stack $gap={2}>
        <TextLink to="/games/finished">← Finished games</TextLink>
        <PageHeading
          title={game.roomName}
          description={`${formatDateTime(game.startedAt)} · ${game.roundCount} rounds · ${game.players.length} players`}
        />
      </Stack>

      <Sheet aria-label="Score sheet">
        <Winner>{winnerText}</Winner>
        <StandingsStrip players={ordered} totals={totals} meId={user.id} />
        <ScoreTable
          players={ordered}
          schedule={
            // As it was played: games from before a schedule change keep theirs.
            game.rounds.length === game.roundCount
              ? game.rounds.map((round) => round.cardsPerPlayer)
              : roundSchedule(game.players.length)
          }
          history={game.rounds}
          current={null}
          totals={totals}
          names={names}
        />
      </Sheet>
    </Stack>
  );
}
