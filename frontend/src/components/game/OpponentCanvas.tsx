'use client';

import { useEffect, useRef } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT, HIDDEN_ROWS, PIECE_COLORS } from '@/lib/game/constants';
import type { Board, CellValue } from '@/lib/game/types';

const PIECE_TYPE_MAP = ['', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];

interface OpponentCanvasProps {
  board: Board | number[][] | null;
  cellSize?: number;
  label?: string;
  eliminated?: boolean;
}

function normalizeBoard(raw: Board | number[][] | null): CellValue[][] | null {
  if (!raw || raw.length === 0) return null;
  return raw as CellValue[][];
}

export function OpponentCanvas({ board, cellSize = 18, label = 'Opponent', eliminated = false }: OpponentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = normalizeBoard(board);

  const width = BOARD_WIDTH * cellSize;
  const height = BOARD_HEIGHT * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x <= BOARD_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }

    if (grid) {
      for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const cell = grid[row + HIDDEN_ROWS]?.[col] ?? 0;
          if (cell === 0) continue;
          const pieceType = PIECE_TYPE_MAP[cell] ?? 'G';
          const px = col * cellSize;
          const py = row * cellSize;
          const pad = 1;
          ctx.fillStyle = PIECE_COLORS[pieceType] ?? '#888';
          ctx.fillRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
        }
      }
    }
  }, [grid, cellSize, width, height]);

  return (
    <div className="relative flex flex-col gap-1">
      <p className={`text-[0.65rem] font-bold uppercase tracking-widest ${eliminated ? 'text-red-500 line-through' : 'text-zinc-500'}`}>
        {label}{eliminated ? ' · OUT' : ''}
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`rounded-sm border ${eliminated ? 'border-red-800 opacity-40' : 'border-zinc-700'}`}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
        {eliminated && (
          <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/60">
            <span className="text-xs font-bold text-red-400">ELIMINATED</span>
          </div>
        )}
      </div>
    </div>
  );
}
