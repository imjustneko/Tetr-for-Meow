'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { ZenithClient } from '@/components/game/ZenithClient';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function ZenithPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0608] text-zinc-400">
        Loading…
      </div>
    );
  }

  if (started) {
    return (
      <div className="min-h-screen bg-[#0a0608] text-white">
        <Navbar />
        <main className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-20">
          <ZenithClient currentUserId={user.id} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0608] text-white">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-20">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-orange-500">Quick Play</p>
          <h1 className="mt-1 text-5xl font-black tracking-tight text-white">
            ZENITH <span className="text-orange-400">TOWER</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Send lines and KO enemies to scale the tower.<br />
            The further you climb, the stronger the opponents!
          </p>
        </div>

        {/* Main card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-orange-500/25 bg-gradient-to-br from-[#1a0c04] to-[#0a0608]">
          <div className="border-b border-orange-500/15 px-6 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">About this mode</h2>
          </div>
          <div className="space-y-3 px-6 py-5 text-sm text-zinc-300">
            <div className="flex gap-3">
              <span className="text-xl">⚔️</span>
              <p>Fight up to 10 players simultaneously. KO opponents to gain altitude.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-xl">📈</span>
              <p>Altitude = lines cleared + attacks sent. The higher you reach, the better.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-xl">🗑️</span>
              <p>Garbage is automatically routed from opponents. Counter it by clearing lines.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-xl">🏆</span>
              <p>Last player standing wins. Live leaderboard shows everyone's altitude.</p>
            </div>
          </div>
        </div>

        {/* START */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="group relative w-full overflow-hidden rounded-2xl border-2 border-orange-500/60 bg-gradient-to-br from-orange-900/60 to-orange-950/80 py-6 text-center transition-all hover:border-orange-400 hover:from-orange-800/70"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <p className="text-3xl font-black uppercase tracking-widest text-orange-300 group-hover:text-orange-200">
              START
            </p>
            <p className="mt-1 text-xs text-orange-500">Solo · up to 10 players · quick match</p>
          </button>

          <div className="flex gap-3">
            <Link href={`/play/spectate`}>
              <Button variant="ghost">Spectate</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="secondary">Back</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
