'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { ZenithClient } from '@/components/game/ZenithClient';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

type SubMode = 'open' | 'solo' | 'duo';

const MODES: { id: SubMode; icon: string; title: string; desc: string; tag: string }[] = [
  {
    id: 'solo',
    icon: '🧗',
    title: 'SOLO',
    desc: 'Climb alone. Starts instantly — no waiting.',
    tag: 'Instant start',
  },
  {
    id: 'open',
    icon: '⚔️',
    title: 'OPEN',
    desc: 'Up to 10 players. Join mid-game, fight to the top.',
    tag: 'Up to 10',
  },
  {
    id: 'duo',
    icon: '🤝',
    title: 'DUO',
    desc: 'Random partner. If they die — clear 6 lines to revive them.',
    tag: 'Team revive',
  },
];

export default function ZenithPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [selected, setSelected] = useState<SubMode>('open');
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
          <ZenithClient currentUserId={user.id} subMode={selected} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0608] text-white">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-20">

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

        {/* Mode selection */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all ${
                  active
                    ? 'border-orange-500 bg-orange-500/15 text-white'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <span className="text-3xl">{m.icon}</span>
                <span className={`text-sm font-black uppercase tracking-widest ${active ? 'text-orange-300' : ''}`}>
                  {m.title}
                </span>
                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-zinc-500">
                  {m.tag}
                </span>
                <p className="text-[0.7rem] leading-snug text-zinc-400">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Start button */}
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
            <p className="mt-1 text-xs text-orange-500 capitalize">
              {selected === 'solo' ? 'Solo climb · starts instantly' : selected === 'duo' ? 'Duo teams · up to 10 players' : 'Open · up to 10 players · join anytime'}
            </p>
          </button>

          <div className="flex gap-3">
            <Link href="/play/spectate"><Button variant="ghost">Spectate</Button></Link>
            <Link href="/dashboard"><Button variant="secondary">Back</Button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}
