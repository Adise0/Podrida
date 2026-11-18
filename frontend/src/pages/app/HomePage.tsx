import { roomLimits, type Room } from "@podrida/shared";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SuitRow } from "../../components/Brand";
import { PageTitle } from "../../components/PageTitle";
import { AvatarStack } from "../../components/play/AvatarStack";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { Form, Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { loadLobby, watchLobby } from "../../stores/lobby/actions";
import { useLobby } from "../../stores/lobby/store";
import { createRoom } from "../../stores/play/actions";
import { usePlay } from "../../stores/play/store";
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

const CreateRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space(3)};

  & > :first-child {
    flex: 1;
  }

  ${({ theme }) => theme.media.small} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const RoomList = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const RoomRow = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(4)};
  padding: ${({ theme }) => `${theme.space(3)} 0`};

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  ${({ theme }) => theme.media.small} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space(2)};
  }
`;

const RoomInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const RoomName = styled.span`
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Seats = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const Empty = styled(MutedText)`
  padding: ${({ theme }) => `${theme.space(6)} 0`};
  text-align: center;
`;

const defaultRoomName = (username: string) =>
  `${username}'s table`.slice(0, roomLimits.nameMaxLength);

function RoomItem({ room, mine, canJoin }: { room: Room; mine: boolean; canJoin: boolean }) {
  const navigate = useNavigate();
  const host = room.members.find((member) => member.userId === room.hostId);
  const isFull = room.members.length >= roomLimits.maxPlayers;

  return (
    <RoomRow>
      <AvatarStack members={room.members} />
      <RoomInfo>
        <RoomName title={room.name}>{room.name}</RoomName>
        <MutedText>Hosted by {host?.username ?? "someone"}</MutedText>
      </RoomInfo>
      <Seats>
        {room.members.length} / {roomLimits.maxPlayers}
      </Seats>
      <Button
        small
        variant={mine ? "primary" : "secondary"}
        disabled={!mine && (isFull || !canJoin)}
        onClick={() => navigate(`/rooms/${room.id}`)}
      >
        {mine ? "Back to table" : isFull ? "Full" : "Sit down"}
      </Button>
    </RoomRow>
  );
}

// The lobby: open a table, or sit down at someone else's.
export function HomePage() {
  const { user } = useUser();
  const play = usePlay();
  const lobby = useLobby();
  const navigate = useNavigate();
  const [name, setName] = useState(() => defaultRoomName(user?.information.username ?? ""));
  const [nameError, setNameError] = useState<string | null>(null);

  const isStarted = play.status !== "offline";
  useEffect(() => (isStarted ? watchLobby() : undefined), [isStarted]);

  const create = useRequest(async (roomName: string) => {
    const room = await createRoom(roomName);
    navigate(`/rooms/${room.id}`);
  });

  if (!user) return null;

  const isSeated = play.roomId !== null || play.gameId !== null;

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    const error = !value
      ? "Give your table a name"
      : value.length > roomLimits.nameMaxLength
        ? `At most ${roomLimits.nameMaxLength} characters`
        : null;
    setNameError(error);
    if (!error) create.run(value);
  };

  return (
    <Stack $gap={8}>
      <PageTitle>Lobby</PageTitle>
      <Stack $gap={2}>
        <SuitRow />
        <Greeting>
          Welcome to the table, {user.information.firstName || user.information.username}
        </Greeting>
        <Lead>Open a table and wait for friends, or sit down at one below.</Lead>
      </Stack>

      {play.gameId && (
        <Alert tone="warning">
          <p>You're in the middle of a game.</p>
          <TextLink to={`/games/${play.gameId}`}>Back to the game</TextLink>
        </Alert>
      )}

      {!isSeated && (
        <Card>
          <CardHeader
            title="Open a table"
            description="Others will see it here and can sit down."
          />
          <Form onSubmit={onCreate} noValidate>
            <CreateRow>
              <TextField
                label="Table name"
                value={name}
                maxLength={roomLimits.nameMaxLength}
                error={nameError}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
              />
              <Button type="submit" loading={create.isPending} disabled={play.status !== "online"}>
                Open table
              </Button>
            </CreateRow>
            <ErrorAlert error={create.error} />
          </Form>
        </Card>
      )}

      <Card>
        <Row $justify="space-between">
          <CardHeader
            title="Tables"
            description={`From ${roomLimits.minPlayers} to ${roomLimits.maxPlayers} players. The host starts the game.`}
          />
          <TextLink to="/games/finished">See finished games</TextLink>
        </Row>
        {lobby.status === "error" ? (
          <Stack $gap={3}>
            <ErrorAlert error={lobby.error} />
            <Row>
              <Button variant="secondary" small onClick={() => loadLobby()}>
                Try again
              </Button>
            </Row>
          </Stack>
        ) : lobby.status !== "loaded" ? (
          <Row $justify="center">
            <Spinner />
          </Row>
        ) : lobby.rooms.length === 0 ? (
          <Empty>No tables open yet. Be the first!</Empty>
        ) : (
          <RoomList>
            {lobby.rooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                mine={room.id === play.roomId}
                canJoin={!isSeated && play.status === "online"}
              />
            ))}
          </RoomList>
        )}
      </Card>
    </Stack>
  );
}
