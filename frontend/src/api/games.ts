import {
  endpoints,
  type FinishedGameDetails,
  type FinishedGameListResponse,
} from "@podrida/shared";
import { request, withParams } from "./client";

const { games } = endpoints;

// The logged in user's games that were played to the end.
export const gamesApi = {
  listFinished: (page: number) =>
    request<FinishedGameListResponse>(`${games.path}${games.finished}`, {
      query: { page, limit: 20 },
      auth: true,
    }),

  getFinished: (gameId: string) =>
    request<FinishedGameDetails>(`${games.path}${withParams(games.finishedGame, { gameId })}`, {
      auth: true,
    }),
};
