'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { VersusClient } from '@/components/multiplayer/VersusClient';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { connectSocket, getSocket } from '@/lib/socket';

type PublicRoom = { id: string; host: string; mode: string; roomCode: string };
type View = 'lobby' | 'ranked' | 'league' | 'public_create' | 'public_join';

export default function MultiplayerPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [view, setView] = useState<View>('lobby');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const socketInitRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  // Connect socket just for the lobby room list
  useEffect(() => {
    if (!user || socketInitRef.current) return;
    socketInitRef.current = true;

    connectSocket();
    const s = getSocket();

    const onConnect = () => s.emit('request_public_rooms');
    const onRooms = (list: PublicRoom[]) => setPublicRooms(list);

    s.on('connect', onConnect);
    s.on('public_rooms', onRooms);
    if (s.connected) s.emit('request_public_rooms');

    return () => {
      s.off('connect', onConnect);
      s.off('public_rooms', onRooms);
    };
  }, [user]);

  // Disconnect lobby socket when entering a game view
  const enterView = useCallback((v: View) => {
    setView(v);
  }, []);

  const goLobby = useCallback(() => {
    socketInitRef.current = false;
    setView('lobby');
    setJoinCode(null);
  }, []);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-400">
        Loading…
      </div>
    );
  }

  // Active game views — pass to VersusClient
  if (view === 'ranked' || view === 'league') {
    return (
      <div className="min-h-screen bg-[#050508] text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-20">
          <button onClick={goLobby} className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back to lobby
          </button>
          <VersusClient
            mode={view}
            startWith="queue"
            currentUserId={user.id}
          />
        </main>
      </div>
    );
  }

  if (view === 'public_create') {
    return (
      <div className="min-h-screen bg-[#050508] text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-20">
          <button onClick={goLobby} className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back to lobby
          </button>
          <VersusClient
            mode="custom"
            startWith="create"
            isPublic
            currentUserId={user.id}
          />
        </main>
      </div>
    );
  }

  if (view === 'public_join' && joinCode) {
    return (
      <div className="min-h-screen bg-[#050508] text-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-20">
          <button onClick={goLobby} className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back to lobby
          </button>
          <VersusClient
            mode="custom"
            startWith="join"
            joinCode={joinCode}
            currentUserId={user.id}
          />
        </main>
      </div>
    );
  }

  // Lobby view
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-20">
        <div className="mb-10">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-zinc-500">Multiplayer</p>
          <h1 className="text-4xl font-black tracking-tight">Play Online</h1>
          <p className="mt-2 text-sm text-zinc-400">Ranked matches, public rooms, or private games with friends.</p>
        </div>

        {/* ── Ranked section ── */}
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Ranked Matchmaking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => enterView('ranked')}
              className="group relative overflow-hidden rounded-2xl border border-[#ff4477]/30 bg-gradient-to-br from-[#ff4477]/10 to-transparent p-6 text-left transition-all hover:border-[#ff4477]/60 hover:bg-[#ff4477]/15"
            >
              <div className="mb-2 text-2xl">⚔️</div>
              <p className="text-lg font-black text-white">Find Ranked Match</p>
              <p className="mt-1 text-sm text-zinc-400">BO1 · Quick ELO update · Random opponent</p>
              <span className="mt-4 inline-block rounded-lg bg-[#ff4477] px-4 py-2 text-sm font-bold text-white transition-transform group-hover:scale-105">
                Find Match →
              </span>
            </button>
            <button
              type="button"
              onClick={() => enterView('league')}
              className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent p-6 text-left transition-all hover:border-cyan-500/60 hover:bg-cyan-500/15"
            >
              <div className="mb-2 text-2xl">🏆</div>
              <p className="text-lg font-black text-white">League Set</p>
              <p className="mt-1 text-sm text-zinc-400">BO3 · First to 2 wins · ELO at set end</p>
              <span className="mt-4 inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition-transform group-hover:scale-105">
                Find Match →
              </span>
            </button>
          </div>
        </section>

        {/* ── Public Rooms section ── */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Public Rooms</h2>
            <button
              type="button"
              onClick={() => getSocket().emit('request_public_rooms')}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="mb-3">
            <button
              type="button"
              onClick={() => enterView('public_create')}
              className="w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-left text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
            >
              <span className="mr-2 text-base">＋</span>
              Create a public room — others can see and join without a code
            </button>
          </div>

          {publicRooms.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-600">
              No public rooms right now. Be the first to create one!
            </div>
          ) : (
            <div className="grid gap-2">
              {publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div>
                    <span className="font-bold text-white">{room.host}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {room.mode === 'league' ? 'League (BO3)' : 'Ranked (BO1)'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/play/spectate?room=${room.roomCode}`}>
                      <button type="button" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white">
                        Watch
                      </button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setJoinCode(room.roomCode);
                        enterView('public_join');
                      }}
                      className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-zinc-500"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Private Room ── */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Private Room</h2>
          <Link href="/multiplayer/custom">
            <button
              type="button"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
            >
              <span className="mr-2">🔒</span>
              Create or join with a code — invite a specific friend
            </button>
          </Link>
        </section>
      </main>
    </div>
  );
}
