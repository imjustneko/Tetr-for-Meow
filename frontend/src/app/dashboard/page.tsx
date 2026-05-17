'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Navbar } from '@/components/layout/Navbar';
import { MenuMegaButton } from '@/components/ui/MenuMegaButton';

function getRank(rating: number): { name: string; color: string; glow: string } {
  if (rating < 500)  return { name: 'Stone',    color: 'text-zinc-500',   glow: '' };
  if (rating < 800)  return { name: 'Iron',     color: 'text-zinc-400',   glow: '' };
  if (rating < 1100) return { name: 'Bronze',   color: 'text-amber-600',  glow: '' };
  if (rating < 1400) return { name: 'Silver',   color: 'text-zinc-200',   glow: '' };
  if (rating < 1700) return { name: 'Gold',     color: 'text-yellow-400', glow: 'rgba(250,204,21,0.15)' };
  if (rating < 2000) return { name: 'Platinum', color: 'text-cyan-300',   glow: 'rgba(0,245,255,0.15)' };
  if (rating < 2400) return { name: 'Diamond',  color: 'text-blue-400',   glow: 'rgba(96,165,250,0.15)' };
  return               { name: 'Master',    color: 'text-purple-400', glow: 'rgba(192,132,252,0.2)' };
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508]">
        <div className="animate-pulse text-xs font-black uppercase tracking-[0.3em] text-cyan-500">Loading</div>
      </div>
    );
  }

  const rank = getRank(user.rating);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-20 sm:pt-24">

        {/* ── Player header ── */}
        <div className="animate-slide-up mb-8 flex flex-col gap-1 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-zinc-600">Welcome back</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              {user.username}
            </h1>
            <p
              className={`mt-1.5 text-sm font-bold uppercase tracking-wide ${rank.color}`}
              style={rank.glow ? { textShadow: `0 0 12px ${rank.glow}` } : undefined}
            >
              {rank.name} · {user.rating} TR
            </p>
          </div>
          <Link
            href={`/profile/${encodeURIComponent(user.username)}`}
            className="mt-3 text-xs font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:text-cyan-400 sm:mt-0"
          >
            View profile →
          </Link>
        </div>

        {/* ── Play modes ── */}
        <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-zinc-600">Play</p>
        <div className="animate-slide-up-d1 flex flex-col gap-2.5">
          <MenuMegaButton href="/multiplayer"       icon="MP" title="Multiplayer"  subtitle="Ranked 1v1 and online matches"          tone="multiplayer" />
          <MenuMegaButton href="/play/solo"         icon="1P" title="Solo"         subtitle="Practice, sprint, and ultra modes"      tone="solo" />
          <MenuMegaButton href="/train"             icon="TR" title="Training"     subtitle="Lessons, drills, and skill paths"       tone="arcade" />
          <MenuMegaButton href="/multiplayer/custom" icon="RM" title="Custom room"  subtitle="Play with friends using a room code"   tone="config" />
        </div>

        {/* ── Quick modes ── */}
        <p className="mb-2.5 mt-9 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-zinc-600">Quick</p>
        <div className="animate-slide-up-d2 grid grid-cols-3 gap-2">
          {[
            { href: '/play/sprint', label: 'Sprint 40L' },
            { href: '/play/ultra',  label: 'Ultra 2:00' },
            { href: '/leaderboard', label: 'Leaderboard' },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="rounded-sm border border-white/8 bg-zinc-900/50 px-3 py-2.5 text-center text-xs font-black uppercase tracking-wide text-zinc-300 transition-all duration-150 hover:border-cyan-500/30 hover:bg-zinc-900 hover:text-white"
            >
              {x.label}
            </Link>
          ))}
        </div>

        {/* ── Stats ── */}
        <p className="mb-2.5 mt-9 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-zinc-600">Stats</p>
        <div className="animate-slide-up-d3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Rating', value: String(user.rating), accent: true },
            { label: 'Games',  value: '—' },
            { label: 'APM',    value: '—' },
            { label: 'PPS',    value: '—' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-sm border border-white/8 bg-zinc-950/70 px-3 py-4 text-center"
            >
              <div className={`text-xl font-black tabular-nums ${s.accent ? 'text-cyan-400' : 'text-white'}`}>
                {s.value}
              </div>
              <div className="mt-1 text-[0.55rem] font-bold uppercase tracking-wider text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
