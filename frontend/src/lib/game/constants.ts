export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const HIDDEN_ROWS = 3;
export const BOARD_TOTAL_HEIGHT = BOARD_HEIGHT + HIDDEN_ROWS;

export const GRAVITY_TABLE: Record<number, number> = {
  1: 1000,
  2: 793,
  3: 618,
  4: 473,
  5: 355,
  6: 262,
  7: 190,
  8: 135,
  9: 94,
  10: 64,
  11: 43,
  12: 28,
  13: 18,
  14: 11,
  15: 7,
};

export const LOCK_DELAY = 500;
export const MAX_LOCK_RESETS = 15;

export const ATTACK_TABLE = {
  single: 0,
  double: 1,
  triple: 2,
  tetris: 4,
  tSpinMini: 1,
  tSpinSingle: 2,
  tSpinDouble: 4,
  tSpinTriple: 6,
  combo: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
  backToBack: 1,
  perfectClear: 10,
} as const;

export const SCORE_TABLE = {
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
  tSpinMini: 100,
  tSpinMiniSingle: 200,
  tSpinMiniDouble: 400,
  tSpinSingle: 400,
  tSpinDouble: 1200,
  tSpinTriple: 1600,
  softDrop: 1,
  hardDrop: 2,
  combo: 50,
  backToBack: 0.5,
  perfectClear: 3500,
} as const;

export const PIECE_COLORS: Record<string, string> = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
  G: '#555566',
};

export const PIECE_GHOST_COLORS: Record<string, string> = {
  I: 'rgba(0,240,240,0.2)',
  O: 'rgba(240,240,0,0.2)',
  T: 'rgba(160,0,240,0.2)',
  S: 'rgba(0,240,0,0.2)',
  Z: 'rgba(240,0,0,0.2)',
  J: 'rgba(0,0,240,0.2)',
  L: 'rgba(240,160,0,0.2)',
  G: 'rgba(85,85,102,0.2)',
};
