'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { connectSocket, disconnectSocket, getSocket, resetSocket } from '@/lib/socket';
import { useGameEngine } from '@/hooks/useGameEngine';
import type { GameState } from '@/lib/game/types';
import { GameCanvas } from '@/components/game/GameCanvas';
import { NextQueue } from '@/components/game/NextQueue';
import { HoldBox } from '@/components/game/HoldBox';
import { GameHUD } from '@/components/game/GameHUD';
import { OpponentCanvas } from '@/components/game/OpponentCanvas';
import { Button } from '@/components/ui/Button';
import { useHoldEscToHub } from '@/hooks/useHoldEscToHub';
import { HoldEscOverlay } from '@/components/game/HoldEscOverlay';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import { GameUnderBoardBar } from '@/components/game/GameUnderBoardBar';
import { BOARD_HEIGHT } from '@/lib/game/constants';
import { usePlayfieldCellSize } from '@/hooks/usePlayfieldCellSize';
import { GamePlayfield } from '@/components/game/GamePlayfield';

export type VersusMode = 'ranked' | 'custom' | 'league';
export type VersusStart = 'queue' | 'create' | 'join';

export type SanitizedRoom = {
  id: string;
  mode: string;
  status: string;
  roomCode?: string;
  series?: {
    bestOf: number;
    targetWins: number;
    wins: Record<string, number>;
  };
  players: { userId: string; username: string; ready: boolean; alive: boolean; rating: number }[];
};

type Phase =
  | 'idle'
  | 'connecting'
  | 'queued'
  | 'room'
  | 'countdown'
  | 'playing'
  | 'ended';

type Props = {
  mode: VersusMode;
  startWith: VersusStart;
  joinCode?: string;
  currentUserId: string | null;
};

const BOARD_SYNC_MS = 120;

