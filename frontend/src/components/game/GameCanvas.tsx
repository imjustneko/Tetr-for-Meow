'use client';

import { useLayoutEffect, useRef } from 'react';
import type { GameState } from '@/lib/game/types';
import { BOARD_WIDTH, BOARD_HEIGHT, HIDDEN_ROWS, PIECE_COLORS, PIECE_GHOST_COLORS } from '@/lib/game/constants';
import { getGhostPosition } from '@/lib/game/board';
import { getPieceMatrix } from '@/lib/game/tetrominos';

interface GameCanvasProps {
  gameState: GameState;
  cellSize?: number;
  /** Hide built-in GAME OVER text when a parent overlay handles end state */
  suppressGameOverOverlay?: boolean;
  guideCells?: Array<{ x: number; y: number; color?: string }>;
}

const PIECE_TYPE_MAP = ['', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];

export function GameCanvas({
  gameState,
  cellSize = 30,
  suppressGameOverOverlay = false,
  guideCells = [],
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const width = BOARD_WIDTH * cellSize;
  const height = BOARD_HEIGHT * cellSize;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
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

    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const cell = gameState.board[row + HIDDEN_ROWS]?.[col] ?? 0;
        if (cell === 0) continue;
        const pieceType = PIECE_TYPE_MAP[cell] ?? 'G';
        drawCell(ctx, col, row, PIECE_COLORS[pieceType] ?? '#888', cellSize);
      }
    }

    if (gameState.activePiece) {
      const ghost = getGhostPosition(gameState.board, gameState.activePiece);
      const matrix = getPieceMatrix(gameState.activePiece.type, gameState.activePiece.rotation);
      const ghostColor = PIECE_GHOST_COLORS[gameState.activePiece.type] ?? 'rgba(128,128,128,0.2)';

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (matrix[row][col] === 0) continue;
          const boardX = gameState.activePiece.position.x + col;
          const boardY = ghost.y + row;
          const viewY = boardY - HIDDEN_ROWS;
          if (viewY >= 0 && viewY < BOARD_HEIGHT) {
            drawCellGhost(ctx, boardX, viewY, ghostColor, cellSize);
          }
        }
      }

      const activeColor = PIECE_COLORS[gameState.activePiece.type];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (matrix[row][col] === 0) continue;
          const boardX = gameState.activePiece.position.x + col;
          const boardY = gameState.activePiece.position.y + row;
          const viewY = boardY - HIDDEN_ROWS;
          if (viewY >= 0 && viewY < BOARD_HEIGHT) {
            drawCell(ctx, boardX, viewY, activeColor, cellSize);
          }
        }
      }
    }

    if (guideCells.length) {
      for (const cell of guideCells) {
        const px = cell.x * cellSize;
        const py = cell.y * cellSize;
        ctx.fillStyle = cell.color ?? 'rgba(0, 245, 255, 0.2)';
        ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
      }
    }

    if (gameState.isGameOver && !suppressGameOverOverlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ff4444';
      ctx.font = `bold ${cellSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', width / 2, height / 2);
    }
  }, [gameState, cellSize, width, height, suppressGameOverOverlay, guideCells]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        imageRendering: 'auto',
        display: 'block',
        width,
        height,
        transform: 'translateZ(0)',
      }}
      className="border border-white/20 bg-black/50 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]"
    />
  );
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  const pad = 1;

  ctx.fillStyle = color;
  ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px + pad, py + pad, size - pad * 2, 3);
  ctx.fillRect(px + pad, py + pad, 3, size - pad * 2);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + pad, py + size - pad - 3, size - pad * 2, 3);
  ctx.fillRect(px + size - pad - 3, py + pad, 3, size - pad * 2);
}

function drawCellGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
}
