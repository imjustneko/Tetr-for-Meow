'use client';

import { memo, useEffect, useRef } from 'react';
import type { PieceType } from '@/lib/game/types';
import { PIECE_COLORS } from '@/lib/game/constants';
import { getPieceMatrix } from '@/lib/game/tetrominos';

const W = 80;
const H = 52;
const CELL = 16;

interface HoldBoxProps {
  heldPiece: PieceType | null;
  canHold: boolean;
}

export const HoldBox = memo(function HoldBox({ heldPiece, canHold }: HoldBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);

    if (!heldPiece) return;

    const matrix = getPieceMatrix(heldPiece, 0);
    const color = PIECE_COLORS[heldPiece];

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
    const ox = Math.floor((W - cols * CELL) / 2);
    const oy = Math.floor((H - rows * CELL) / 2);

    if (!canHold) ctx.globalAlpha = 0.32;
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (matrix[r][c] !== 0) {
          drawMiniCell(ctx, ox + (c - minCol) * CELL, oy + (r - minRow) * CELL, color, CELL);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [heldPiece, canHold]);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-zinc-500">Hold</p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
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
