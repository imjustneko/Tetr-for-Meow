'use client';

import { useLayoutEffect, useRef } from 'react';
import type { GameState } from '@/lib/game/types';
import { BOARD_WIDTH, BOARD_HEIGHT, HIDDEN_ROWS, PIECE_COLORS } from '@/lib/game/constants';
import { getGhostPosition } from '@/lib/game/board';
import { getPieceMatrix } from '@/lib/game/tetrominos';

interface GameCanvasProps {
  gameState: GameState;
  cellSize?: number;
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

    // ── Background: subtle top-to-bottom gradient ─────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f0f1e');
    bgGrad.addColorStop(1, '#090912');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Grid lines ────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
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

    // ── Locked board cells ────────────────────────────────────────
    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        const cell = gameState.board[row + HIDDEN_ROWS]?.[col] ?? 0;
        if (cell === 0) continue;
        const pieceType = PIECE_TYPE_MAP[cell] ?? 'G';
        drawCell(ctx, col, row, PIECE_COLORS[pieceType] ?? '#888', cellSize);
      }
    }

    // ── Ghost + active piece ──────────────────────────────────────
    if (gameState.activePiece) {
      const ghost = getGhostPosition(gameState.board, gameState.activePiece);
      const matrix = getPieceMatrix(gameState.activePiece.type, gameState.activePiece.rotation);
      const pieceColor = PIECE_COLORS[gameState.activePiece.type];

      // Ghost — Tetr.io style: stroke only, no fill
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (matrix[row][col] === 0) continue;
          const boardX = gameState.activePiece.position.x + col;
          const boardY = ghost.y + row;
          const viewY = boardY - HIDDEN_ROWS;
          if (viewY >= 0 && viewY < BOARD_HEIGHT) {
            drawCellGhost(ctx, boardX, viewY, pieceColor, cellSize);
          }
        }
      }

      // Active piece (drawn on top of ghost)
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (matrix[row][col] === 0) continue;
          const boardX = gameState.activePiece.position.x + col;
          const boardY = gameState.activePiece.position.y + row;
          const viewY = boardY - HIDDEN_ROWS;
          if (viewY >= 0 && viewY < BOARD_HEIGHT) {
            drawCell(ctx, boardX, viewY, pieceColor, cellSize);
          }
        }
      }
    }

    // ── Guide cells (training mode) ───────────────────────────────
    if (guideCells.length) {
      for (const cell of guideCells) {
        const px = cell.x * cellSize;
        const py = cell.y * cellSize;
        ctx.fillStyle = cell.color ?? 'rgba(0, 245, 255, 0.18)';
        ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
      }
    }

    // ── Game Over overlay ─────────────────────────────────────────
    if (gameState.isGameOver && !suppressGameOverOverlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ff4455';
      ctx.font = `bold ${Math.round(cellSize * 0.95)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', width / 2, height / 2);
    }
  }, [gameState, cellSize, width, height, suppressGameOverOverlay, guideCells]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="board-glow"
      style={{
        imageRendering: 'auto',
        display: 'block',
        width,
        height,
        transform: 'translateZ(0)',
      }}
    />
  );
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  const pad = 1;
  const inner = size - pad * 2;

  ctx.fillStyle = color;
  ctx.fillRect(px + pad, py + pad, inner, inner);

  // Top highlight — brightest (2 px)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(px + pad, py + pad, inner, 2);
  // Left highlight — dimmer (2 px)
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(px + pad, py + pad + 2, 2, inner - 2);

  // Bottom shadow (2 px)
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + pad, py + size - pad - 2, inner, 2);
  // Right shadow (2 px)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + size - pad - 2, py + pad + 2, 2, inner - 4);
}

function drawCellGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const px = x * size;
  const py = y * size;
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  ctx.restore();
}
