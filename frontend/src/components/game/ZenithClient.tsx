'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { connectSocket, disconnectSocket, getSocket, resetSocket } from '@/lib/socket';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameCanvas } from '@/components/game/GameCanvas';
import { NextQueue } from '@/components/game/NextQueue';
import { HoldBox } from '@/components/game/HoldBox';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import { GameUnderBoardBar } from '@/components/game/GameUnderBoardBar';
import { OpponentCanvas } from '@/components/game/OpponentCanvas';
import { ZenithLeaderboard, ZenithEntry } from '@/components/game/ZenithLeaderboard';
import { AltitudeMeter } from '@/components/game/AltitudeMeter';
import { Button } from '@/components/ui/Button';
import { useHoldEscToHub } from '@/hooks/useHoldEscToHub';
import { HoldEscOverlay } from '@/components/game/HoldEscOverlay';
import { GamePlayfield } from '@/components/game/GamePlayfield';
import { usePlayfieldCellSize } from '@/hooks/usePlayfieldCellSize';
import { BOARD_HEIGHT } from '@/lib/game/constants';

type Phase = 'idle' | 'queued' | 'waiting' | 'countdown' | 'playing' | 'ended';

interface ReviveMission {
  partnerUserId: string;
  partnerUsername: string;
  linesNeeded: number;
  linesCleared: number;
}

interface Props {
  currentUserId: string | null;
  subMode: 'open' | 'solo' | 'duo';
}

const BOARD_SYNC_MS = 120;

// Team colour cycling for duo mode
const TEAM_COLOURS: Record<string, string> = {
  A: 'text-cyan-400',
  B: 'text-pink-400',
  C: 'text-green-400',
  D: 'text-yellow-400',
  E: 'text-purple-400',
};

