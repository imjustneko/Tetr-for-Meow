'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useGameEngine } from '@/hooks/useGameEngine';
import { usePlayfieldCellSize } from '@/hooks/usePlayfieldCellSize';
import { useHoldEscToHub } from '@/hooks/useHoldEscToHub';
import { GameCanvas } from '@/components/game/GameCanvas';
import { GamePlayfield } from '@/components/game/GamePlayfield';
import { HoldEscOverlay } from '@/components/game/HoldEscOverlay';
import { HoldBox } from '@/components/game/HoldBox';
import { NextQueue } from '@/components/game/NextQueue';
import { GameHUD } from '@/components/game/GameHUD';
import { BOARD_HEIGHT } from '@/lib/game/constants';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import type { GameState } from '@/lib/game/types';

type Drill = {
  id: string;
  title: string;
  description: string;
  neededPieces: string[];
  goalLabel: string;
  hologramCells: Array<{ x: number; y: number; color?: string }>;
  successCheck: (state: GameState) => boolean;
  tip: string;
};

const DRILLS: Drill[] = [
  {
    id: 'tspin-double',
    title: 'T-Spin Double',
    description: 'T piece-ээ хана түшүүлж 2 мөр цэвэрлэхийг зорь.',
    neededPieces: ['T', 'J', 'L'],
    goalLabel: 'Do a T-Spin Double once',
    hologramCells: [
      { x: 4, y: 17 },
      { x: 3, y: 18 },
      { x: 4, y: 18 },
      { x: 5, y: 18 },
    ],
    successCheck: (state) => state.lastClear?.clearType === 'tSpinDouble',
    tip: 'Ханы ойролцоо CW/CCW эргэлтээр kick ашиглаад T-г шургуул.',
  },
  {
    id: 'combo-chain',
    title: 'Combo Chain',
    description: 'Тасралтгүй мөр цэвэрлээд combo-г өсгө.',
    neededPieces: ['I', 'T', 'L', 'S'],
    goalLabel: 'Reach 4x combo',
    hologramCells: [
      { x: 7, y: 16, color: 'rgba(255, 220, 0, 0.22)' },
      { x: 7, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
      { x: 7, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
      { x: 7, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
    ],
    successCheck: (state) => state.combo >= 4,
    tip: 'Нэг талдаа суваг үлдээгээд мөр бүр дээр clean хийж combo-г таслахгүй үргэлжлүүл.',
  },
  {
    id: 'b2b-stack',
    title: 'B2B Pressure',
    description: 'Tetris эсвэл T-Spin-уудаа дараалуулж back-to-back асаа.',
    neededPieces: ['I', 'T'],
    goalLabel: 'Trigger back-to-back',
    hologramCells: [
      { x: 8, y: 16, color: 'rgba(130, 200, 255, 0.22)' },
      { x: 8, y: 17, color: 'rgba(130, 200, 255, 0.22)' },
      { x: 8, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
      { x: 8, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
    ],
    successCheck: (state) => Boolean(state.lastClear?.isBackToBack),
    tip: 'I-piece-ийн well-ээ хамгаалаад B2B cut бүү хий.',
  },
];

export default function TrainPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const playfieldRef = useRef<HTMLDivElement>(null);
  const [selectedDrillId, setSelectedDrillId] = useState(DRILLS[0].id);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showXray, setShowXray] = useState(true);
  const selectedDrill = DRILLS.find((d) => d.id === selectedDrillId) ?? DRILLS[0];
  const mode = useMemo(() => ({ type: 'practice' as const }), []);
  const cellSize = usePlayfieldCellSize();

  const { gameState, isActive, isFinished, finalState, startGame, restartGame } = useGameEngine(mode, {
    onStateTick: (state) => {
      if (!isSuccess && selectedDrill.successCheck(state)) {
        setIsSuccess(true);
      }
    },
  });

  const escProgress = useHoldEscToHub(isActive || isFinished);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isActive) {
      playfieldRef.current?.focus({ preventScroll: true });
    }
  }, [isActive]);

  function startDrill() {
    setIsSuccess(false);
    startGame();
  }

  function retryDrill() {
    setIsSuccess(false);
    restartGame();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 100%, rgba(0,180,255,0.24), transparent 55%), linear-gradient(180deg, #0a0a12 0%, #0b111d 48%, #081018 100%)',
        }}
      />
      <Navbar />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pt-24">
        <div className="mb-6 grid gap-3 rounded-sm border border-white/10 bg-black/35 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Training Lab</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-cyan-300 sm:text-3xl">
              {selectedDrill.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-300">{selectedDrill.description}</p>
            <p className="mt-2 text-xs uppercase tracking-wider text-cyan-300">Goal: {selectedDrill.goalLabel}</p>
            <p className="mt-2 text-xs text-zinc-400">
              Needed pieces:{' '}
              {selectedDrill.neededPieces.map((piece) => (
                <span
                  key={piece}
                  className="mr-1 inline-flex rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-bold text-cyan-200"
                >
                  {piece}
                </span>
              ))}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {!isActive ? (
              <Button variant="primary" onClick={startDrill}>
                Start drill
              </Button>
            ) : (
              <Button variant="primary" onClick={retryDrill}>
                Restart
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowXray((v) => !v)}>
              {showXray ? 'Hide xray' : 'Show xray'}
            </Button>
          </div>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {DRILLS.map((drill) => (
            <button
              key={drill.id}
              type="button"
              onClick={() => {
                setSelectedDrillId(drill.id);
                setIsSuccess(false);
              }}
              className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                selectedDrillId === drill.id
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-white/10 bg-zinc-950/75 hover:border-cyan-500/40'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-300">{drill.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{drill.goalLabel}</p>
            </button>
          ))}
        </div>

        {isSuccess ? (
          <div className="mb-5 rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Success unlocked</p>
            <p className="text-xs text-emerald-100/90">
              {selectedDrill.title} амжилттай. Одоо speed-ээ өсгөж дахин давтаад consistency авч болно.
            </p>
          </div>
        ) : (
          <div className="mb-5 rounded-sm border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Hologram tip</p>
            <p className="text-sm text-zinc-300">{selectedDrill.tip}</p>
          </div>
        )}

        {gameState ? (
          <GamePlayfield playfieldRef={playfieldRef}>
            <div className="grid w-full grid-cols-1 items-start justify-items-center gap-4 lg:grid-cols-[auto_minmax(0,auto)_auto] lg:gap-5">
              <div className="flex w-full max-w-[20rem] flex-row justify-center gap-4 lg:max-w-none lg:flex-col lg:justify-start">
                <HoldBox heldPiece={gameState.heldPiece} canHold={gameState.canHold} />
              </div>

              <div className="flex w-full max-w-[min(100vw-1rem,28rem)] flex-col items-center gap-3 sm:max-w-none">
                <div className="relative flex w-max max-w-full shrink-0 flex-row items-stretch overflow-hidden rounded-sm shadow-lg shadow-black/30">
                  <GarbageMeter lines={gameState.garbageQueue} heightPx={BOARD_HEIGHT * cellSize} />
                  <GameCanvas
                    gameState={gameState}
                    cellSize={cellSize}
                    suppressGameOverOverlay={isFinished}
                    guideCells={showXray ? selectedDrill.hologramCells : []}
                  />
                  {isFinished && finalState ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                      <h2 className="mb-2 text-2xl font-black text-red-400 sm:text-3xl">Drill ended</h2>
                      <p className="mb-1 text-sm text-zinc-300">
                        Score: <span className="font-bold text-white">{finalState.score.toLocaleString()}</span>
                      </p>
                      <p className="mb-6 text-sm text-zinc-300">
                        Combo: <span className="font-bold text-white">{Math.max(finalState.combo, 0)}x</span>
                      </p>
                      <Button variant="primary" onClick={retryDrill}>
                        Retry drill
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex w-full max-w-[20rem] flex-col gap-3 sm:max-w-none lg:max-w-[min(100%,10rem)]">
                <NextQueue queue={gameState.nextQueue} />
                <GameHUD gameState={gameState} mode="solo" />
              </div>
            </div>
          </GamePlayfield>
        ) : (
          <div className="rounded-sm border border-white/10 bg-black/30 px-6 py-10 text-center">
            <p className="text-sm text-zinc-300">Drill эхлүүлэхийн тулд Start drill дарна уу.</p>
          </div>
        )}

        {isActive ? (
          <p className="mt-4 text-center text-[0.6rem] uppercase tracking-widest text-zinc-600">Hold Esc - hub</p>
        ) : null}
      </div>
      <HoldEscOverlay progress={escProgress} />
    </div>
  );
}
