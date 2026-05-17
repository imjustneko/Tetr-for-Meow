'use client';

import { memo } from 'react';
import type { GameState } from '@/lib/game/types';

interface GameHUDProps {
  gameState: GameState;
  mode: string;
  targetLines?: number;
  timeLimit?: number;
}

function formatTime(ms: number): string {
  const s   = Math.floor(ms / 1000);
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  const cs  = Math.floor((ms % 1000) / 10);
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function calcPPS(state: GameState): string {
  const secs = state.gameTime / 1000;
  if (secs < 0.1) return '0.00';
  return (state.piecesPlaced / secs).toFixed(2);
}

export const GameHUD = memo(function GameHUD({ gameState, mode, targetLines, timeLimit }: GameHUDProps) {
  const timeLeft = timeLimit ? Math.max(0, timeLimit - gameState.gameTime) : null;

  return (
    <div className="w-[80px] shrink-0 border border-white/10 bg-black/40 sm:w-[88px]">
      <Stat label="Score" value={gameState.score.toLocaleString()} accent />

      {mode === 'sprint' && targetLines ? (
        <Stat label="Lines" value={`${gameState.lines}/${targetLines}`} />
      ) : null}
      {mode === 'ultra' && timeLeft !== null ? (
        <Stat label="Left" value={formatTime(timeLeft)} accent={timeLeft < 30000} />
      ) : null}
      {mode === 'solo' ? <Stat label="Lines" value={String(gameState.lines)} /> : null}

      <Stat label="Level" value={String(gameState.level)} />
      <Stat label="Time"  value={formatTime(gameState.gameTime)} />
      <Stat label="PPS"   value={calcPPS(gameState)} />

      {gameState.combo > 0 ? (
        <div className="border-t border-white/5 px-1.5 py-1 text-center">
          <span className="text-sm font-black text-yellow-400 tabular-nums">{gameState.combo}✕</span>
          <div className="text-[0.55rem] uppercase tracking-widest text-yellow-600">combo</div>
        </div>
      ) : null}

      {gameState.isBackToBack ? (
        <div className="border-t border-white/5 px-1.5 py-1 text-center">
          <span className="text-[0.6rem] font-black uppercase tracking-wide text-cyan-400">B2B</span>
        </div>
      ) : null}

      {gameState.lastClear && gameState.lastClear.linesCleared > 0 ? (
        <div className="border-t border-white/5 px-1 py-1 text-center text-[0.55rem] font-semibold uppercase leading-tight tracking-wide text-zinc-400">
          {gameState.lastClear.clearType.replace(/([A-Z])/g, ' $1').trim()}
          {gameState.lastClear.isPerfectClear ? (
            <div className="mt-0.5 font-black text-yellow-300">PC!</div>
          ) : null}
        </div>
      ) : null}

      {gameState.garbageQueue > 0 ? (
        <div className="border-t border-red-900/40 bg-red-950/30 px-1.5 py-1 text-center">
          <span className="text-xs font-bold text-red-400">⚠ {gameState.garbageQueue}</span>
        </div>
      ) : null}
    </div>
  );
});

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-b border-white/5 px-2 py-1.5 text-center last:border-0">
      <div className={`min-w-[5ch] font-mono text-sm font-black tabular-nums sm:text-base ${accent ? 'text-cyan-400' : 'text-zinc-100'}`}>
        {value}
      </div>
      <div className="text-[0.55rem] uppercase tracking-widest text-zinc-600">{label}</div>
    </div>
  );
}
