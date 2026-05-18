'use client';

import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import type { GameState, ClearResult } from '@/lib/game/types';
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

type FlashKind = 'clear-1' | 'clear-2' | 'clear-3' | 'tspin' | 'topout';

export function GameCanvas({
  gameState,
  cellSize = 30,
  suppressGameOverOverlay = false,
  guideCells = [],
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Flash: key changes force re-mount of overlay → re-triggers CSS animation
  const [flash, setFlash] = useState<{ key: number; kind: FlashKind } | null>(null);
  // Shake: applied directly to the wrapper div's class list
  const shakeRef = useRef<boolean>(false);

  const prevClearRef = useRef<ClearResult | null>(null);
  const prevGameOverRef = useRef(false);

  const width = BOARD_WIDTH * cellSize;
  const height = BOARD_HEIGHT * cellSize;

  // ── Line-clear animation ──────────────────────────────────────────────────
  useEffect(() => {
    const cur = gameState.lastClear;
    if (!cur || cur === prevClearRef.current) {
      prevClearRef.current = cur;
      return;
    }
    prevClearRef.current = cur;
    if (cur.linesCleared === 0 && !cur.isTSpin) return;

    const now = Date.now();
    let kind: FlashKind;
    if (cur.isTSpin) {
      kind = 'tspin';
    } else {
      kind = cur.linesCleared >= 4 ? 'clear-3' : cur.linesCleared >= 2 ? 'clear-2' : 'clear-1';
    }
    const strong = cur.linesCleared >= 3 || cur.isTSpin;

    setFlash({ key: now, kind });

    // Trigger shake via DOM class manipulation (avoids React remount)
    const el = wrapperRef.current;
    if (el && !shakeRef.current) {
      shakeRef.current = true;
      el.classList.remove('board-shake-sm', 'board-shake-md');
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add(strong ? 'board-shake-md' : 'board-shake-sm');
      const shakeDur = strong ? 380 : 260;
      const ts = setTimeout(() => {
        el.classList.remove('board-shake-sm', 'board-shake-md');
        shakeRef.current = false;
      }, shakeDur);
      const flashDuration = kind === 'tspin' ? 320 : kind === 'clear-3' ? 280 : kind === 'clear-2' ? 240 : 200;
      const t1 = setTimeout(() => setFlash(null), flashDuration);
      return () => { clearTimeout(ts); clearTimeout(t1); };
    }

    const flashDuration = kind === 'tspin' ? 320 : kind === 'clear-3' ? 280 : kind === 'clear-2' ? 240 : 200;
    const t1 = setTimeout(() => setFlash(null), flashDuration);
    return () => clearTimeout(t1);
  }, [gameState.lastClear]);

  // ── Top-out animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!prevGameOverRef.current && gameState.isGameOver) {
      prevGameOverRef.current = true;
      const key = Date.now();
      setFlash({ key, kind: 'topout' });
      const t = setTimeout(() => setFlash(null), 550);
      return () => clearTimeout(t);
    }
    if (!gameState.isGameOver) prevGameOverRef.current = false;
  }, [gameState.isGameOver]);

  // ── Canvas draw ───────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f0f1e');
    bgGrad.addColorStop(1, '#090912');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

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
      const pieceColor = PIECE_COLORS[gameState.activePiece.type];

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
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
    >
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

      {/* Line-clear / T-spin flash overlay */}
      {flash && flash.kind !== 'topout' && (
        <div
          key={flash.key}
          className={
            flash.kind === 'tspin' ? 'tspin-flash' :
            flash.kind === 'clear-3' ? 'clear-flash clear-flash-3' :
            flash.kind === 'clear-2' ? 'clear-flash clear-flash-2' :
            'clear-flash clear-flash-1'
          }
        />
      )}

      {/* Top-out red flash */}
      {flash && flash.kind === 'topout' && (
        <div key={flash.key} className="topout-flash" />
      )}
    </div>
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

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(px + pad, py + pad, inner, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(px + pad, py + pad + 2, 2, inner - 2);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + pad, py + size - pad - 2, inner, 2);
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
