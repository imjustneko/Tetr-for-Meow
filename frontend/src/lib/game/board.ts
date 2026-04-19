import type { Board, ActivePiece, CellValue, Position } from './types';
import { BOARD_WIDTH, BOARD_HEIGHT, BOARD_TOTAL_HEIGHT, HIDDEN_ROWS } from './constants';
import { getPieceMatrix, WALL_KICKS_JLSTZ, WALL_KICKS_I } from './tetrominos';

export function createBoard(): Board {
  // Internal board includes hidden rows (TETR.IO-style spawn buffer).
  return Array.from({ length: BOARD_TOTAL_HEIGHT }, () => Array(BOARD_WIDTH).fill(0) as CellValue[]);
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function isValidPosition(
  board: Board,
  piece: ActivePiece,
  offsetX = 0,
  offsetY = 0
): boolean {
  const matrix = getPieceMatrix(piece.type, piece.rotation);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (matrix[row][col] === 0) continue;

      const boardX = piece.position.x + col + offsetX;
      const boardY = piece.position.y + row + offsetY;

      if (boardY < 0) continue;

      if (boardX < 0 || boardX >= BOARD_WIDTH) return false;

      if (boardY >= BOARD_TOTAL_HEIGHT) return false;

      if (board[boardY][boardX] !== 0) return false;
    }
  }
  return true;
}

export function lockPiece(board: Board, piece: ActivePiece): Board {
  const newBoard = cloneBoard(board);
  const matrix = getPieceMatrix(piece.type, piece.rotation);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (matrix[row][col] === 0) continue;
      const boardX = piece.position.x + col;
      const boardY = piece.position.y + row;
      if (boardY >= 0 && boardY < BOARD_TOTAL_HEIGHT) {
        newBoard[boardY][boardX] = matrix[row][col] as CellValue;
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter((row) => row.some((cell) => cell === 0));
  const linesCleared = BOARD_TOTAL_HEIGHT - newBoard.length;

  const emptyRows = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill(0) as CellValue[]);

  return {
    board: [...emptyRows, ...newBoard],
    linesCleared,
  };
}

export function addGarbage(board: Board, lines: number): Board {
  const newBoard = cloneBoard(board);
  const holeX = Math.floor(Math.random() * BOARD_WIDTH);

  newBoard.splice(0, lines);

  for (let i = 0; i < lines; i++) {
    const garbageRow = Array(BOARD_WIDTH).fill(8) as CellValue[];
    garbageRow[holeX] = 0;
    newBoard.push(garbageRow);
  }
  return newBoard;
}

export function tryRotate(board: Board, piece: ActivePiece, direction: 1 | -1 | 2): ActivePiece | null {
  let newRotation: 0 | 1 | 2 | 3;

  if (direction === 2) {
    newRotation = ((piece.rotation + 2) % 4) as 0 | 1 | 2 | 3;
  } else {
    newRotation = ((piece.rotation + direction + 4) % 4) as 0 | 1 | 2 | 3;
  }

  const rotatedPiece: ActivePiece = { ...piece, rotation: newRotation };

  if (direction === 2) {
    if (isValidPosition(board, rotatedPiece)) {
      return rotatedPiece;
    }
    const offsets: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of offsets) {
      const test = {
        ...rotatedPiece,
        position: { x: piece.position.x + dx, y: piece.position.y + dy },
      };
      if (isValidPosition(board, test)) return test;
    }
    return null;
  }

  const kickKey = `${piece.rotation}_${newRotation}`;
  const kicks = piece.type === 'I' ? WALL_KICKS_I[kickKey] : WALL_KICKS_JLSTZ[kickKey];

  if (!kicks) return null;

  for (const [dx, dy] of kicks) {
    const testPiece: ActivePiece = {
      ...rotatedPiece,
      position: {
        x: piece.position.x + dx,
        y: piece.position.y - dy,
      },
    };
    if (isValidPosition(board, testPiece)) {
      return testPiece;
    }
  }

  return null;
}

export function getGhostPosition(board: Board, piece: ActivePiece): Position {
  let y = piece.position.y;
  while (
    isValidPosition(board, {
      ...piece,
      position: { x: piece.position.x, y: y + 1 },
    })
  ) {
    y++;
  }
  return { x: piece.position.x, y };
}

export function detectTSpin(
  board: Board,
  piece: ActivePiece,
  lastMoveWasRotation: boolean
): { isTSpin: boolean; isMiniTSpin: boolean } {
  if (piece.type !== 'T' || !lastMoveWasRotation) {
    return { isTSpin: false, isMiniTSpin: false };
  }

  const { x, y } = piece.position;
  const rotation = piece.rotation;

  const corners: [number, number][] = [
    [x, y],
    [x + 2, y],
    [x, y + 2],
    [x + 2, y + 2],
  ];

  const occupiedCorners = corners.filter(([cx, cy]) => {
    if (cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_TOTAL_HEIGHT) return true;
    return board[cy]?.[cx] !== 0;
  }).length;

  if (occupiedCorners < 3) return { isTSpin: false, isMiniTSpin: false };

  const frontCorners: Record<number, [number, number][]> = {
    0: [
      [x, y],
      [x + 2, y],
    ],
    1: [
      [x + 2, y],
      [x + 2, y + 2],
    ],
    2: [
      [x, y + 2],
      [x + 2, y + 2],
    ],
    3: [
      [x, y],
      [x, y + 2],
    ],
  };

  const front = frontCorners[rotation];
  const frontOccupied = front.filter(([cx, cy]) => {
    if (cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_TOTAL_HEIGHT) return true;
    return board[cy]?.[cx] !== 0;
  }).length;

  if (frontOccupied === 2) return { isTSpin: true, isMiniTSpin: false };
  return { isTSpin: true, isMiniTSpin: true };
}

export function isPerfectClear(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell === 0));
}

export function getHardDropDistance(board: Board, piece: ActivePiece): number {
  const ghost = getGhostPosition(board, piece);
  return ghost.y - piece.position.y;
}

/**
 * Top-out when any blocks occupy the hidden spawn buffer rows.
 * (i.e. stack reaches into rows [0..HIDDEN_ROWS-1]).
 */
export function isTopOut(board: Board): boolean {
  for (let y = 0; y < HIDDEN_ROWS; y++) {
    const row = board[y];
    if (!row) continue;
    if (row.some((c) => c !== 0)) return true;
  }
  return false;
}
