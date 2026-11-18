import { ErrorCode, roomLimits, roomSettingsLimits } from "@podrida/shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styled from "styled-components";
import { hasErrorCode, isApiError } from "../../api/client";
import { getErrorMessage } from "../../api/errorMessages";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { AddBotSeat, BotSeatControls } from "../../components/play/BotControls";
import { EmptySeat, Seat, SeatGrid } from "../../components/play/Seat";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { Tabs } from "../../components/ui/Tabs";
import { useRequest } from "../../hooks/useRequest";
import { notify } from "../../stores/notifications/actions";
import {
  addBot,
  joinRoom,
  leaveRoom,
  removeBot,
  setBotDifficulty,
  startGame,
  updateRoomSettings,
} from "../../stores/play/actions";
import { usePlay } from "../../stores/play/store";
import { useUser } from "../../stores/user/store";
import { PageHeading } from "./PageHeading";

const ThinkingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  font-size: 14px;

  input {
    width: min(240px, 100%);
    accent-color: ${({ theme }) => theme.colors.gold};
  }
`;

const seconds = (milliseconds: number) =>
  `${(milliseconds / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;

// The bots' delay before each move (they wait between half this and this), for the table to follow.
function BotThinkingSetting({ value, isHost }: { value: number; isHost: boolean }) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const { min, max, step } = roomSettingsLimits.botThinkingMaxMs;

  const save = async () => {
    if (draft === null || draft === value) return;
    try {
      await updateRoomSettings({ botThinkingMaxMs: draft });
    } catch {
      notify("Couldn't change the bots' thinking time.", "error");
    } finally {
      setDraft(null);
    }
  };

  if (!isHost) {
    return <MutedText>Bots take up to {seconds(value)} per move.</MutedText>;
  }

  return (
    <ThinkingRow>
      <label htmlFor="bot-thinking">Bot thinking time, up to</label>
      <input
        id="bot-thinking"
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        onBlur={save}
      />
      <strong>{seconds(shown)}</strong>
      <MutedText>
        {shown === 0 ? "Bots play at once." : `At least ${seconds(shown / 2)}.`}
      </MutedText>
    </ThinkingRow>
  );
}

// Opening a room's page sits you down at it, so its link works as an invite.
export function RoomPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const play = usePlay();
  const { user } = useUser();
  const [wasSeatedHere, setWasSeatedHere] = useState(false);
  const [tab, setTab] = useState<"table" | "settings">("table");

  const join = useRequest(joinRoom);
  const runJoin = join.run;
  const leave = useRequest(async () => {
    await leaveRoom();
    navigate("/");
  });
  // Leaving another table to sit at this one.
  const switchHere = useRequest(async () => {
    await leaveRoom();
    await joinRoom(roomId);
  });
  const start = useRequest(startGame);

  const isStarted = play.status !== "offline";
  const room = play.roomId === roomId ? play.room : null;

  // Once per room: the store already has it if we just created or joined it.
  const requestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isStarted || requestedFor.current === roomId) return;
    requestedFor.current = roomId;
    if (play.roomId !== roomId || !play.room) runJoin(roomId);
  }, [isStarted, roomId, play.roomId, play.room, runJoin]);

  // Remembered, so losing the seat later says so instead of showing a spinner. Set during render
  // (React's pattern for state derived from other state) rather than one render late in an effect.
  if (room && !wasSeatedHere) setWasSeatedHere(true);

  // This table's game started: everyone goes to it.
  useEffect(() => {
    if (wasSeatedHere && play.gameId) navigate(`/games/${play.gameId}`, { replace: true });
  }, [wasSeatedHere, play.gameId, navigate]);

  if (!user) return null;

  const backToLobby = <TextLink to="/">Back to the lobby</TextLink>;

  if (!room) {
    if (join.isPending || switchHere.isPending || (!join.error && !wasSeatedHere)) {
      return (
        <Row $justify="center">
          <Spinner $size={28} />
        </Row>
      );
    }

    const details = isApiError(join.error) ? join.error.body.details : undefined;

    let body;
    if (hasErrorCode(join.error, ErrorCode.ALREADY_IN_ROOM)) {
      body = (
        <Stack>
          <MutedText>You're already sitting at another table.</MutedText>
          <ErrorAlert error={switchHere.error} />
          <Row>
            <Button onClick={() => switchHere.run()} loading={switchHere.isPending}>
              Leave it and sit here
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/rooms/${String(details?.roomId)}`)}
            >
              Go to my table
            </Button>
          </Row>
        </Stack>
      );
    } else if (hasErrorCode(join.error, ErrorCode.ALREADY_IN_GAME)) {
      body = (
        <Stack>
          <MutedText>
            You're in the middle of a game. You can sit at another table once it ends.
          </MutedText>
          <TextLink to={`/games/${String(details?.gameId)}`}>Back to the game</TextLink>
        </Stack>
      );
    } else if (join.error) {
      body = (
        <Stack>
          <ErrorAlert error={join.error} />
          {backToLobby}
        </Stack>
      );
    } else {
      // Was here, isn't anymore (left from another tab, or away for too long).
      body = (
        <Stack>
          <MutedText>You're not sitting at this table anymore.</MutedText>
          <Row>
            <Button onClick={() => join.run(roomId)}>Sit back down</Button>
            {backToLobby}
          </Row>
        </Stack>
      );
    }

    return (
      <Card>
        <PageTitle>Table</PageTitle>
        <CardHeader title="Can't sit down here" />
        {body}
      </Card>
    );
  }

  const isHost = room.hostId === user.id;
  const emptySeats = roomLimits.maxPlayers - room.members.length;
  const canStart = room.members.length >= roomLimits.minPlayers;

  const botAction = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
    } catch (error) {
      notify(`${failure} ${getErrorMessage(error)}`, "error");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Invite link copied.", "success");
    } catch {
      notify("Couldn't copy the link. Copy it from the address bar instead.", "error");
    }
  };

  return (
    <Stack $gap={6}>
      <PageTitle>{room.name}</PageTitle>
      <PageHeading
        title={room.name}
        description={`${room.members.length} of ${roomLimits.maxPlayers} seats taken`}
      />

      <Card>
        <Stack $gap={5}>
          <Tabs
            label="Table"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: "table",
                label: "Table",
                panel: (
                  <Stack $gap={5}>
                    <CardHeader
                      title="At the table"
                      description={
                        isHost
                          ? "You're the host: start the game once everyone has sat down. Click an open seat to add a bot."
                          : "Waiting for the host to start the game."
                      }
                    />
                    <SeatGrid>
                      {room.members.map((member) => (
                        <Seat
                          key={member.userId}
                          username={member.username}
                          avatarUrl={member.avatarUrl}
                          isHost={member.userId === room.hostId}
                          isYou={member.userId === user.id}
                          isConnected={member.isConnected}
                          isBot={Boolean(member.bot)}
                          action={
                            member.bot && (
                              <BotSeatControls
                                name={member.username}
                                difficulty={member.bot.difficulty}
                                isHost={isHost}
                                onChange={(difficulty) =>
                                  botAction(
                                    () => setBotDifficulty(member.userId, difficulty),
                                    "Couldn't change the bot.",
                                  )
                                }
                                onRemove={() =>
                                  botAction(
                                    () => removeBot(member.userId),
                                    "Couldn't remove the bot.",
                                  )
                                }
                              />
                            )
                          }
                        />
                      ))}
                      {Array.from({ length: emptySeats }, (_, index) =>
                        isHost ? (
                          <AddBotSeat
                            key={index}
                            onAdd={(difficulty) =>
                              botAction(() => addBot(difficulty), "Couldn't add a bot.")
                            }
                          />
                        ) : (
                          <EmptySeat key={index} />
                        ),
                      )}
                    </SeatGrid>
                  </Stack>
                ),
              },
              {
                id: "settings",
                label: "Settings",
                panel: (
                  <Stack $gap={5}>
                    <CardHeader
                      title="Settings"
                      description={
                        isHost
                          ? "How this table plays. Only you, the host, can change them."
                          : "How this table plays. The host chooses them."
                      }
                    />
                    <BotThinkingSetting value={room.settings.botThinkingMaxMs} isHost={isHost} />
                  </Stack>
                ),
              },
            ]}
          />

          {play.status !== "online" && (
            <Alert tone="warning">Connection lost. Your seat is kept while we reconnect.</Alert>
          )}
          <ErrorAlert error={leave.error ?? start.error} />

          <Row $justify="space-between">
            <Row $gap={2}>
              <Button variant="secondary" onClick={copyInvite}>
                Copy invite link
              </Button>
              <Button variant="ghost" onClick={() => leave.run()} loading={leave.isPending}>
                Leave table
              </Button>
            </Row>
            {isHost && (
              <Button
                onClick={() => start.run()}
                loading={start.isPending}
                disabled={!canStart || play.status !== "online"}
                title={canStart ? undefined : `At least ${roomLimits.minPlayers} players`}
              >
                Start game
              </Button>
            )}
          </Row>
          {isHost && !canStart && (
            <MutedText>
              A game needs at least {roomLimits.minPlayers} players. Share the invite link, or click
              an open seat to add a bot.
            </MutedText>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
