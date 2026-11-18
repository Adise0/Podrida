import { GameStatus, type AdminGameListQuery, type AdminGameListResponse } from "@podrida/shared";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { adminApi } from "../../api/admin";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Button } from "../../components/ui/Button";
import { Card, MutedText } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/Field";
import { Row, Stack } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { formatDateTime } from "../../lib/format";
import { gameStatusLabels } from "../../lib/gameStatus";
import { PageHeading } from "../app/PageHeading";
import { Filters, RowLink, Table, TableEmpty, TableFooter, TableScroll } from "./adminTable";
import { GameStatusBadge } from "./GameBadges";

const pageSize = 20;

// The filters live in the URL, like on the users page.
function readQuery(params: URLSearchParams): AdminGameListQuery {
  const status = params.get("status");
  const page = Number(params.get("page"));

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: pageSize,
    status: Object.values(GameStatus).includes(status as GameStatus)
      ? (status as GameStatus)
      : undefined,
    playerId: params.get("player") || undefined,
  };
}

export function AdminGamesPage() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => readQuery(params), [params]);

  const load = useRequest((listQuery: AdminGameListQuery) => adminApi.listGames(listQuery));
  const runLoad = load.run;
  useEffect(() => {
    runLoad(query);
  }, [query, runLoad]);

  // The last answer stays on screen while the next page loads.
  const list: AdminGameListResponse | undefined = load.data;

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      });
    },
    [setParams],
  );

  const page = query.page ?? 1;
  const games = list?.games ?? [];

  return (
    <Stack $gap={6}>
      <PageTitle>Games</PageTitle>
      <PageHeading title="Games" description="Every game played on Podrida, newest first." />

      <Card $padded={false}>
        <Filters $columns="1fr 1fr 2fr">
          <SelectField
            label="Status"
            value={query.status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <option value="">Any</option>
            {Object.values(GameStatus).map((status) => (
              <option key={status} value={status}>
                {gameStatusLabels[status]}
              </option>
            ))}
          </SelectField>
          {query.playerId && (
            <Row>
              <MutedText>Only one player's games.</MutedText>
              <Button variant="ghost" small onClick={() => setParam("player", "")}>
                Show everyone's
              </Button>
            </Row>
          )}
        </Filters>

        {load.status === "error" && !list ? (
          <TableEmpty>
            <ErrorAlert error={load.error} />
            <Button variant="secondary" small onClick={() => runLoad(query)}>
              Try again
            </Button>
          </TableEmpty>
        ) : !list ? (
          <TableEmpty>
            <Spinner />
          </TableEmpty>
        ) : games.length === 0 ? (
          <TableEmpty>No games match these filters.</TableEmpty>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Host</th>
                  <th>Players</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const host = game.players.find((player) => player.userId === game.hostId);
                  const kicked = game.players.filter((player) => player.kickedAt).length;

                  return (
                    <tr key={game.id}>
                      <td>
                        <RowLink to={`/admin/games/${game.id}`}>{game.roomName}</RowLink>
                      </td>
                      <td>{host?.username ?? "—"}</td>
                      <td>
                        {game.players.length}
                        {kicked > 0 && <MutedText as="span"> ({kicked} kicked)</MutedText>}
                      </td>
                      <td>
                        <GameStatusBadge status={game.status} isLive={game.isLive} />
                      </td>
                      <td>{formatDateTime(game.startedAt)}</td>
                      <td>{game.endedAt ? formatDateTime(game.endedAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}

        <TableFooter $justify="space-between">
          <MutedText>
            {list?.total ?? 0} game{list?.total === 1 ? "" : "s"}
            {list && list.totalPages > 1 && ` · page ${page} of ${list.totalPages}`}
          </MutedText>
          <Row $gap={2}>
            {load.isPending && list && <Spinner $size={16} />}
            <Button variant="secondary" small onClick={() => runLoad(query)}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              small
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              small
              disabled={!list || page >= list.totalPages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Next
            </Button>
          </Row>
        </TableFooter>
      </Card>
    </Stack>
  );
}
