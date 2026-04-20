'use client';

import { useEffect, useRef } from 'react';
import { GameState } from '@/lib/game/types';
import { BOARD_WIDTH, BOARD_HEIGHT, PIECE_COLORS, PIECE_GHOST_COLORS } from '@/lib/game/constants';
import { getGhostPosition } from '@/lib/game/board';
import { getPieceMatrix } from '@/lib/game/tetrominos';
import { HologramData } from '@/lib/training/trainingEngine';

const PIECE_TYPE_MAP = ['', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];
const CELL = 28;

interface TrainingCanvasProps {
  gameState: GameState;
  hologram: HologramData | null;
}

export function TrainingCanvas({ gameState, hologram }: TrainingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const frameRef = useRef(0);

  const width = BOARD_WIDTH * CELL;
  const height = BOARD_HEIGHT * CELL;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      frameRef.current++;
      const pulse = (Math.sin(frameRef.current * 0.07) + 1) / 2;

      ctx.fillStyle = '#08081a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, height);
        ctx.stroke();
      }
      for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(width, y * CELL);
        ctx.stroke();
      }

      for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const cell = gameState.board[row][col];
          if (!cell) continue;
          const type = PIECE_TYPE_MAP[cell];
          drawCell(ctx, col, row, PIECE_COLORS[type] || '#445566', CELL);
        }
      }

      if (gameState.activePiece) {
        const ghost = getGhostPosition(gameState.board, gameState.activePiece);
        const matrix = getPieceMatrix(gameState.activePiece.type, gameState.activePiece.rotation);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (!matrix[r][c]) continue;
            const bx = gameState.activePiece.position.x + c;
            const by = ghost.y + r;
            if (by >= 0 && by < BOARD_HEIGHT) {
              drawGhost(ctx, bx, by, PIECE_GHOST_COLORS[gameState.activePiece.type], CELL);
            }
          }
        }
      }

      if (hologram) {
        const hMatrix = getPieceMatrix(hologram.piece, hologram.rotation);
        const color = PIECE_COLORS[hologram.piece];
        const alpha = 0.22 + pulse * 0.28;
        const cells: { bx: number; by: number }[] = [];

        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (!hMatrix[r][c]) continue;
            const bx = hologram.x + c;
            const by = hologram.y + r;
            if (by < 0 || by >= BOARD_HEIGHT || bx < 0 || bx >= BOARD_WIDTH) continue;
            cells.push({ bx, by });
          }
        }

        for (const { bx, by } of cells) {
          const px = bx * CELL;
          const py = by * CELL;

          ctx.shadowColor = color;
          ctx.shadowBlur = 10 + pulse * 14;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);

          ctx.globalAlpha = 0.55 + pulse * 0.35;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);

          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;

          const cs = 5;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.85 + pulse * 0.15;
          ctx.fillRect(px + 2, py + 2, cs, 2);
          ctx.fillRect(px + 2, py + 2, 2, cs);
          ctx.fillRect(px + CELL - 2 - cs, py + 2, cs, 2);
          ctx.fillRect(px + CELL - 4, py + 2, 2, cs);
          ctx.fillRect(px + 2, py + CELL - 4, cs, 2);
          ctx.fillRect(px + 2, py + CELL - 2 - cs, 2, cs);
          ctx.fillRect(px + CELL - 2 - cs, py + CELL - 4, cs, 2);
          ctx.fillRect(px + CELL - 4, py + CELL - 2 - cs, 2, cs);
          ctx.globalAlpha = 1;
        }

        if (cells.length > 0) {
          const minBy = Math.min(...cells.map((c) => c.by));
          const avgBx = cells.reduce((s, c) => s + c.bx, 0) / cells.length;
          const arrowX = (avgBx + 0.5) * CELL;
          const arrowY = minBy * CELL;

          if (arrowY > 30) {
            ctx.globalAlpha = 0.45 + pulse * 0.45;
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(arrowX - 9, arrowY - 20);
            ctx.lineTo(arrowX + 9, arrowY - 20);
            ctx.lineTo(arrowX, arrowY - 4);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          }
        }
      }

      if (gameState.activePiece) {
        const matrix = getPieceMatrix(gameState.activePiece.type, gameState.activePiece.rotation);
        const color = PIECE_COLORS[gameState.activePiece.type];
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (!matrix[r][c]) continue;
            const bx = gameState.activePiece.position.x + c;
            const by = gameState.activePiece.position.y + r;
            if (by >= 0 && by < BOARD_HEIGHT) {
              drawCell(ctx, bx, by, color, CELL);
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, hologram, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'pixelated', display: 'block' }}
      className="rounded border border-[#2a2a3a]"
    />
  );
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  const p = 1;
  ctx.fillStyle = color;
  ctx.fillRect(px + p, py + p, size - p * 2, size - p * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(px + p, py + p, size - p * 2, 3);
  ctx.fillRect(px + p, py + p, 3, size - p * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(px + p, py + size - p - 3, size - p * 2, 3);
  ctx.fillRect(px + size - p - 3, py + p, 3, size - p * 2);
}

function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = color.replace('0.2', '0.4');
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
}