export function ZenithClient({ currentUserId, subMode }: Props) {
  const cellSize = usePlayfieldCellSize();
  const playfieldRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ZenithEntry[]>([]);
  const [myAltitude, setMyAltitude] = useState(0);
  const [opponentBoards, setOpponentBoards] = useState<Map<string, number[][]>>(new Map());
  const [opponentNames, setOpponentNames] = useState<Map<string, string>>(new Map());
  const [banner, setBanner] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [waitSeconds, setWaitSeconds] = useState(15);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [reviveMission, setReviveMission] = useState<ReviveMission | null>(null);
  const [waitingForRevive, setWaitingForRevive] = useState(false);
  const topOutSent = useRef(false);
  const lastBoardEmit = useRef(0);
  const joinedOnce = useRef(false);

  const escOpts = { onBeforeNavigate: () => { getSocket().emit('leave_room'); disconnectSocket(); } };
  const escProgress = useHoldEscToHub(phase !== 'idle', escOpts);

  const { gameState, isFinished, finalState, startGame, engineRef, receiveGarbage } = useGameEngine(
    { type: 'versus', linesPerLevel: 60, maxLevel: 5 },
    {
      onGarbageSend: (lines) => {
        const s = getSocket();
        if (s.connected) {
          s.emit('zenith_clear', { linesCleared: gameState?.lastClear?.linesCleared ?? 0, attack: lines });
          s.emit('board_update', { board: gameState?.board?.map((r) => [...r]) ?? [] });
        }
      },
      onStateTick: (state) => {
        const now = performance.now();
        if (now - lastBoardEmit.current < BOARD_SYNC_MS) return;
        lastBoardEmit.current = now;
        const s = getSocket();
        if (s.connected) s.emit('board_update', { board: state.board.map((r) => [...r]) });
      },
    }
  );

  const startGameRef = useRef(startGame);
  const receiveGarbageRef = useRef(receiveGarbage);
  useLayoutEffect(() => { startGameRef.current = startGame; });
  useLayoutEffect(() => { receiveGarbageRef.current = receiveGarbage; });

  useEffect(() => {
    if (phase === 'playing') playfieldRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Top-out detection
  useEffect(() => {
    if (!isFinished || !finalState?.isGameOver || topOutSent.current) return;
    topOutSent.current = true;
    const s = getSocket();
    if (s.connected) {
      if (subMode === 'duo') {
        s.emit('zenith_top_out');
        setWaitingForRevive(true);
      } else {
        s.emit('zenith_top_out');
      }
    }
  }, [isFinished, finalState, subMode]);

  const joinQueue = useCallback(() => {
    if (joinedOnce.current) return;
    joinedOnce.current = true;
    topOutSent.current = false;
    lastBoardEmit.current = 0;
    resetSocket();
    const socket = getSocket();
    connectSocket();
    setPhase('queued');

    const onConnect = () => {
      socket.emit('join_zenith', { subMode });
    };

    const onRoomJoined = (payload: {
      roomId: string;
      room: { players: { userId: string; username: string }[]; maxPlayers?: number; status: string; teams?: Record<string, string> };
    }) => {
      const names = new Map<string, string>();
      payload.room.players.forEach((p) => names.set(p.userId, p.username));
      setOpponentNames(names);
      setPlayerCount(payload.room.players.length);
      setMaxPlayers(payload.room.maxPlayers ?? 10);
      if (payload.room.teams) setTeams(payload.room.teams);
      // If joining a game in progress, stay queued — game_start will arrive immediately
      if (payload.room.status !== 'playing') setPhase('waiting');
    };

    const onRoomUpdate = (room: {
      players: { userId: string; username: string; alive: boolean }[];
      status: string;
      maxPlayers?: number;
      altitude?: Record<string, number>;
      teams?: Record<string, string>;
    }) => {
      const names = new Map<string, string>();
      room.players.forEach((p) => names.set(p.userId, p.username));
      setOpponentNames(names);
      setPlayerCount(room.players.length);
      if (room.maxPlayers) setMaxPlayers(room.maxPlayers);
      if (room.teams) setTeams(room.teams);
      if (room.status === 'playing') setPhase('playing');
      else if (room.status === 'countdown') setPhase('countdown');
      else if (room.status === 'waiting') setPhase('waiting');
    };

    const onTeams = (t: Record<string, string>) => {
      setTeams(t);
    };

    const onCountdown = (p: { count: number }) => {
      setPhase('countdown');
      setCount(p.count);
    };

    const onGameStart = () => {
      setCount(null);
      setPhase('playing');
      setOpponentBoards(new Map());
      topOutSent.current = false;
      setWaitingForRevive(false);
      setReviveMission(null);
      startGameRef.current();
    };

    const onZenithGarbage = (p: { to: string; lines: number; from: string }) => {
      if (p.to === currentUserId) {
        receiveGarbageRef.current(p.lines);
      }
    };

    const onOppBoard = (p: { userId?: string; board?: number[][] }) => {
      if (p?.board && p?.userId && p.userId !== currentUserId) {
        setOpponentBoards((prev) => {
          const next = new Map(prev);
          next.set(p.userId!, p.board!);
          return next;
        });
      }
    };

    const onLeaderboard = (entries: ZenithEntry[]) => {
      setLeaderboard(entries);
      const me = entries.find((e) => e.userId === currentUserId);
      if (me) setMyAltitude(me.altitude);
    };

    const onKo = (p: { userId: string; username: string; altitude: number }) => {
      if (p.userId === currentUserId) {
        setBanner(`You reached ${Math.round(p.altitude)}m`);
      }
    };

    // Duo: partner was KO'd — start revive mission
    const onPartnerKo = (p: {
      ko_userId: string;
      ko_username: string;
      reviver_userId: string;
      linesNeeded: number;
    }) => {
      if (p.reviver_userId === currentUserId) {
        setReviveMission({
          partnerUserId: p.ko_userId,
          partnerUsername: p.ko_username,
          linesNeeded: p.linesNeeded,
          linesCleared: 0,
        });
      }
    };

    // Duo: revive mission progress update
    const onReviveProgress = (p: { reviverUserId: string; linesCleared: number; linesNeeded: number }) => {
      if (p.reviverUserId === currentUserId) {
        setReviveMission((prev) =>
          prev ? { ...prev, linesCleared: p.linesCleared, linesNeeded: p.linesNeeded } : prev
        );
      }
    };

    // Duo: someone was revived
    const onRevive = (p: { revivedUserId: string; reviverUserId: string; reviverUsername: string }) => {
      if (p.revivedUserId === currentUserId) {
        // I got revived — restart game engine
        topOutSent.current = false;
        setWaitingForRevive(false);
        setReviveMission(null);
        setBanner(null);
        startGameRef.current();
      } else if (p.reviverUserId === currentUserId) {
        // I revived my partner
        setReviveMission(null);
        setBanner(`${p.revivedUserId === currentUserId ? 'You are' : p.revivedUserId} revived!`);
        setTimeout(() => setBanner(null), 2000);
      }
    };

    const onGameOver = (p: {
      winner?: string | null;
      winnerUsername?: string | null;
      leaderboard?: ZenithEntry[];
    }) => {
      engineRef.current?.stop();
      setPhase('ended');
      setWaitingForRevive(false);
      setReviveMission(null);
      if (p.leaderboard) setLeaderboard(p.leaderboard);
      if (p.winner === currentUserId) {
        setBanner('You win! Tower cleared!');
      } else if (p.winnerUsername) {
        setBanner(`${p.winnerUsername} reached the top!`);
      } else {
        setBanner('Game over');
      }
    };

    socket.on('connect', onConnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('zenith_teams', onTeams);
    socket.on('countdown', onCountdown);
    socket.on('game_start', onGameStart);
    socket.on('zenith_garbage', onZenithGarbage);
    socket.on('opponent_board', onOppBoard);
    socket.on('zenith_leaderboard', onLeaderboard);
    socket.on('zenith_ko', onKo);
    socket.on('zenith_partner_ko', onPartnerKo);
    socket.on('zenith_revive_progress', onReviveProgress);
    socket.on('zenith_revive', onRevive);
    socket.on('zenith_game_over', onGameOver);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit('leave_room');
      socket.off('connect', onConnect);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('zenith_teams', onTeams);
      socket.off('countdown', onCountdown);
      socket.off('game_start', onGameStart);
      socket.off('zenith_garbage', onZenithGarbage);
      socket.off('opponent_board', onOppBoard);
      socket.off('zenith_leaderboard', onLeaderboard);
      socket.off('zenith_ko', onKo);
      socket.off('zenith_partner_ko', onPartnerKo);
      socket.off('zenith_revive_progress', onReviveProgress);
      socket.off('zenith_revive', onRevive);
      socket.off('zenith_game_over', onGameOver);
      disconnectSocket();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-join on mount
  useEffect(() => {
    joinQueue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown for waiting room
  useEffect(() => {
    if (phase !== 'waiting') return;
    setWaitSeconds(15);
    const iv = setInterval(() => setWaitSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Derived duo info
  const myTeamId = teams[currentUserId ?? ''];
  const partner = myTeamId
    ? leaderboard.find((e) => teams[e.userId] === myTeamId && e.userId !== currentUserId)
    : null;

  // Pick a random alive opponent to show
  const aliveOpponents = leaderboard.filter((e) => e.alive && e.userId !== currentUserId);
  const shownOpponentId = aliveOpponents[0]?.userId ?? null;
  const shownBoard = shownOpponentId ? opponentBoards.get(shownOpponentId) ?? null : null;
  const shownName = shownOpponentId ? (opponentNames.get(shownOpponentId) ?? 'Opponent') : 'Opponent';

  const smallCell = Math.max(10, Math.floor(cellSize * 0.55));

  const subModeLabel =
    subMode === 'solo' ? 'Solo Climb' : subMode === 'duo' ? 'Duo' : 'Quick Play';

  return (
    <div className="relative w-full max-w-6xl text-white">
      <HoldEscOverlay progress={escProgress} />

      {/* Banners */}
      {banner && phase === 'ended' && (
        <div className="mb-4 rounded border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm text-orange-200">
          {banner}
        </div>
      )}

      {/* Countdown overlay */}
      {phase === 'countdown' && count !== null && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="text-8xl font-black text-orange-400 drop-shadow-[0_0_40px_rgba(251,146,60,0.6)]">
            {count > 0 ? count : 'GO!'}
          </div>
        </div>
      )}

      {/* Waiting lobby */}
      {(phase === 'waiting' || phase === 'queued') && (
        <div className="flex flex-col items-center gap-6 py-16">
          <div className="text-4xl">🏰</div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-orange-400">{subModeLabel}</h2>

          {subMode === 'solo' ? (
            <p className="text-sm text-zinc-400">Starting…</p>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                {playerCount} / {maxPlayers} players · starts in {waitSeconds}s
              </p>
              <div className="w-48 overflow-hidden rounded-full border border-orange-500/30 bg-zinc-900">
                <div
                  className="h-2 bg-gradient-to-r from-orange-600 to-yellow-400 transition-all duration-1000"
                  style={{ width: `${((15 - waitSeconds) / 15) * 100}%` }}
                />
              </div>
              <div className="flex flex-col gap-1 text-center text-xs text-zinc-500">
                {[...opponentNames.values()].map((name, i) => (
                  <span key={i}>{name}</span>
                ))}
              </div>
            </>
          )}

          <Button
            variant="ghost"
            onClick={() => { getSocket().emit('leave_room'); disconnectSocket(); window.location.href = '/play/zenith'; }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* End screen */}
      {phase === 'ended' && (
        <div className="flex flex-col items-center gap-6 py-10">
          <h2 className="text-3xl font-black uppercase text-orange-400">Match Over</h2>
          <div className="w-full max-w-xs rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
            <ZenithLeaderboard entries={leaderboard} myUserId={currentUserId} playerCount={playerCount} maxPlayers={maxPlayers} />
          </div>
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => window.location.reload()}>Play Again</Button>
            <Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link>
          </div>
        </div>
      )}

      {/* Active game */}
      {(phase === 'playing' || (phase === 'ended' && gameState)) && gameState && (
        <GamePlayfield playfieldRef={playfieldRef}>

          {/* Revive mission banner (duo — I need to revive partner) */}
          {reviveMission && (
            <div className="mb-3 w-full rounded-xl border border-cyan-500/40 bg-cyan-900/20 px-4 py-3">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-cyan-300">
                REVIVE {reviveMission.partnerUsername} — clear {reviveMission.linesNeeded - reviveMission.linesCleared} more lines
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-cyan-400 transition-all duration-200"
                  style={{ width: `${(reviveMission.linesCleared / reviveMission.linesNeeded) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Waiting for revive overlay (duo — I died, waiting) */}
          {waitingForRevive && isFinished && phase === 'playing' && (
            <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <p className="text-2xl font-black text-cyan-300">Waiting for revive…</p>
                <p className="mt-2 text-sm text-zinc-400">Your partner is clearing lines to bring you back</p>
              </div>
            </div>
          )}

          <div className="flex w-full items-start justify-center gap-3">

            {/* Left: Hold + Altitude + Duo partner info + opponent mini-boards */}
            <div className="flex flex-col items-end gap-3 pt-2">
              <HoldBox heldPiece={gameState.heldPiece} canHold={gameState.canHold} />
              <AltitudeMeter altitude={myAltitude} heightPx={BOARD_HEIGHT * cellSize - 80} />

              {/* Duo: partner status */}
              {subMode === 'duo' && partner && (
                <div className={`flex flex-col items-end gap-0.5 rounded-lg border px-2 py-1.5 text-right text-xs ${
                  partner.alive ? 'border-cyan-700/40 bg-cyan-900/20' : 'border-zinc-700/40 bg-zinc-900/40 opacity-60'
                }`}>
                  <span className={`font-bold ${TEAM_COLOURS[myTeamId ?? ''] ?? 'text-white'}`}>
                    {partner.username}
                  </span>
                  <span className="font-mono text-[0.6rem] text-orange-300">{Math.round(partner.altitude)}m</span>
                  {!partner.alive && <span className="text-[0.55rem] uppercase text-red-400">KO'd</span>}
                  {partner.alive && <span className="text-[0.55rem] uppercase text-cyan-400">Alive</span>}
                </div>
              )}

              {/* Mini opponent boards */}
              <div className="mt-2 flex flex-col gap-2">
                {[...opponentBoards.entries()]
                  .filter(([uid]) => uid !== currentUserId)
                  .slice(0, 4)
                  .map(([uid, board]) => (
                    <OpponentCanvas
                      key={uid}
                      board={board}
                      cellSize={Math.max(6, Math.floor(cellSize * 0.28))}
                      label={opponentNames.get(uid) ?? '?'}
                      eliminated={!leaderboard.find((e) => e.userId === uid)?.alive}
                    />
                  ))}
              </div>
            </div>

            {/* Center: garbage meter + board */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex w-max flex-row items-stretch overflow-hidden rounded-sm shadow-lg shadow-black/40">
                <GarbageMeter lines={gameState.garbageQueue} pending={gameState.pendingGarbage} buffered={gameState.bufferedGarbage} heightPx={BOARD_HEIGHT * cellSize} />
                <GameCanvas
                  gameState={gameState}
                  cellSize={cellSize}
                  suppressGameOverOverlay={phase === 'ended' || waitingForRevive}
                />
                {isFinished && phase === 'playing' && !waitingForRevive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/75">
                    <p className="text-lg font-bold text-red-400">KO'd at {Math.round(myAltitude)}m</p>
                  </div>
                )}
              </div>
              <GameUnderBoardBar gameState={gameState} modeLabel={subModeLabel} />
            </div>

            {/* Right: Next queue + current targeted opponent + leaderboard */}
            <div className="flex flex-col gap-3 pt-2">
              <NextQueue queue={gameState.nextQueue} />
              {shownOpponentId && (
                <OpponentCanvas
                  board={shownBoard}
                  cellSize={smallCell}
                  label={shownName}
                  eliminated={!aliveOpponents[0]?.alive}
                />
              )}
              <ZenithLeaderboard
                entries={leaderboard}
                myUserId={currentUserId}
                playerCount={playerCount}
                maxPlayers={maxPlayers}
              />
            </div>
          </div>
        </GamePlayfield>
      )}
    </div>
  );
}
