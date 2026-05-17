import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Lightning Fast',
    desc: '60 fps gameplay with sub-frame input handling — the board reacts the moment your fingers move.',
    color: 'border-yellow-500/20 hover:border-yellow-400/40',
    glow: 'rgba(234,179,8,0.06)',
  },
  {
    icon: '🏆',
    title: 'Ranked Matches',
    desc: 'Climb the ELO ladder in real 1v1 battles. Every placement shapes your rating.',
    color: 'border-cyan-500/20 hover:border-cyan-400/40',
    glow: 'rgba(0,245,255,0.06)',
  },
  {
    icon: '🎓',
    title: 'Training Academy',
    desc: 'Guided lessons on T-spins, openers, and stacking — from beginner to competitor.',
    color: 'border-purple-500/20 hover:border-purple-400/40',
    glow: 'rgba(168,85,247,0.06)',
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-animated min-h-screen text-white">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Radial glow behind title */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 600,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(0,245,255,0.07) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-3xl">
          {/* Badge */}
          <div className="animate-slide-up mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/6 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #0ff' }} />
            Competitive Block Puzzle
          </div>

          {/* Title */}
          <h1 className="animate-slide-up-d1 mb-5 text-6xl font-black tracking-tight sm:text-8xl">
            <span className="text-glow-cyan animate-glow">Meow</span>
            <span className="text-white">Tetr</span>
          </h1>

          <p className="animate-slide-up-d2 mx-auto mb-10 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            Fast. Competitive. The online block arena where every drop&nbsp;counts.
          </p>

          {/* CTA */}
          <div className="animate-slide-up-d3 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button variant="primary" size="lg">Play Now</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">Sign In</Button>
            </Link>
          </div>
        </div>

        {/* ── Feature cards ──────────────────────────────────────── */}
        <div className="relative mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 px-2 sm:mt-28 sm:grid-cols-3 sm:px-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-sm border bg-[#0e0e18] p-6 text-left transition-all duration-300 ${f.color}`}
              style={{ boxShadow: `0 0 30px ${f.glow}` }}
            >
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 font-black text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
