import {
  ErrorCode,
  PodridaPhase,
  cardKey,
  maxCardsPerPlayer,
  playableCards,
  roundSchedule,
  type Card,
  type Game,
  type GamePlayer,
  type PlayRule,
} from "@podrida/shared";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { hasErrorCode, isApiError } from "../api/client";
import { getErrorMessage } from "../api/errorMessages";
import { realtime } from "../api/realtime";
import { createRoom, endGame, kickPlayer } from "../stores/play/actions";
import { usePlay } from "../stores/play/store";
import { BidPicker, BottomBar, PrimaryButton } from "./components/BottomBar";
import { ConfirmDialog, SettingsPopover } from "./components/Dialogs";
import { Hand } from "./components/Hand";
import { LeaveIcon, ScoreboardIcon, SettingsIcon, SoundIcon } from "./components/Icons";
import { LayoutDebug } from "./components/LayoutDebug";
import { OpponentSeat } from "./components/OpponentSeat";
import { OwnBidStrip } from "./components/OwnBidStrip";
import { IconButton } from "./components/primitives";
import { ScoreSheet, type SheetPlayer } from "./components/ScoreSheet";
import {
  LastAction,
  RoundSummary,
  StatusHeading,
  TrickArea,
  TrumpSlot,
  type DropState,
} from "./components/TableCentre";
import { TopBar } from "./components/TopBar";
import { TurnArrow } from "./components/TurnArrow";
import { sortHand } from "./handLayout";
import { computeLayout, isLayoutDebug } from "./layout";
import { cardLabel, lastActionText, refusedCardText, statusText } from "./rulesText";
import { useGameSettings } from "./settings";
import { playCardTick, playChime } from "./sound";
import { g } from "./tokens";

const frameInset = 20;

// The whole viewport, minus the frame's inset: no fixed canvas, no letterboxing.
const Frame = styled.div`
  position: fixed;
  inset: ${frameInset}px;
  border: 1px solid ${g.frameBorder};
  border-radius: 24px;
  overflow: hidden;
  color: ${g.text};
  font-family: ${g.sans};
  --motion: 1;

  @media (prefers-reduced-motion: reduce) {
    --motion: 0; // Slides and pops become fades.
  }
`;

const ConnectionBanner = styled.div`
  position: absolute;
  left: 50%;
  z-index: 700;
  padding: 6px 16px;
  border: 1px solid ${g.panelBorder};
  border-radius: 0 0 10px 10px;
  background: ${g.panel};
  color: ${g.goldText};
  font-size: 13px;
  font-weight: 600;
  transform: translateX(-50%);
`;

const Waiting = styled(PrimaryButton)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// The frame's real size, live: the layout follows every resize (and anything else that changes it).
function useFrameSize(frame: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth - 2 * frameInset,
    height: window.innerHeight - 2 * frameInset,
  }));

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame]);

  return size;
}

const centreOf = (box: { x: number; y: number; w: number; h: number }) => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

interface GameScreenProps {
  game: Game;
  meId: string;
  forceOnline?: boolean; // The dev preview, which has no connection.
}

