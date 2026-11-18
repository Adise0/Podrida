import { GameStatus } from "@podrida/shared";
import { useEffect } from "react";
import { useParams } from "react-router";
import styled from "styled-components";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Card, CardHeader } from "../../components/ui/Card";
import { Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { GameScreen } from "../../game/GameScreen";
import { useRequest } from "../../hooks/useRequest";
import { attachGame, detachGame } from "../../stores/play/actions";
import { usePlay } from "../../stores/play/store";
import { useUser } from "../../stores/user/store";

const Centered = styled.div`
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.space(4)};

  & > * {
    width: 100%;
    max-width: 440px;
  }
`;

const endedMessages: Record<GameStatus | "kicked", string> = {
  [GameStatus.inProgress]: "",
  [GameStatus.finished]: "This game is over.",
  [GameStatus.endedEarly]: "This game was ended early.",
  [GameStatus.abandoned]: "Nobody was at the table anymore, so this game was abandoned.",
  [GameStatus.interrupted]: "This game was cut short by a server restart.",
  kicked: "You were removed from this game.",
};

// The game screen. Having it open is what puts the player at the table: it attaches this tab to
// the game, and leaving the page detaches it.
export function GamePage() {
  const { gameId = "" } = useParams();
  const play = usePlay();
  const { user } = useUser();
  const attach = useRequest(attachGame);
  const runAttach = attach.run;
  const isStarted = play.status !== "offline";

  useEffect(() => {
    if (!isStarted) return undefined;
    runAttach(gameId);
    return () => detachGame();
  }, [isStarted, gameId, runAttach]);

  if (!user) return null;

  const ended = play.endedGame?.gameId === gameId ? play.endedGame : null;
  const game = play.gameId === gameId ? play.game : null;

  // Played to the end: the final score sheet stays up.
  if (ended?.finalGame) return <GameScreen game={ended.finalGame} meId={user.id} />;

  if (game) return <GameScreen game={game} meId={user.id} />;

  return (
    <Centered>
      {ended ? (
        <Card>
          <PageTitle>{ended.reason === "kicked" ? "Removed from the game" : "Game over"}</PageTitle>
          <CardHeader
            title={ended.reason === "kicked" ? "Removed from the game" : "Game over"}
            description={endedMessages[ended.reason]}
          />
          <TextLink to="/">Back to the lobby</TextLink>
        </Card>
      ) : attach.error ? (
        <Card>
          <PageTitle>Game</PageTitle>
          <CardHeader title="Can't open this game" />
          <Stack>
            <ErrorAlert error={attach.error} />
            <TextLink to="/">Back to the lobby</TextLink>
          </Stack>
        </Card>
      ) : (
        <Stack style={{ alignItems: "center" }}>
          <Spinner $size={32} />
        </Stack>
      )}
    </Centered>
  );
}
