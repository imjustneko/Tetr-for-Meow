'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useGameEngine } from '@/hooks/useGameEngine';
import { usePlayfieldCellSize } from '@/hooks/usePlayfieldCellSize';
import { useHoldEscToHub } from '@/hooks/useHoldEscToHub';
import { useCtrlRRestart } from '@/hooks/useCtrlRRestart';
import { GameCanvas } from '@/components/game/GameCanvas';
import { GamePlayfield } from '@/components/game/GamePlayfield';
import { HoldEscOverlay } from '@/components/game/HoldEscOverlay';
import { HoldBox } from '@/components/game/HoldBox';
import { NextQueue } from '@/components/game/NextQueue';
import { GameHUD } from '@/components/game/GameHUD';
import { BOARD_HEIGHT, HIDDEN_ROWS } from '@/lib/game/constants';
import { GarbageMeter } from '@/components/game/GarbageMeter';
import type { PieceType, Board } from '@/lib/game/types';
import { getPieceMatrix } from '@/lib/game/tetrominos';
import { PIECE_COLORS } from '@/lib/game/constants';

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
    id: 't-spin-slot',
    title: 'T-Spin Slot Builder',
    description: 'Learn to leave a T-slot, stack around it, then rotate T into the gap.',
    steps: [
      {
        piece: 'J',
        instruction: 'Step 1: Build left foundation and keep center open for a future slot.',
        hologramCells: [
          { x: 2, y: 18 },
          { x: 2, y: 19 },
          { x: 3, y: 19 },
          { x: 4, y: 19 },
        ],
      },
      {
        piece: 'L',
        instruction: 'Step 2: Build right wall while preserving a center cavity.',
        hologramCells: [
          { x: 7, y: 17 },
          { x: 5, y: 18 },
          { x: 6, y: 18 },
          { x: 7, y: 18 },
        ],
      },
      {
        piece: 'O',
        instruction: 'Step 3: Stabilize one side so the T-slot shape stays intact.',
        hologramCells: [
          { x: 0, y: 17 },
          { x: 1, y: 17 },
          { x: 0, y: 18 },
          { x: 1, y: 18 },
        ],
      },
      {
        piece: 'T',
        instruction: 'Step 4: Rotate T into the prepared center slot (your spin finish).',
        hologramCells: [
          { x: 4, y: 17 },
          { x: 3, y: 18 },
          { x: 4, y: 18 },
          { x: 5, y: 18 },
        ],
      },
    ],
  },
  {
    id: 'sz-spin-slot',
    title: 'S/Z Spin Setup',
    description: 'Create an overhang cavity, then slide S/Z into the pocket by rotation.',
    steps: [
      {
        piece: 'J',
        instruction: 'Step 1: Build a low left platform.',
        hologramCells: [
          { x: 1, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 1, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 2, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 3, y: 19, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
      {
        piece: 'O',
        instruction: 'Step 2: Add support blocks and keep a 2-cell channel open.',
        hologramCells: [
          { x: 7, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 8, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 7, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 8, y: 18, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
      {
        piece: 'L',
        instruction: 'Step 3: Build an overhang so S/Z has to rotate into place.',
        hologramCells: [
          { x: 5, y: 16, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 3, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 4, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 5, y: 17, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
      {
        piece: 'S',
        instruction: 'Step 4: Rotate S into the highlighted cavity (spin-fit finish).',
        hologramCells: [
          { x: 4, y: 15, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 5, y: 15, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 3, y: 16, color: 'rgba(255, 220, 0, 0.22)' },
          { x: 4, y: 16, color: 'rgba(255, 220, 0, 0.22)' },
        ],
      },
    ],
  },
  {
    id: 'lj-spin-slot',
    title: 'L/J Spin Slot',
    description: 'Practice creating a side pocket and rotating L/J into that narrow gap.',
    steps: [
      {
        piece: 'O',
        instruction: 'Step 1: Build a stable base block.',
        hologramCells: [
          { x: 2, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 3, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 2, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 3, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
        ],
      },
      {
        piece: 'T',
        instruction: 'Step 2: Add a center overhang and keep the side pocket open.',
        hologramCells: [
          { x: 6, y: 18, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 5, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 6, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 7, y: 19, color: 'rgba(130, 200, 255, 0.22)' },
        ],
      },
      {
        piece: 'J',
        instruction: 'Step 3: Rotate J into the pocket (L/J spin concept).',
        hologramCells: [
          { x: 0, y: 16, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 0, y: 17, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 1, y: 17, color: 'rgba(130, 200, 255, 0.22)' },
          { x: 2, y: 17, color: 'rgba(130, 200, 255, 0.22)' },
        ],
      },
    ],
  },
  {
    id: 'i-spin-well',
    title: 'I-Spin Well Control',
    description: 'Learn to leave a clean left well, build around it, then drop I for efficient scoring.',
    steps: [
      {
        piece: 'L',
        instruction: 'Step 1: Build the right floor and intentionally leave left well space.',
        hologramCells: [
          { x: 8, y: 18, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 6, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 7, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 8, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
        ],
      },
      {
        piece: 'J',
        instruction: 'Step 2: Raise stack while keeping the left channel open.',
        hologramCells: [
          { x: 2, y: 18, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 2, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 3, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 4, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
        ],
      },
      {
        piece: 'O',
        instruction: 'Step 3: Fill center safely and protect the open well.',
        hologramCells: [
          { x: 5, y: 17, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 6, y: 17, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 5, y: 18, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 6, y: 18, color: 'rgba(0, 220, 255, 0.22)' },
        ],
      },
      {
        piece: 'I',
        instruction: 'Step 4: Drop I vertically into the well to cash in your setup.',
        hologramCells: [
          { x: 0, y: 16, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 0, y: 17, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 0, y: 18, color: 'rgba(0, 220, 255, 0.22)' },
          { x: 0, y: 19, color: 'rgba(0, 220, 255, 0.22)' },
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
  const remainingGuidedPieces = useMemo(
    () => selectedDrill.steps.slice(currentStepIndex).map((step) => step.piece),
    [selectedDrill, currentStepIndex]
  );
  const mode = useMemo(() => ({ type: 'practice' as const }), []);
  const cellSize = usePlayfieldCellSize();
  const previousPlacedRef = useRef(0);
  const previousBoardRef = useRef<Board | null>(null);

  const { gameState, isActive, isFinished, finalState, startGame, restartGame, engineRef } = useGameEngine(mode, {
    practiceSequence: remainingGuidedPieces,
    onStateTick: (state) => {
      if (state.piecesPlaced <= previousPlacedRef.current || isCompleted) return;
      previousPlacedRef.current = state.piecesPlaced;
      const boardBefore = previousBoardRef.current;
      const targetValue = PIECE_TO_CELL_VALUE[currentStep.piece];
      const placedCells = extractPlacedCells(boardBefore, state.board, targetValue);
      const targetCells = currentStep.hologramCells.map((cell) => ({ x: cell.x, y: cell.y }));
      const placedCorrectly = areSameCellSet(placedCells, targetCells);
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
  useCtrlRRestart({ enabled: isActive || isFinished, onRestart: retryDrill });

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
    if (gameState) {
      previousBoardRef.current = gameState.board.map((row) => [...row]);
    }
  }, [gameState]);

  useEffect(() => {
    if (!remainingGuidedPieces.length) return;
    engineRef.current?.setPracticeSequence(remainingGuidedPieces, false);
  }, [remainingGuidedPieces, engineRef]);

  function startDrill() {
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setStepFeedback('');
    previousPlacedRef.current = 0;
    previousBoardRef.current = null;
    startGame();
  }

  function retryDrill() {
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setStepFeedback('');
    previousPlacedRef.current = 0;
    previousBoardRef.current = null;
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

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-2 pb-4 pt-14 sm:px-3 sm:pt-16">
        <div className="mb-3 grid gap-2 rounded-sm border border-white/10 bg-black/35 p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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

        <div className="mb-3 grid gap-2 sm:grid-cols-3">
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

        <div className="mb-3 rounded-sm border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Full guide</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {selectedDrill.steps.map((step, idx) => {
              const done = idx < currentStepIndex || isCompleted;
              const active = idx === currentStepIndex && !isCompleted;
              return (
                <div
                  key={`${selectedDrill.id}-step-${idx}`}
                  className={`rounded-sm border px-2 py-2 ${
                    done
                      ? 'border-emerald-400/40 bg-emerald-500/10'
                      : active
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/10 bg-black/20'
                  }`}
                >
                  <p className="text-[0.65rem] font-bold uppercase tracking-wide text-zinc-300">
                    Step {idx + 1} · {step.piece}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-zinc-400">{step.instruction}</p>
                </div>
              );
            })}
          </div>
        </div>

        {isCompleted ? (
          <div className="mb-3 rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Drill completed</p>
            <p className="text-xs text-emerald-100/90">{stepFeedback || 'Great job! Drill completed correctly.'}</p>
          </div>
        ) : (
          <div className="mb-3 rounded-sm border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Hologram tip</p>
            <p className="text-sm text-zinc-300">{currentStep.instruction}</p>
            {stepFeedback ? <p className="mt-2 text-xs text-cyan-300">{stepFeedback}</p> : null}
          </div>
        )}

        {gameState ? (
          <GamePlayfield playfieldRef={playfieldRef} className="flex-1">
            <div className="grid w-full grid-cols-1 items-start justify-items-center gap-2 lg:grid-cols-[auto_minmax(0,auto)_auto] lg:gap-3">
              <div className="flex w-full max-w-[20rem] flex-row justify-center gap-3 lg:max-w-none lg:flex-col lg:justify-start">
                <NeededPieceBox piece={currentStep.piece} />
                <HoldBox heldPiece={gameState.heldPiece} canHold={gameState.canHold} />
              </div>

              <div className="flex w-full max-w-[min(100vw-0.75rem,28rem)] flex-col items-center gap-2 sm:max-w-none">
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

              <div className="flex w-full max-w-[20rem] flex-col gap-2 sm:max-w-none lg:max-w-[min(100%,10rem)]">
                <NextQueue queue={gameState.nextQueue} />
                <GameHUD gameState={gameState} mode="solo" />
              </div>
            </div>
          </GamePlayfield>
        ) : (
          <div className="rounded-sm border border-white/10 bg-black/30 px-6 py-8 text-center">
            <p className="text-sm text-zinc-300">Press Start drill to begin this lesson.</p>
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

function extractPlacedCells(boardBefore: Board | null, boardAfter: Board, targetValue: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  if (!boardBefore) return cells;
  for (let y = HIDDEN_ROWS; y < boardAfter.length; y++) {
    const rowBefore = boardBefore[y] ?? [];
    const rowAfter = boardAfter[y] ?? [];
    for (let x = 0; x < rowAfter.length; x++) {
      const before = rowBefore[x] ?? 0;
      const after = rowAfter[x] ?? 0;
      if (before === 0 && after === targetValue) {
        cells.push({ x, y: y - HIDDEN_ROWS });
      }
    }
  }
  return cells;
}

function areSameCellSet(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map((cell) => `${cell.x},${cell.y}`));
  for (const cell of b) {
    if (!setA.has(`${cell.x},${cell.y}`)) return false;
  }
  return true;
}

function NeededPieceBox({ piece }: { piece: PieceType }) {
  const matrix = getPieceMatrix(piece, 0);
  const color = PIECE_COLORS[piece];
  const cellSize = 16;

  let minRow = 3;
  let maxRow = 0;
  let minCol = 3;
  let maxCol = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (matrix[r][c] !== 0) {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
    }
  }

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-cyan-300">Needed</p>
      <div className="flex h-[52px] w-[80px] items-center justify-center border border-cyan-500/40 bg-cyan-500/10">
        <div
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gap: 1,
          }}
        >
          {Array.from({ length: rows * cols }, (_, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const filled = matrix[r + minRow][c + minCol] !== 0;
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: filled ? color : 'transparent',
                  borderRadius: 1,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