// The game, as one player sees it. Desktop only. Every element has its own box (layout.ts).
export function GameScreen({ game, meId, forceOnline = false }: GameScreenProps) {
  const navigate = useNavigate();
  const play = usePlay();
  const [settings, updateSettings] = useGameSettings();
  const { state } = game;
  const isOnline = forceOnline || play.status === "online";
  const isFinished = state.phase === PodridaPhase.finished;
  const frameRef = useRef<HTMLDivElement>(null);
  const [debug] = useState(isLayoutDebug);

  // LAYOUT

  const frameSize = useFrameSize(frameRef);
  const layout = useMemo(
    () =>
      computeLayout(
        frameSize.width,
        frameSize.height,
        game.players.length,
        maxCardsPerPlayer(game.players.length),
        {
          width: frameSize.width + 2 * frameInset,
          height: frameSize.height + 2 * frameInset,
        },
      ),
    [frameSize, game.players.length],
  );

  // SEATS: the local player at the bottom, the others clockwise from their left.

  const seatOf = useMemo(
    () => Object.fromEntries(game.players.map((player, index) => [player.userId, index])),
    [game.players],
  );
  const myIndex = seatOf[meId] ?? 0;
  const me = game.players[myIndex];
  const opponents = useMemo(
    () =>
      Array.from(
        { length: game.players.length - 1 },
        (_, step) => game.players[(myIndex + step + 1) % game.players.length],
      ),
    [game.players, myIndex],
  );
  const names = Object.fromEntries(game.players.map((player) => [player.userId, player.username]));

  // Where cards come from and go to, and where the turn arrow rests, for each player.
  const origins: Record<string, { x: number; y: number }> = {
    [meId]: centreOf(layout.hand),
    ...Object.fromEntries(
      opponents.map((player, index) => [player.userId, centreOf(layout.seats[index].content)]),
    ),
  };
  const slots: Record<string, { x: number; y: number }> = {
    [meId]: centreOf(layout.mySlot),
    ...Object.fromEntries(
      opponents.map((player, index) => [player.userId, centreOf(layout.seats[index].slot)]),
    ),
  };

  // THE STATE OF PLAY

  const isMyTurn = state.turnId === meId && isOnline;
  const isMyBid = isMyTurn && state.phase === PodridaPhase.bidding;
  const isMyPlay = isMyTurn && state.phase === PodridaPhase.playing;
  const status = statusText(game, meId);
  const lastRecord = state.history.at(-1);
  const isActing = state.phase === PodridaPhase.bidding || state.phase === PodridaPhase.playing;

  // A won trick only counts on the dots once its cards have gone to the winner.
  const wonShown = (userId: string) =>
    (state.tricksWon[userId] ?? 0) -
    (state.phase === PodridaPhase.trickEnd && state.trickWinnerId === userId ? 1 : 0);

  const flashOf = (userId: string): "met" | "missed" | null => {
    if (state.phase !== PodridaPhase.scoring || !lastRecord) return null;
    const result = lastRecord.results.find((entry) => entry.userId === userId);
    return result ? (result.bid === result.won ? "met" : "missed") : null;
  };

  const activityOf = (userId: string) =>
    state.turnId !== userId
      ? null
      : state.phase === PodridaPhase.bidding
        ? ("Bidding…" as const)
        : state.phase === PodridaPhase.playing
          ? ("Playing…" as const)
          : null;

  // THE HAND

  const handCards = useMemo(
    () =>
      state.phase === PodridaPhase.dealing
        ? state.hand
        : sortHand(state.hand, settings.sortMode, state.trumpSuit),
    [state.phase, state.hand, settings.sortMode, state.trumpSuit],
  );
  const playable = useMemo(
    () =>
      isMyPlay
        ? new Set(playableCards(state.hand, state.trick, state.trumpSuit).map(cardKey))
        : null,
    [isMyPlay, state.hand, state.trick, state.trumpSuit],
  );
  const [chosenKey, setSelectedKey] = useState<string | null>(null);
  // A selection that can't be played anymore (the turn passed, the trick changed) doesn't count.
  const selectedKey = chosenKey && playable?.has(chosenKey) ? chosenKey : null;
  const selectedCard = handCards.find((card) => cardKey(card) === selectedKey) ?? null;

  const [drop, setDrop] = useState<DropState>("none");
  const trickRef = useRef<HTMLDivElement>(null);

  // MOVES

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showError = useCallback((reason: unknown) => {
    const text = hasErrorCode(reason, ErrorCode.CARD_NOT_PLAYABLE)
      ? refusedCardText(
          (isApiError(reason) ? (reason.body.details?.rule as PlayRule | null) : null) ?? null,
        )
      : getErrorMessage(reason);
    setError(text);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 3000);
  }, []);

  const playCard = useCallback(
    async (card: Card) => {
      if (isPending) return;
      setIsPending(true);
      try {
        await realtime.request("games:play", { card: { suit: card.suit, rank: card.rank } });
        setSelectedKey(null);
      } catch (reason) {
        showError(reason);
      } finally {
        setIsPending(false);
      }
    },
    [isPending, showError, setSelectedKey],
  );

  const placeBid = useCallback(
    async (bid: number) => {
      if (isPending) return;
      setIsPending(true);
      try {
        await realtime.request("games:bid", { bid });
      } catch (reason) {
        showError(reason); // The picker stays for another try.
      } finally {
        setIsPending(false);
      }
    },
    [isPending, showError],
  );

  // TURN SIGNALS: the chime, and the tab title when the tab isn't in front.

  const soundOn = settings.sound;
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current && soundOn && settings.turnChime) playChime();
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn, soundOn, settings.turnChime]);

  useEffect(() => {
    const base = `${game.roomName} — Podrida`;
    const update = () => {
      document.title = isMyTurn && document.hidden ? `• Your turn — Podrida` : base;
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [isMyTurn, game.roomName]);

  const lastPlayKey =
    state.lastAction?.kind === "play"
      ? `${state.lastAction.userId}-${cardKey(state.lastAction.card)}`
      : null;
  useEffect(() => {
    if (lastPlayKey && soundOn && settings.effects) playCardTick();
  }, [lastPlayKey, soundOn, settings.effects]);

  // SCORE SHEET: the button, Tab held down, or S.

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [seenRounds, setSeenRounds] = useState(state.history.length);
  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
    setSeenRounds(state.history.length);
  }, [state.history.length]);
  const closeSheet = useCallback(() => setIsSheetOpen(false), []);

  useEffect(() => {
    let heldOpen = false;
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "Tab" && !event.repeat) {
        event.preventDefault();
        heldOpen = true;
        openSheet();
      } else if (event.key === "Tab") {
        event.preventDefault();
      } else if ((event.key === "s" || event.key === "S") && !event.repeat) {
        setIsSheetOpen((open) => !open);
        setSeenRounds(state.history.length);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Tab" && heldOpen) {
        heldOpen = false;
        setIsSheetOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [openSheet, state.history.length]);

  const sheetPlayers: SheetPlayer[] = [me, ...opponents].map((player) => ({
    userId: player.userId,
    username: player.username,
    avatarUrl: player.avatarUrl,
    seat: seatOf[player.userId],
  }));
  const schedule = roundSchedule(game.players.length);

  // DIALOGS

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [kickTarget, setKickTarget] = useState<GamePlayer | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogPending, setIsDialogPending] = useState(false);

  const runDialog = async (action: () => Promise<unknown>, close: () => void) => {
    setIsDialogPending(true);
    setDialogError(null);
    try {
      await action();
      close();
    } catch (reason) {
      setDialogError(getErrorMessage(reason));
    } finally {
      setIsDialogPending(false);
    }
  };

  // Leaving the page detaches this tab from the table (see GamePage).
  const leave = () => navigate("/");

  const playAgain = () =>
    runDialog(
      async () => {
        const room = await createRoom(game.roomName);
        navigate(`/rooms/${room.id}`);
      },
      () => {},
    );

  const isHost = game.hostId === meId && !isFinished;
  const kickable = game.players.filter((player) => player.userId !== meId && !player.isKicked);

  // THE BOTTOM BAR'S ACTION

  const waitingFor = names[state.turnId ?? ""] ?? "…";
  const othersTotal = Object.entries(state.bids)
    .filter(([userId]) => userId !== meId)
    .reduce((sum, [, bid]) => sum + (bid ?? 0), 0);

  let action;
  if (isActing && !isOnline) {
    // Every action waits for the connection.
    action = <Waiting disabled>Reconnecting…</Waiting>;
  } else if (isMyBid) {
    action = (
      <BidPicker
        key={state.roundNumber}
        cardsPerPlayer={state.cardsPerPlayer}
        trump={state.trumpSuit}
        othersTotal={othersTotal}
        width={layout.bottom.centre.w}
        u={layout.u}
        isPending={isPending}
        onBid={placeBid}
      />
    );
  } else if (isMyPlay) {
    action = (
      <PrimaryButton
        type="button"
        disabled={!selectedCard || isPending}
        onClick={() => selectedCard && playCard(selectedCard)}
      >
        {selectedCard ? `Play ${cardLabel(selectedCard)}` : "Select a card"}
      </PrimaryButton>
    );
  } else if (state.phase === PodridaPhase.playing) {
    action = <Waiting disabled>Waiting for {waitingFor}…</Waiting>;
  } else if (state.phase === PodridaPhase.bidding) {
    action = <Waiting disabled>Waiting for {waitingFor}'s bid…</Waiting>;
  } else {
    action = null; // Between tricks, scoring: the column stays, empty.
  }

  const emptyTrickLabel =
    state.leaderId === meId ? "Your lead" : `${names[state.leaderId ?? ""] ?? "Someone"} leads`;
  const arrowTarget =
    state.turnId && (state.phase === PodridaPhase.bidding || state.phase === PodridaPhase.playing)
      ? slots[state.turnId]
      : null;

  return (
    <Frame
      ref={frameRef}
      className="podrida-game"
      style={{ "--u": layout.u, "--speed": settings.fastAnimations ? 0.6 : 1 } as CSSProperties}
    >
      <TopBar
        game={game}
        box={layout.topBar}
        subtitle={`Classic Podrida · ${game.players.length} players`}
        actions={
          <>
            <IconButton
              label="Score sheet (hold Tab, or S)"
              onClick={openSheet}
              hasDot={state.history.length > seenRounds}
            >
              <ScoreboardIcon />
            </IconButton>
            <IconButton
              label={soundOn ? "Mute sounds" : "Turn sounds on"}
              onClick={() => updateSettings({ sound: !soundOn })}
              aria-pressed={!soundOn}
            >
              <SoundIcon muted={!soundOn} />
            </IconButton>
            <IconButton
              label="Settings"
              active={isSettingsOpen}
              data-settings-toggle
              onClick={() => setIsSettingsOpen((open) => !open)}
            >
              <SettingsIcon />
            </IconButton>
            <IconButton label="Leave the table" align="right" onClick={() => setIsLeaving(true)}>
              <LeaveIcon />
            </IconButton>
          </>
        }
      />

      {!isOnline && (
        <ConnectionBanner role="status" style={{ top: layout.topBar.h }}>
          Connection lost — reconnecting…
        </ConnectionBanner>
      )}

      {isSettingsOpen && (
        <SettingsPopover
          settings={settings}
          onChange={updateSettings}
          onClose={() => setIsSettingsOpen(false)}
          host={
            isHost
              ? {
                  players: kickable,
                  onKick: (player) => {
                    setDialogError(null);
                    setKickTarget(player);
                  },
                  onEndGame: () => {
                    setDialogError(null);
                    setIsEnding(true);
                  },
                }
              : null
          }
        />
      )}

      {opponents.map((player, index) => (
        <OpponentSeat
          key={player.userId}
          player={player}
          seat={seatOf[player.userId]}
          box={layout.seats[index].content}
          u={layout.u}
          back={layout.backCard}
          points={state.totals[player.userId] ?? 0}
          hasCards={(state.handCounts[player.userId] ?? 0) > 0}
          bid={state.bids[player.userId] ?? null}
          won={wonShown(player.userId)}
          activity={activityOf(player.userId)}
          isDealer={state.dealerId === player.userId}
          isLeader={state.leaderId === player.userId && !isFinished}
          flash={flashOf(player.userId)}
        />
      ))}

      {/* THE CENTRE BLOCK: cards, then the last action, the heading and the hint. */}
      {/* The round summary takes the whole cards row once the round is over. */}
      {state.phase !== PodridaPhase.scoring && (
        <TrumpSlot card={state.trumpCard} suit={state.trumpSuit} layout={layout} />
      )}

      {state.phase === PodridaPhase.scoring && lastRecord ? (
        <RoundSummary
          key={lastRecord.number}
          record={lastRecord}
          game={game}
          seats={seatOf}
          endsAt={state.phaseEndsAt}
          layout={layout}
          onOpenSheet={openSheet}
        />
      ) : state.phase !== PodridaPhase.finished && state.phase !== PodridaPhase.dealing ? (
        <TrickArea
          ref={trickRef}
          trick={state.trick}
          trump={state.trumpSuit}
          layout={layout}
          emptyLabel={emptyTrickLabel}
          names={names}
          origins={origins}
          winnerId={state.trickWinnerId}
          holdMs={1200}
          drop={isMyPlay ? drop : "none"}
        />
      ) : null}

      <LastAction text={lastActionText(game, meId)} box={layout.lastAction} />
      <StatusHeading
        heading={status.heading}
        hint={settings.ruleHints ? status.hint : ""}
        error={error}
        layout={layout}
      />

      <TurnArrow target={arrowTarget} centre={layout.centrePoint} size={layout.mySlot.w} />

      <OwnBidStrip
        box={layout.bidStrip}
        bid={state.bids[meId] ?? null}
        won={wonShown(meId)}
        isBidding={isMyBid}
        flash={flashOf(meId)}
      />

      <Hand
        cards={handCards}
        layout={layout}
        playable={isOnline ? playable : null}
        showUnplayable={isMyPlay}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onPlay={playCard}
        doubleClickToPlay={settings.doubleClickToPlay}
        roundNumber={state.roundNumber}
        isDealing={state.phase === PodridaPhase.dealing}
        isMyTurn={isMyTurn}
        dropZone={trickRef}
        onDropHover={setDrop}
      />

      <BottomBar
        layout={layout}
        me={me}
        seat={myIndex}
        points={state.totals[meId] ?? 0}
        isMyTurn={isMyTurn}
        isDealer={state.dealerId === meId}
        isLeader={state.leaderId === meId && !isFinished}
        action={action}
        sortMode={settings.sortMode}
        onSort={(sortMode) => updateSettings({ sortMode })}
      />

      {debug && <LayoutDebug layout={layout} root={frameRef} />}

      <ScoreSheet
        isOpen={isSheetOpen || isFinished}
        onClose={closeSheet}
        subtitle={`Round ${state.roundNumber} of ${state.roundCount} · ${game.players.length} players`}
        players={sheetPlayers}
        meId={meId}
        schedule={schedule}
        history={state.history}
        current={
          isFinished
            ? null
            : {
                roundNumber: state.roundNumber,
                trumpSuit: state.trumpSuit,
                dealerId: state.dealerId,
                bids: state.bids,
                tricksWon: state.tricksWon,
              }
        }
        totals={state.totals}
        gameOver={
          isFinished
            ? {
                onPlayAgain: playAgain,
                onLeave: () => navigate("/"),
                isPending: isDialogPending,
                error: dialogError && <p style={{ color: g.danger, margin: 0 }}>{dialogError}</p>,
              }
            : undefined
        }
      />

      {isLeaving && (
        <ConfirmDialog
          title="Leave the game?"
          body="You'll be marked as disconnected. The game waits for you on your turn, and you can come back from the lobby."
          cancelLabel="Stay"
          confirmLabel="Leave"
          onCancel={() => setIsLeaving(false)}
          onConfirm={leave}
        />
      )}

      {isEnding && (
        <ConfirmDialog
          title="End the game for everyone?"
          body="The game stops here for all the players and can't be picked up again. The rounds played so far are kept."
          cancelLabel="Keep playing"
          confirmLabel="End game"
          isPending={isDialogPending}
          error={dialogError && <p style={{ color: g.danger, marginTop: 10 }}>{dialogError}</p>}
          onCancel={() => setIsEnding(false)}
          onConfirm={() => runDialog(endGame, () => setIsEnding(false))}
        />
      )}

      {kickTarget && (
        <ConfirmDialog
          title={`Kick ${kickTarget.username}?`}
          body="They're taken out of the game and can't come back to it. Their seat stays and plays itself: it bids 0 and plays its lowest card."
          cancelLabel="Cancel"
          confirmLabel="Kick"
          isPending={isDialogPending}
          error={dialogError && <p style={{ color: g.danger, marginTop: 10 }}>{dialogError}</p>}
          onCancel={() => setKickTarget(null)}
          onConfirm={() =>
            runDialog(
              () => kickPlayer(kickTarget.userId),
              () => setKickTarget(null),
            )
          }
        />
      )}
    </Frame>
  );
}
