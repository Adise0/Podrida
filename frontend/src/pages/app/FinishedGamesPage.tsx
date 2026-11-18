import type { FinishedGameSummary } from "@podrida/shared";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import styled from "styled-components";
import { gamesApi } from "../../api/games";
import { Avatar } from "../../components/Avatar";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Button } from "../../components/ui/Button";
import { Card, MutedText } from "../../components/ui/Card";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { formatDateTime } from "../../lib/format";
import { useUser } from "../../stores/user/store";
import { PageHeading } from "./PageHeading";

const GameLink = styled(Link)`
  display: block;
  padding: ${({ theme }) => theme.space(5)};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadows.card};
  color: ${({ theme }) => theme.colors.text};
  text-decoration: none;
  transition: transform 150ms ease;

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
  }
`;

const GameHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space(3)};
  margin-bottom: ${({ theme }) => theme.space(3)};

  h2 {
    font-size: 20px;
  }
`;

const Players = styled.ol`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space(2)};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const PlayerChip = styled.li<{ $winner: boolean; $me: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  padding: 4px 12px 4px 4px;
  border: 1px solid ${({ theme, $me }) => ($me ? theme.colors.gold : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $winner }) => ($winner ? theme.colors.warningSoft : theme.colors.surfaceSunken)};
  font-size: 14px;

  b {
    font-family: ${({ theme }) => theme.fonts.display};
    font-variant-numeric: tabular-nums;
  }

  b[data-negative="true"] {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

const Crown = styled.span`
  color: ${({ theme }) => theme.colors.gold};
`;

function GameItem({ game, meId }: { game: FinishedGameSummary; meId: string }) {
  const ranked = [...game.players].sort((a, b) => b.total - a.total);

  return (
    <li>
      <GameLink to={`/games/finished/${game.id}`}>
        <GameHead>
          <h2>{game.roomName}</h2>
          <MutedText>{formatDateTime(game.endedAt)}</MutedText>
        </GameHead>
        <Players aria-label="Final points">
          {ranked.map((player) => (
            <PlayerChip key={player.userId} $winner={player.isWinner} $me={player.userId === meId}>
              <Avatar src={player.avatarUrl} name={player.username} size={26} decorative />
              {player.isWinner && <Crown aria-label="Winner">♛</Crown>}
              <span>{player.username}</span>
              <b data-negative={player.total < 0}>{player.total}</b>
            </PlayerChip>
          ))}
        </Players>
      </GameLink>
    </li>
  );
}

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(4)};
  margin: 0;
  padding: 0;
  list-style: none;
`;

// The user's games that were played to the end, newest first.
export function FinishedGamesPage() {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const load = useRequest(gamesApi.listFinished);
  const runLoad = load.run;

  useEffect(() => {
    runLoad(page);
  }, [page, runLoad]);

  if (!user) return null;

  const list = load.data;

  return (
    <Stack $gap={6}>
      <PageTitle>Finished games</PageTitle>
      <Stack $gap={2}>
        <TextLink to="/">← Lobby</TextLink>
        <PageHeading
          title="Finished games"
          description="The games you played to the end, with the final points."
        />
      </Stack>

      {load.status === "error" && !list ? (
        <Card>
          <Stack>
            <ErrorAlert error={load.error} />
            <Button variant="secondary" small onClick={() => runLoad(page)}>
              Try again
            </Button>
          </Stack>
        </Card>
      ) : !list ? (
        <Row $justify="center">
          <Spinner $size={28} />
        </Row>
      ) : list.games.length === 0 ? (
        <Card>
          <MutedText>No finished games yet. Games you play to the end show up here.</MutedText>
        </Card>
      ) : (
        <>
          <List>
            {list.games.map((game) => (
              <GameItem key={game.id} game={game} meId={user.id} />
            ))}
          </List>
          {list.totalPages > 1 && (
            <Row $justify="space-between">
              <Button
                variant="secondary"
                small
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) })}
              >
                Newer
              </Button>
              <MutedText>
                Page {page} of {list.totalPages}
              </MutedText>
              <Button
                variant="secondary"
                small
                disabled={page >= list.totalPages}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                Older
              </Button>
            </Row>
          )}
        </>
      )}
    </Stack>
  );
}