export function VersusClient({ mode, startWith, joinCode, currentUserId }: Props) {
  const cellSize = usePlayfieldCellSize();
  const playfieldRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [room, setRoom] = useState<SanitizedRoom | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [opponentBoard, setOpponentBoard] = useState<number[][] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [roomCodeShown, setRoomCodeShown] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [seriesBanner, setSeriesBanner] = useState<string | null>(null);
  const topOutSent = useRef(false);
  const lastBoardEmit = useRef(0);
  const joinedOnce = useRef(false);
  const propsRef = useRef({ mode, startWith, joinCode });
  propsRef.current = { mode, startWith, joinCode };

  const escOpts = useMemo(
    () => ({
      onBeforeNavigate: () => {
        const s = getSocket();
        if (s.connected) s.emit('leave_room');
        disconnectSocket();
      },
    }),
    []
  );
  const escProgress = useHoldEscToHub(phase !== 'idle', escOpts);

  const { gameState, isFinished, finalState, startGame, engineRef, receiveGarbage } = useGameEngine(
    { type: 'versus' },
    {
      onGarbageSend: (lines) => {
        const s = getSocket();
        if (s.connected) s.emit('send_attack', { lines });
      },
      onStateTick: (state: GameState) => {
        const now = performance.now();
        if (now - lastBoardEmit.current < BOARD_SYNC_MS) return;
        lastBoardEmit.current = now;
        const s = getSocket();
        if (!s.connected) return;
        const board = state.board.map((row) => [...row]);
        s.emit('board_update', { board });
      },
    }
  );

  const startGameRef = useRef(startGame);
  startGameRef.current = startGame;
  const receiveGarbageRef = useRef(receiveGarbage);
  receiveGarbageRef.current = receiveGarbage;
  const engineRefHook = engineRef;
  const userIdRef = useRef(currentUserId);
  userIdRef.current = currentUserId;
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (phase === 'playing') playfieldRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const applyRoom = useCallback((r: SanitizedRoom) => {
    setRoom(r);
    if (r.status === 'playing') setPhase('playing');
    else if (r.status === 'finished') setPhase('ended');
    else if (r.status === 'countdown') setPhase('countdown');
    else setPhase((p) => (p === 'playing' || p === 'ended' ? p : 'room'));
  }, []);

  // Mount-only socket wiring; join intent read from propsRef
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  useEffect(() => {
    topOutSent.current = false;
    joinedOnce.current = false;
    lastBoardEmit.current = 0;
    resetSocket();
    const socket = getSocket();
    connectSocket();

    const emitJoinIntent = () => {
      if (joinedOnce.current) return;
      const { startWith: sw, joinCode: jc } = propsRef.current;
      joinedOnce.current = true;
      setPhase('connecting');
      if (sw === 'queue') {
        socket.emit('join_queue', { mode: propsRef.current.mode === 'league' ? 'league' : 'versus' });
        setPhase('queued');
      } else if (sw === 'create') {
        socket.emit('create_room', { mode: 'versus' });
      } else if (sw === 'join' && jc?.trim()) {
        socket.emit('join_room', { roomCode: jc.trim().toUpperCase() });
      }
    };

    const onConnect = () => {
      emitJoinIntent();
    };

    const onRoomJoined = (payload: { roomId: string; room: SanitizedRoom }) => {
      applyRoom(payload.room);
      setRoomCodeShown(payload.room.roomCode ?? payload.roomId);
      setPhase('room');
    };

    const onRoomUpdate = (r: SanitizedRoom) => {
      applyRoom(r);
    };

    const onRoomCreated = (p: { roomCode: string }) => {
      setRoomCodeShown(p.roomCode);
    };

    const onRoomError = (p: { message?: string }) => {
      setBanner(p.message ?? 'Room error');
    };

    const onCountdown = (p: { count: number }) => {
      setPhase('countdown');
      setCount(p.count);
    };

    const onGameStart = () => {
      setCount(null);
      setSeriesBanner(null);
      setPhase('playing');
      setOpponentBoard(null);
      topOutSent.current = false;
      startGameRef.current();
    };

    const onGarbage = (p: { lines?: number }) => {
      const n = Math.floor(Number(p?.lines) || 0);
      if (n > 0) receiveGarbageRef.current(n);
    };

    const onOppBoard = (p: { board?: number[][] }) => {
      if (p?.board) setOpponentBoard(p.board);
    };

    const onGameOver = (p: {
      winner?: string | null;
      winnerUsername?: string | null;
      reason?: string;
      ratingDelta?: number | null;
    }) => {
      engineRefHook.current?.stop();
      setPhase('ended');
      if (p.reason === 'opponent_disconnected') {
        setBanner('Opponent disconnected');
      } else if (p.winner) {
        setWinnerId(p.winner);
        const uid = userIdRef.current;
        const base = p.winner === uid ? 'You win!' : `Winner: ${p.winnerUsername ?? 'Opponent'}`;
        const elo = typeof p.ratingDelta === 'number' ? ` (ELO ${p.winner === uid ? '+' : '-'}${p.ratingDelta})` : '';
        setBanner(`${base}${elo}`);
      } else {
        setBanner('Match ended');
      }
    };

    const onSeriesUpdate = (p: {
      mode?: string;
      bestOf?: number;
      targetWins?: number;
      wins?: Record<string, number>;
      roundWinner?: string;
    }) => {
      if (p.mode !== 'league' || !p.wins) return;
      const meId = userIdRef.current ?? '';
      const myWins = p.wins[meId] ?? 0;
      const oppId = roomRef.current?.players.find((x) => x.userId !== meId)?.userId ?? '';
      const oppWins = p.wins[oppId] ?? 0;
      const result = p.roundWinner === meId ? 'You won the round' : 'Opponent won the round';
      setSeriesBanner(`${result} · BO${p.bestOf ?? 3} (${myWins}-${oppWins})`);
    };

    const onRoundOver = (p: {
      roundWinner?: string;
      bestOf?: number;
      wins?: Record<string, number>;
    }) => {
      engineRefHook.current?.stop();
      setPhase('room');
      if (!p?.wins) return;
      const meId = userIdRef.current ?? '';
      const myWins = p.wins[meId] ?? 0;
      const oppId = roomRef.current?.players.find((x) => x.userId !== meId)?.userId ?? '';
      const oppWins = p.wins[oppId] ?? 0;
      const result = p.roundWinner === meId ? 'You won the round' : 'Opponent won the round';
      setSeriesBanner(`${result} · BO${p.bestOf ?? 3} (${myWins}-${oppWins})`);
    };

    socket.on('connect', onConnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_created', onRoomCreated);
    socket.on('room_error', onRoomError);
    socket.on('countdown', onCountdown);
    socket.on('game_start', onGameStart);
    socket.on('garbage_incoming', onGarbage);
    socket.on('opponent_board', onOppBoard);
    socket.on('game_over', onGameOver);
    socket.on('series_update', onSeriesUpdate);
    socket.on('round_over', onRoundOver);

    if (socket.connected) {
      emitJoinIntent();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit('leave_room');
      socket.off('connect', onConnect);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_created', onRoomCreated);
      socket.off('room_error', onRoomError);
      socket.off('countdown', onCountdown);
      socket.off('game_start', onGameStart);
      socket.off('garbage_incoming', onGarbage);
      socket.off('opponent_board', onOppBoard);
      socket.off('game_over', onGameOver);
      socket.off('series_update', onSeriesUpdate);
      socket.off('round_over', onRoundOver);
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!isFinished || !finalState?.isGameOver || topOutSent.current) return;
    topOutSent.current = true;
    const s = getSocket();
    if (s.connected) s.emit('top_out');
  }, [isFinished, finalState]);

  const me = room?.players.find((p) => p.userId === currentUserId);
  const opp = room?.players.find((p) => p.userId !== currentUserId);

  const setReady = (ready: boolean) => {
    const s = getSocket();
    if (!s.connected) return;
    if (ready) s.emit('player_ready');
    else s.emit('player_unready');
  };

  const leaveMatch = () => {
    const s = getSocket();
    if (s.connected) s.emit('leave_room');
    disconnectSocket();
    const href = propsRef.current.mode === 'custom' ? '/multiplayer/custom' : '/multiplayer';
    window.location.href = href;
  };

  return (
    <div className="w-full max-w-6xl text-white">
      {banner && phase === 'ended' ? (
        <div className="mb-4 rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {banner}
        </div>
      ) : null}
      {seriesBanner && phase !== 'ended' ? (
        <div className="mb-4 rounded border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
          {seriesBanner}
        </div>
      ) : null}
      {banner && phase !== 'ended' && phase !== 'playing' ? (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {banner}
        </div>
      ) : null}

      {mode === 'custom' && roomCodeShown && phase === 'room' ? (
        <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Room code</p>
          <p className="font-mono text-2xl font-black tracking-widest text-white">{roomCodeShown}</p>
          <p className="mt-1 text-xs text-zinc-400">Share this code with your friend</p>
        </div>
      ) : null}

      {room && phase !== 'ended' && phase !== 'idle' ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
          <div className="text-sm text-zinc-400">
            <span className="text-zinc-500">Room </span>
            <span className="font-mono text-zinc-200">{room.id}</span>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="uppercase text-zinc-500">{room.status}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {room.players.map((p) => (
              <div
                key={p.userId}
                className={`rounded-lg border px-3 py-1 text-sm ${
                  p.userId === currentUserId ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <span className="font-semibold">{p.username}</span>
                {p.ready ? (
                  <span className="ml-2 text-xs text-green-400">READY</span>
                ) : (
                  <span className="ml-2 text-xs text-zinc-500">…</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {phase === 'countdown' && count !== null ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="text-8xl font-black text-cyan-400 drop-shadow-[0_0_30px_rgba(0,245,255,0.5)]">
            {count > 0 ? count : 'GO'}
          </div>
        </div>
      ) : null}

      {phase === 'ended' ? (
        <div className="flex flex-col items-center justify-center gap-6 py-16">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">Match over</h2>
          {winnerId && winnerId === currentUserId ? (
            <p className="text-xl font-bold text-cyan-400">Victory</p>
          ) : winnerId ? (
            <p className="text-lg text-zinc-300">Better luck next time</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Play again
            </Button>
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <Button variant="ghost" onClick={leaveMatch}>
              Leave
            </Button>
          </div>
        </div>
      ) : null}

      {room && room.players.length === 2 && room.status === 'waiting' && phase === 'room' ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setReady(true)} disabled={!!me?.ready}>
            Ready
          </Button>
          <Button variant="secondary" onClick={() => setReady(false)} disabled={!me?.ready}>
            Unready
          </Button>
          <Button variant="ghost" onClick={leaveMatch}>
            Leave lobby
          </Button>
        </div>
      ) : null}

      {(phase === 'playing' || (phase === 'ended' && gameState)) && gameState ? (
        <GamePlayfield playfieldRef={playfieldRef} className="w-full px-1 sm:px-2">
          <div className="flex flex-col items-center gap-5">
            <div className="grid w-full grid-cols-1 items-start justify-items-center gap-4 lg:grid-cols-[auto_minmax(0,auto)_auto] lg:justify-center lg:gap-4">
              <div className="flex w-full max-w-[20rem] flex-col gap-3 lg:max-w-none">
                <HoldBox heldPiece={gameState.heldPiece} canHold={gameState.canHold} />
                <OpponentCanvas
                  board={opponentBoard}
                  cellSize={Math.max(14, Math.floor(cellSize * 0.62))}
                  label={opp?.username ?? 'Opponent'}
                />
              </div>

              <div className="flex w-full max-w-[min(100vw-1rem,28rem)] flex-col items-center gap-3 sm:max-w-none">
                <div className="relative flex w-max max-w-full shrink-0 flex-row items-stretch overflow-hidden rounded-sm shadow-lg shadow-black/30">
                  <GarbageMeter lines={gameState.garbageQueue} heightPx={BOARD_HEIGHT * cellSize} />
                  <GameCanvas
                    gameState={gameState}
                    cellSize={cellSize}
                    suppressGameOverOverlay={phase === 'ended'}
                  />
                  {isFinished && phase === 'playing' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75">
                      <p className="text-xl font-bold text-red-400">You topped out</p>
                    </div>
                  ) : null}
                </div>
                <GameUnderBoardBar gameState={gameState} modeLabel="Versus" />
              </div>

              <div className="flex w-full max-w-[20rem] flex-col gap-3 sm:max-w-none lg:max-w-[min(100%,10rem)]">
                <NextQueue queue={gameState.nextQueue} />
                <GameHUD gameState={gameState} mode="versus" />
              </div>
            </div>
          </div>
        </GamePlayfield>
      ) : null}

      {phase === 'queued' || phase === 'connecting' ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-sm uppercase tracking-widest text-zinc-400">Finding opponent…</p>
          <Button variant="ghost" onClick={leaveMatch}>
            Cancel
          </Button>
        </div>
      ) : null}

      {phase === 'room' && room && room.players.length < 2 ? (
        <div className="py-12 text-center text-zinc-400">
          <p>Waiting for opponent…</p>
          <Button variant="ghost" className="mt-6" onClick={leaveMatch}>
            Cancel
          </Button>
        </div>
      ) : null}

      <HoldEscOverlay progress={escProgress} />
    </div>
  );
}
