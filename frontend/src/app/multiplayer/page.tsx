'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { VersusClient } from '@/components/multiplayer/VersusClient';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

export default function MultiplayerPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [queueMode, setQueueMode] = useState<'ranked' | 'league'>('ranked');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-20">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-zinc-500">Multiplayer</p>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-[#ff4477]">{queueMode === 'league' ? 'League' : 'Ranked'}</span> 1v1
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              {queueMode === 'league'
                ? 'Best-of-3 league set. First to 2 rounds wins and takes ELO from the loser.'
                : 'Single ranked match. Ready up, survive garbage, and top your opponent out.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQueueMode('ranked')}
              className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                queueMode === 'ranked'
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/15 bg-black/25 text-zinc-300'
              }`}
            >
              Ranked (BO1)
            </button>
            <button
              type="button"
              onClick={() => setQueueMode('league')}
              className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                queueMode === 'league'
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/15 bg-black/25 text-zinc-300'
              }`}
            >
              League (BO3)
            </button>
            <Link href="/multiplayer/custom">
              <Button variant="secondary">Private room</Button>
            </Link>
          </div>
        </div>

        <VersusClient mode={queueMode} startWith="queue" currentUserId={user.id} />
      </main>
    </div>
  );
}
