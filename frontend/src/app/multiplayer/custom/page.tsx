'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { VersusClient } from '@/components/multiplayer/VersusClient';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Step = 'pick' | 'session';

export default function CustomRoomPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [session, setSession] = useState<{ kind: 'create'; maxPlayers: number } | { kind: 'join'; code: string } | null>(null);

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
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-20">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-zinc-500">Multiplayer</p>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-cyan-400">Private</span> room
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Create a code for a friend, or join theirs.</p>
          </div>
          <Link href="/multiplayer">
            <Button variant="ghost">Ranked 1v1</Button>
          </Link>
        </div>

        {step === 'pick' && !session ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <h2 className="mb-2 text-lg font-bold text-white">Create room</h2>
              <p className="mb-4 text-sm text-zinc-500">Generate a short code and share it.</p>
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Max players</p>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPlayers(n)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${
                        maxPlayers === n
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {n}P
                    </button>
                  ))}
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setSession({ kind: 'create', maxPlayers });
                  setStep('session');
                }}
              >
                Create private room
              </Button>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
              <h2 className="mb-2 text-lg font-bold text-white">Join room</h2>
              <p className="mb-4 text-sm text-zinc-500">Enter the 6-character code.</p>
              <Input
                label="Room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="mb-4 font-mono uppercase"
              />
              <Button
                variant="secondary"
                className="w-full"
                disabled={joinCode.trim().length < 4}
                onClick={() => {
                  setSession({ kind: 'join', code: joinCode.trim().toUpperCase() });
                  setStep('session');
                }}
              >
                Join room
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'session' && session ? (
          <VersusClient
            key={session.kind === 'join' ? session.code : 'create'}
            mode="custom"
            startWith={session.kind === 'create' ? 'create' : 'join'}
            joinCode={session.kind === 'join' ? session.code : undefined}
            maxPlayers={session.kind === 'create' ? session.maxPlayers : undefined}
            currentUserId={user.id}
          />
        ) : null}
      </main>
    </div>
  );
}
