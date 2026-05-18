'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { OpponentCanvas } from '@/components/game/OpponentCanvas';
import { useAuthStore } from '@/store/authStore';
import { connectSocket, disconnectSocket, getSocket, resetSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';

interface SpectatePlayer {
  userId: string;
  username: string;
  alive: boolean;
  altitude: number;
  board?: number[][];
}

export default function SpectatePage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoom = searchParams.get('room') ?? '';

  const [roomCode, setRoomCode] = useState(initialRoom.toUpperCase());
  const [players, setPlayers] = useState<SpectatePlayer[]>([]);
  const [status, setStatus] = useState<'idle' | 'spectating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (initialRoom && user && !connectedRef.current) {
      connectedRef.current = true;
      startSpectating(initialRoom.toUpperCase());
    }
  }, [initialRoom, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSpectating = (code: string) => {
    resetSocket();
    const socket = getSocket();
    connectSocket();

    const onConnect = () => {
      socket.emit('spectate_room', { roomId: code });
    };

    const onInit = (data: { players: SpectatePlayer[]; status: string; mode: string }) => {
      setPlayers(data.players.map((p) => ({ ...p, board: undefined })));
      setStatus('spectating');
    };

    const onOppBoard = (p: { userId?: string; board?: number[][] }) => {
      if (!p.userId || !p.board) return;
      setPlayers((prev) =>
        prev.map((pl) => (pl.userId === p.userId ? { ...pl, board: p.board! } : pl))
      );
    };

    const onLeaderboard = (entries: { userId: string; altitude: number; alive: boolean }[]) => {
      setPlayers((prev) =>
        prev.map((pl) => {
          const e = entries.find((x) => x.userId === pl.userId);
          return e ? { ...pl, altitude: e.altitude, alive: e.alive } : pl;
        })
      );
    };

    const onKo = (p: { userId: string }) => {
      setPlayers((prev) =>
        prev.map((pl) => (pl.userId === p.userId ? { ...pl, alive: false } : pl))
      );
    };

    const onPlayerElim = (p: { userId: string }) => {
      setPlayers((prev) =>
        prev.map((pl) => (pl.userId === p.userId ? { ...pl, alive: false } : pl))
      );
    };

    const onError = (p: { message?: string }) => {
      setErrorMsg(p.message ?? 'Room not found');
      setStatus('error');
      disconnectSocket();
    };

    socket.on('connect', onConnect);
    socket.on('spectate_init', onInit);
    socket.on('opponent_board', onOppBoard);
    socket.on('zenith_leaderboard', onLeaderboard);
    socket.on('zenith_ko', onKo);
    socket.on('player_eliminated', onPlayerElim);
    socket.on('spectate_error', onError);

    if (socket.connected) onConnect();
    else socket.connect();
  };

  const stopSpectating = () => {
    getSocket().emit('stop_spectating');
    disconnectSocket();
    setStatus('idle');
    setPlayers([]);
    setFocusedId(null);
  };

  if (isLoading || !user) return null;

  const focused = focusedId ? players.find((p) => p.userId === focusedId) : null;

  return (
    <div className="min-h-screen bg-[#0a0608] text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-orange-400">Quick Play</p>
            <h1 className="text-3xl font-black tracking-tight">Spectate</h1>
          </div>
          <div className="flex gap-2">
            {status === 'spectating' && (
              <Button variant="ghost" onClick={stopSpectating}>Stop Watching</Button>
            )}
            <Link href="/play/zenith"><Button variant="secondary">Play</Button></Link>
          </div>
        </div>

        {/* Join form */}
        {status === 'idle' && (
          <div className="mx-auto max-w-sm">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <h2 className="mb-4 text-lg font-bold">Watch a room</h2>
              <Input
                label="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="mb-4 font-mono uppercase"
              />
              <Button
                variant="primary"
                className="w-full"
                disabled={roomCode.trim().length < 4}
                onClick={() => startSpectating(roomCode.trim())}
              >
                Watch
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMsg}
            <button onClick={() => setStatus('idle')} className="ml-4 underline">Try again</button>
          </div>
        )}

        {/* Focused view */}
        {status === 'spectating' && focused && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setFocusedId(null)} className="text-sm text-zinc-500 hover:text-white">← All</button>
              <span className="font-bold text-white">{focused.username}</span>
              <span className="text-sm text-orange-300">{Math.round(focused.altitude)}m</span>
              {!focused.alive && <span className="text-xs text-red-400">ELIMINATED</span>}
            </div>
            <OpponentCanvas board={focused.board ?? null} cellSize={28} label={focused.username} eliminated={!focused.alive} />
          </div>
        )}

        {/* Grid of all boards */}
        {status === 'spectating' && !focused && (
          <>
            <p className="mb-3 text-xs text-zinc-500">{players.length} players · click to focus</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {[...players]
                .sort((a, b) => b.altitude - a.altitude)
                .map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => setFocusedId(p.userId)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 text-left transition-colors hover:border-orange-500/40"
                  >
                    <div className="flex w-full items-center justify-between px-1">
                      <span className="text-xs font-bold text-white truncate max-w-[80px]">{p.username}</span>
                      <span className="text-[0.6rem] text-orange-300 font-mono">{Math.round(p.altitude)}m</span>
                    </div>
                    <OpponentCanvas board={p.board ?? null} cellSize={14} label="" eliminated={!p.alive} />
                  </button>
                ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
