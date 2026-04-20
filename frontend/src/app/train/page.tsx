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
import { BOARD_HEIGHT, HIDDEN_ROWS } from '@/lib/game/constants';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import type { PieceType } from '@/lib/game/types';

type Drill = {
  id: string;
  title: string;
  description: string;
  steps: Array<{
    piece: PieceType;
    instruction: string;
    hologramCells: Array<{ x: number; y: number; color?: string }>;
  }>;
};

const DRILLS: Drill[] = [
  {
    id: 'tspin-double',
    title: 'T-Spin Double',
    description: 'Build and place by guided targets to learn T-Spin setup flow.',
    steps: [
      {
        piece: 'J',
        instruction: 'Step 1: Place J in the left cavity target.',
        hologramCells: [
          { x: 2, y: 18 },
          { x: 2, y: 19 },
          { x: 3, y: 19 },
          { x: 4, y: 19 },
        ],
      },
      {
        piece: 'L',
        instruction: 'Step 2: Place L on the right side to shape the slot.',
        hologramCells: [
          { x: 6, y: 18 },
          { x: 4, y: 19 },
          { x: 5, y: 19 },
          { x: 6, y: 19 },
        ],
      },
      {
        piece: 'T',
        instruction: 'Step 3: Drop T into the center target and finish.',
        hologramCells: [
          { x: 4, y: 18 },
          { x: 3, y: 19 },
          { x: 4, y: 19 },
          { x: 5, y: 19 },
        ],
      },
    ],
  },
  {
    id: 'combo-chain',
    title: 'Combo Chain',
    description: 'Practice clean combo stacking with strict piece-by-piece guidance.',
    steps: [
      {
        piece: 'J',
        instruction: 'Step 1: Place J on the lower-left target.',
        hologramCells: [
          { x: 1, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 1, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 2, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 3, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
      {
        piece: 'L',
        instruction: 'Step 2: Place L opposite to keep the channel open.',
        hologramCells: [
          { x: 6, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 4, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 5, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 6, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
      {
        piece: 'I',
        instruction: 'Step 3: Place I vertical in the right well target.',
        hologramCells: [
          { x: 8, y: 16, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 8, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 8, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 8, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
    ],
  },
  {
    id: 'b2b-stack',
    title: 'B2B Pressure',
    description: 'Build a simple right-side well and practice B2B structure.',
    steps: [
      {
        piece: 'J',
        instruction: 'Step 1: Place J on the left to raise your stack.',
        hologramCells: [
          { x: 1, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 1, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 2, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 3, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
        ],
      },
      {
        piece: 'I',
        instruction: 'Step 2: Place I vertically in the right well.',
        hologramCells: [
          { x: 8, y: 16, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 8, y: 17, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 8, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 8, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
        ],
      },
    ],
  },
];

const PIECE_TO_CELL_VALUE: Record<PieceType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

export default function TrainPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const playfieldRef = useRef<HTMLDivElement>(null);
  const [selectedDrillId, setSelectedDrillId] = useState(DRILLS[0].id);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stepFeedback, setStepFeedback] = useState('');
  const [showXray, setShowXray] = useState(true);
  const selectedDrill = DRILLS.find((d) => d.id === selectedDrillId) ?? DRILLS[0];
  const currentStep = selectedDrill.steps[currentStepIndex] ?? selectedDrill.steps[selectedDrill.steps.length - 1];
  const mode = useMemo(() => ({ type: 'practice' as const }), []);
  const cellSize = usePlayfieldCellSize();
  const previousPlacedRef = useRef(0);

  const { gameState, isActive, isFinished, finalState, startGame, restartGame, engineRef } = useGameEngine(mode, {
    practiceSequence: [currentStep.piece],
    onStateTick: (state) => {
      if (state.piecesPlaced <= previousPlacedRef.current || isCompleted) return;
      previousPlacedRef.current = state.piecesPlaced;
      const targetValue = PIECE_TO_CELL_VALUE[currentStep.piece];
      const placedCorrectly = currentStep.hologramCells.every(
        (cell) => (state.board[cell.y + HIDDEN_ROWS]?.[cell.x] ?? 0) === targetValue
      );
      if (placedCorrectly) {
        const nextStep = currentStepIndex + 1;
        if (nextStep >= selectedDrill.steps.length) {
          setIsCompleted(true);
          setStepFeedback('Great job! Drill completed correctly.');
          return;
        }
        setCurrentStepIndex(nextStep);
        setStepFeedback(`Correct! Moving to step ${nextStep + 1}.`);
      } else {
        setStepFeedback('Not quite right. Keep the same piece and place it on the highlighted hologram cells.');
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

  useEffect(() => {
    engineRef.current?.setPracticeSequence([currentStep.piece], true);
  }, [currentStep.piece, engineRef]);

  function startDrill() {
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setStepFeedback('');
    previousPlacedRef.current = 0;
    startGame();
  }

  function retryDrill() {
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setStepFeedback('');
    previousPlacedRef.current = 0;
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
            <p className="mt-2 text-xs uppercase tracking-wider text-cyan-300">
              Step {Math.min(currentStepIndex + 1, selectedDrill.steps.length)} / {selectedDrill.steps.length}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Needed piece now:{' '}
              <span className="mr-1 inline-flex rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-bold text-cyan-200">
                {currentStep.piece}
              </span>
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
                setCurrentStepIndex(0);
                setIsCompleted(false);
                setStepFeedback('');
              }}
              className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                selectedDrillId === drill.id
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-white/10 bg-zinc-950/75 hover:border-cyan-500/40'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-300">{drill.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{drill.steps.length} guided steps</p>
            </button>
          ))}
        </div>

        {isCompleted ? (
          <div className="mb-5 rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Drill completed</p>
            <p className="text-xs text-emerald-100/90">{stepFeedback || 'Great job! Drill completed correctly.'}</p>
          </div>
        ) : (
          <div className="mb-5 rounded-sm border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Hologram tip</p>
            <p className="text-sm text-zinc-300">{currentStep.instruction}</p>
            {stepFeedback ? <p className="mt-2 text-xs text-cyan-300">{stepFeedback}</p> : null}
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
                    guideCells={showXray ? currentStep.hologramCells : []}
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
