import type { AdminGame, AdminGamePlayer } from "@podrida/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import styled from "styled-components";
import { adminApi } from "../../api/admin";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { ConfirmModal } from "../../components/ui/Modal";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { formatDateTime } from "../../lib/format";
import { notify } from "../../stores/notifications/actions";
import { PageHeading } from "../app/PageHeading";
import { RowLink, Table, TableScroll } from "./adminTable";
import { GameStatusBadge } from "./GameBadges";

const Details = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(6)}`};
  margin: 0;
  font-size: 14px;

  dt {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  ${({ theme }) => theme.media.small} {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.space(0.5)};

    dd {
      margin-bottom: ${({ theme }) => theme.space(2)};
    }
  }
`;

// The header of a card whose table runs to its edges.
const CardTop = styled.div`
  padding: ${({ theme }) => `${theme.space(7)} ${theme.space(7)} 0`};

  ${({ theme }) => theme.media.small} {
    padding: ${({ theme }) => `${theme.space(5)} ${theme.space(5)} 0`};
  }
`;

// Doubled class, to outweigh the table's own "td { text-align: left }".
const ActionCell = styled.td`
  && {
    text-align: right;
  }
`;

function PlayerState({ player, game }: { player: AdminGamePlayer; game: AdminGame }) {
  if (player.kickedAt) {
    const by = game.players.find((other) => other.userId === player.kickedBy);
    return (
      <Stack $gap={1}>
        <span>
          <Badge $tone="danger">Kicked</Badge>
        </span>
        <MutedText>
          {formatDateTime(player.kickedAt)}
          {/* A kicker who isn't a player can only have been an admin. */}
          {by ? ` by ${by.username}` : " by an admin"}
        </MutedText>
      </Stack>
    );
  }

  if (!game.isLive) return <MutedText>—</MutedText>;

  return player.isConnected ? (
    <Badge $tone="success">Connected</Badge>
  ) : (
    <Badge>Disconnected</Badge>
  );
}

export function AdminGamePage() {
  const { gameId = "" } = useParams();
  const [game, setGame] = useState<AdminGame | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [kickTarget, setKickTarget] = useState<AdminGamePlayer | null>(null);

  const load = useRequest(async (id: string) => setGame(await adminApi.getGame(id)));
  const runLoad = load.run;
  useEffect(() => {
    runLoad(gameId);
  }, [gameId, runLoad]);

  const end = useRequest(async () => {
    setGame(await adminApi.endGame(gameId));
    setIsEnding(false);
    notify("Game ended.", "success");
  });

  const kick = useRequest(async (player: AdminGamePlayer) => {
    setGame(await adminApi.kickGamePlayer(gameId, player.userId));
    setKickTarget(null);
    notify(`${player.username} was kicked.`, "success");
  });

  if (!game) {
    return load.error ? (
      <Card>
        <PageTitle>Game</PageTitle>
        <CardHeader title="Can't load this game" />
        <Stack>
          <ErrorAlert error={load.error} />
          <TextLink to="/admin/games">Back to the games</TextLink>
        </Stack>
      </Card>
    ) : (
      <Row $justify="center">
        <Spinner $size={28} />
      </Row>
    );
  }

  const host = game.players.find((player) => player.userId === game.hostId);
  const inGame = game.players.filter((player) => !player.kickedAt).length;

  return (
    <Stack $gap={6}>
      <PageTitle>{game.roomName}</PageTitle>
      <Stack $gap={2}>
        <TextLink to="/admin/games">← All games</TextLink>
        <PageHeading title={game.roomName} />
      </Stack>

      <Card>
        <CardHeader title="Game" />
        <Details>
          <dt>Status</dt>
          <dd>
            <GameStatusBadge status={game.status} isLive={game.isLive} />
          </dd>
          <dt>Host</dt>
          <dd>{host?.username ?? "—"}</dd>
          <dt>Started</dt>
          <dd>{formatDateTime(game.startedAt)}</dd>
          <dt>Ended</dt>
          <dd>
            {game.endedAt ? formatDateTime(game.endedAt) : "—"}
            {game.endedBy && ` by ${game.endedBy.username}`}
          </dd>
          <dt>Id</dt>
          <dd>{game.id}</dd>
        </Details>
      </Card>

      <Card $padded={false}>
        <Stack $gap={0}>
          <CardTop>
            <CardHeader
              title="Players"
              description={`${inGame} of ${game.players.length} still in the game.`}
            />
          </CardTop>
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Points</th>
                  <th>State</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {game.players.map((player) => (
                  <tr key={player.userId}>
                    <td>
                      <RowLink to={`/admin/users/${player.userId}`}>{player.username}</RowLink>{" "}
                      {player.userId === game.hostId && <Badge $tone="warning">Host</Badge>}
                    </td>
                    <td>{player.total}</td>
                    <td>
                      <PlayerState player={player} game={game} />
                    </td>
                    <ActionCell>
                      {game.isLive && !player.kickedAt && (
                        <Button
                          variant="ghost"
                          small
                          onClick={() => {
                            kick.reset();
                            setKickTarget(player);
                          }}
                        >
                          Kick
                        </Button>
                      )}
                    </ActionCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </Stack>
      </Card>

      {game.isLive && (
        <Card>
          <CardHeader
            title="End the game"
            description="Stops it for every player right away, as if the host had ended it."
          />
          <Row $justify="flex-end">
            <Button
              variant="danger"
              onClick={() => {
                end.reset();
                setIsEnding(true);
              }}
            >
              Force end game
            </Button>
          </Row>
        </Card>
      )}

      <ConfirmModal
        isOpen={isEnding}
        title="Force end this game?"
        body="Every player is taken out of it. This can't be undone."
        confirmLabel="End game"
        variant="danger"
        isPending={end.isPending}
        error={<ErrorAlert error={end.error} />}
        onConfirm={() => end.run()}
        onCancel={() => setIsEnding(false)}
      />

      <ConfirmModal
        isOpen={kickTarget !== null}
        title={`Kick ${kickTarget?.username ?? ""}?`}
        body={
          kickTarget?.userId === game.hostId
            ? "They're the host: the next player still in the game takes over. If nobody is left, the game ends."
            : "They're taken out of this game and can't come back to it. If nobody is left, the game ends."
        }
        confirmLabel="Kick"
        variant="danger"
        isPending={kick.isPending}
        error={<ErrorAlert error={kick.error} />}
        onConfirm={() => kickTarget && kick.run(kickTarget)}
        onCancel={() => setKickTarget(null)}
      />
    </Stack>
  );
}
