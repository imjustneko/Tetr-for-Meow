'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useHoldEscToHub } from '@/hooks/useHoldEscToHub';
import { usePlayfieldCellSize } from '@/hooks/usePlayfieldCellSize';
import { useCtrlRRestart } from '@/hooks/useCtrlRRestart';
import { GameCanvas } from '@/components/game/GameCanvas';
import { NextQueue } from '@/components/game/NextQueue';
import { HoldBox } from '@/components/game/HoldBox';
import { GameHUD } from '@/components/game/GameHUD';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import { GameUnderBoardBar } from '@/components/game/GameUnderBoardBar';
import { HoldEscOverlay } from '@/components/game/HoldEscOverlay';
import { GamePlayfield } from '@/components/game/GamePlayfield';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { BOARD_HEIGHT } from '@/lib/game/constants';
import type { GameState } from '@/lib/game/types';

function formatTime(ms: number) {
  const s   = Math.floor(ms / 1000);
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  const cs  = Math.floor((ms % 1000) / 10);
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function calcPPS(state: GameState) {
  const secs = state.gameTime / 1000;
  if (secs < 0.1) return '0.00';
  return (state.piecesPlaced / secs).toFixed(2);
}

export default function SoloPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const mode = useMemo(() => ({ type: 'solo' as const }), []);
  const playfieldRef = useRef<HTMLDivElement>(null);
  const cellSize = usePlayfieldCellSize();

  const { gameState, isActive, isFinished, finalState, startGame, restartGame } = useGameEngine(mode);
  const escProgress = useHoldEscToHub(isActive || isFinished);
  useCtrlRRestart({ enabled: isActive || isFinished, onRestart: restartGame });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isActive) playfieldRef.current?.focus({ preventScroll: true });
  }, [isActive]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 110% 60% at 50% 110%, rgba(100,30,130,0.3), transparent 55%), ' +
            'linear-gradient(180deg, #090910 0%, #100e1a 60%, #18102a 100%)',
        }}
      />
      <Navbar />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-2 pb-16 pt-14 sm:px-4 sm:pt-16">

        {/* ── Start screen ──────────────────────────────────────── */}
        {!isActive && !isFinished && (
          <div className="animate-slide-up flex flex-col items-center gap-5 text-center">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-zinc-600">Solo Mode</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              <span className="text-glow-cyan">Solo</span>{' '}
              <span className="text-white">Practice</span>
            </h1>
            <p className="text-sm text-zinc-500">No timer — stack at your own pace</p>
            <div className="flex flex-col items-center gap-2">
              <Button variant="primary" size="lg" onClick={startGame} className="min-w-[160px]">
                Start game
              </Button>
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-zinc-700">Ctrl+R to restart</span>
            </div>
          </div>
        )}

        {/* ── Active / finished game ─────────────────────────────── */}
        {(isActive || isFinished) && gameState ? (
          <GamePlayfield playfieldRef={playfieldRef} className="px-1 sm:px-2">
            {/* Mode badge */}
            <div className="absolute right-2 top-2 rounded-sm border border-white/8 bg-black/50 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-[0.2em] text-zinc-400 sm:right-4 sm:top-4">
              Solo
            </div>

            <div className="mt-8 grid w-full grid-cols-1 items-start justify-items-center gap-4 sm:mt-10 lg:grid-cols-[auto_minmax(0,auto)_auto] lg:justify-center lg:gap-5">

              {/* Left: Hold */}
              <div className="flex w-full max-w-[20rem] flex-row justify-center gap-4 lg:max-w-none lg:flex-col lg:justify-start">
                <HoldBox heldPiece={gameState.heldPiece} canHold={gameState.canHold} />
              </div>

              {/* Centre: Board */}
              <div className="flex w-full max-w-[min(100vw-1rem,28rem)] flex-col items-center gap-3 sm:max-w-none">
                <div className="relative flex w-max max-w-full shrink-0 flex-row items-stretch overflow-hidden rounded-sm">
                  <GarbageMeter lines={gameState.garbageQueue} heightPx={BOARD_HEIGHT * cellSize} />
                  <GameCanvas
                    gameState={gameState}
                    cellSize={cellSize}
                    suppressGameOverOverlay={isFinished}
                  />

                  {/* Game over overlay */}
                  {isFinished && finalState ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/82 backdrop-blur-[2px]">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-zinc-500">Game Over</p>

                      <div className="mt-2 text-center">
                        <div className="font-mono text-4xl font-black tabular-nums text-white sm:text-5xl">
                          {finalState.score.toLocaleString()}
                        </div>
                        <div className="text-[0.55rem] uppercase tracking-[0.25em] text-zinc-600">Score</div>
                      </div>

                      <div className="mt-3 flex gap-6 text-center">
                        <div>
                          <div className="font-mono text-lg font-black text-cyan-400">{finalState.lines}</div>
                          <div className="text-[0.55rem] uppercase tracking-wider text-zinc-600">Lines</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-black text-zinc-200">{calcPPS(finalState)}</div>
                          <div className="text-[0.55rem] uppercase tracking-wider text-zinc-600">PPS</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-black text-zinc-200">{formatTime(finalState.gameTime)}</div>
                          <div className="text-[0.55rem] uppercase tracking-wider text-zinc-600">Time</div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col items-center gap-1.5">
                        <Button variant="primary" onClick={restartGame}>Play again</Button>
                        <span className="text-[0.6rem] uppercase tracking-widest text-zinc-700">Ctrl+R</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <GameUnderBoardBar gameState={gameState} modeLabel="Solo" />
              </div>

              {/* Right: Next + HUD */}
              <div className="flex w-full max-w-[20rem] flex-col gap-3 lg:max-w-[min(100%,9rem)]">
                <NextQueue queue={gameState.nextQueue} />
                <GameHUD gameState={gameState} mode="solo" />
              </div>

            </div>
          </GamePlayfield>
        ) : null}

        {isActive ? (
          <p className="mt-4 text-center text-[0.55rem] uppercase tracking-widest text-zinc-700 sm:mt-6">
            Hold Esc — hub
          </p>
        ) : null}
      </div>

      <HoldEscOverlay progress={escProgress} />
    </div>
  );
}
