'use client';

import { memo } from 'react';
import type { GameState } from '@/lib/game/types';

type Props = {
  gameState: GameState;
  modeLabel: string;
  subtitle?: string;
};

export const GameUnderBoardBar = memo(function GameUnderBoardBar({ gameState, modeLabel, subtitle }: Props) {
  return (
    <div className="flex w-full items-center justify-between gap-4 border-t border-white/[0.08] pt-2">
      {/* Score */}
      <div className="flex flex-col">
        <span className="font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">
          {gameState.score.toLocaleString()}
        </span>
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-zinc-600">Score</span>
      </div>

      {/* Centre — combo / B2B */}
      <div className="flex flex-col items-center gap-0.5">
        {gameState.isBackToBack ? (
          <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-400">B2B</span>
        ) : null}
        {gameState.combo > 0 ? (
          <span className="font-mono text-sm font-black text-yellow-400">{gameState.combo}✕</span>
        ) : null}
      </div>

      {/* Mode tag */}
      <div className="flex flex-col items-end">
        <span className="rounded-sm border border-white/10 bg-black/30 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-zinc-400">
          {modeLabel}
        </span>
        {subtitle ? (
          <span className="mt-0.5 text-[0.55rem] text-zinc-600">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
});
