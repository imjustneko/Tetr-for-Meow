export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Board = CellValue[][];

export interface Position {
  x: number;
  y: number;
}

export interface ActivePiece {
  type: PieceType;
  rotation: 0 | 1 | 2 | 3;
  position: Position;
}

export type ClearType =
  | 'none'
  | 'single'
  | 'double'
  | 'triple'
  | 'tetris'
  | 'tSpinMini'
  | 'tSpinMiniSingle'
  | 'tSpinMiniDouble'
  | 'tSpinSingle'
  | 'tSpinDouble'
  | 'tSpinTriple';

export interface ClearResult {
  linesCleared: number;
  clearType: ClearType;
  isTSpin: boolean;
  isMiniTSpin: boolean;
  isBackToBack: boolean;
  isPerfectClear: boolean;
  attack: number;
  score: number;
  combo: number;
}

export interface GameState {
  board: Board;
  activePiece: ActivePiece | null;
  heldPiece: PieceType | null;
  canHold: boolean;
  nextQueue: PieceType[];
  score: number;
  level: number;
  lines: number;
  combo: number;
  isBackToBack: boolean;
  garbageQueue: number;
  pendingGarbage: number;
  isGameOver: boolean;
  lastClear: ClearResult | null;
  startTime: number;
  gameTime: number;
  piecesPlaced: number;
}

export interface GameMode {
  type: 'solo' | 'sprint' | 'ultra' | 'versus' | 'practice';
  targetLines?: number;
  timeLimit?: number;
}

export type GameAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateClockwise'
  | 'rotateCounter'
  | 'rotate180'
  | 'hold';
