'use client';

import { memo, useEffect, useRef } from 'react';
import type { PieceType } from '@/lib/game/types';
import { PIECE_COLORS } from '@/lib/game/constants';
import { getPieceMatrix } from '@/lib/game/tetrominos';

const W = 80;
const FIRST_H = 52;
const REST_H  = 42;
const FIRST_CELL = 16;
const REST_CELL  = 13;
const GAP = 2;
const TOTAL_H = FIRST_H + (REST_H + GAP) * 4;

interface NextQueueProps {
  queue: PieceType[];
}

export const NextQueue = memo(function NextQueue({ queue }: NextQueueProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, W, TOTAL_H);

      const pieces = queue.slice(0, 5);
      pieces.forEach((piece, i) => {
        const isFirst = i === 0;
        const cellSize = isFirst ? FIRST_CELL : REST_CELL;
        const boxH    = isFirst ? FIRST_H    : REST_H;
        const boxY    = isFirst ? 0 : FIRST_H + GAP + (i - 1) * (REST_H + GAP);

        // Subtle separator line above non-first slots
        if (!isFirst) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(8, boxY, W - 16, 1);
        }

        const matrix = getPieceMatrix(piece, 0);
        const color  = PIECE_COLORS[piece];

        let minRow = 3, maxRow = 0, minCol = 3, maxCol = 0;
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
        const ox   = Math.floor((W - cols * cellSize) / 2);
        const oy   = boxY + Math.floor((boxH - rows * cellSize) / 2);

        // Dim pieces after the first one slightly
        ctx.globalAlpha = isFirst ? 1 : 0.72;
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            if (matrix[r][c] !== 0) {
              drawMiniCell(ctx, ox + (c - minCol) * cellSize, oy + (r - minRow) * cellSize, color, cellSize);
            }
          }
        }
        ctx.globalAlpha = 1;
      });
    }, [queue]);

    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-zinc-500">Next</p>
        <canvas
          ref={canvasRef}
          width={W}
          height={TOTAL_H}
          className="border border-white/10"
          style={{ display: 'block', imageRendering: 'auto' }}
        />
      </div>
    );
});

function drawMiniCell(ctx: CanvasRenderingContext2D, px: number, py: number, color: string, size: number) {
  const pad = 1;
  const inner = size - pad * 2;

  ctx.fillStyle = color;
  ctx.fillRect(px + pad, py + pad, inner, inner);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(px + pad, py + pad, inner, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(px + pad, py + pad + 2, 2, inner - 2);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + pad, py + size - pad - 2, inner, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + size - pad - 2, py + pad + 2, 2, inner - 4);
}
