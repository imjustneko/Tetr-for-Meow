import type { GameState, ActivePiece, PieceType, ClearResult, ClearType, GameMode } from './types';
import { GRAVITY_TABLE, LOCK_DELAY, MAX_LOCK_RESETS, ATTACK_TABLE, SCORE_TABLE } from './constants';
import { BagRandomizer, getSpawnPosition } from './tetrominos';
import {
  createBoard,
  isValidPosition,
  lockPiece,
  clearLines,
  addGarbage,
  tryRotate,
  detectTSpin,
  isPerfectClear,
  getHardDropDistance,
  isTopOut,
} from './board';

const NEXT_QUEUE_SIZE = 5;

export class GameEngine {
  private state: GameState;
  private mode: GameMode;
  private bag: BagRandomizer;

  private lastTick = 0;
  private gravityAccumulator = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private isOnGround = false;
  private animFrameId = 0;

  private lastMoveWasRotation = false;

  onStateChange: (state: GameState) => void = () => {};
  onClear: (result: ClearResult) => void = () => {};
  onGameOver: (state: GameState) => void = () => {};
  onGarbageSend: (lines: number) => void = () => {};
  /** Fired after a new active piece is placed (for IRS / handling UI). */
  onPieceSpawn: () => void = () => {};

  constructor(mode: GameMode) {
    this.mode = mode;
    this.bag = new BagRandomizer();
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    const nextQueue = this.bag.fillQueue(NEXT_QUEUE_SIZE);
    return {
      board: createBoard(),
      activePiece: null,
      heldPiece: null,
      canHold: true,
      nextQueue,
      score: 0,
      level: 1,
      lines: 0,
      combo: -1,
      isBackToBack: false,
      garbageQueue: 0,
      isGameOver: false,
      lastClear: null,
      startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      gameTime: 0,
      piecesPlaced: 0,
    };
  }

  start(): void {
    this.spawnPiece();
    this.lastTick = performance.now();
    this.onStateChange({ ...this.state });
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  resume(): void {
    this.lastTick = performance.now();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  getState(): GameState {
    return { ...this.state };
  }

  receiveGarbage(lines: number): void {
    this.state.garbageQueue += lines;
    this.onStateChange({ ...this.state });
  }

  moveLeft(): void {
    const { activePiece, board } = this.state;
    if (!activePiece || this.state.isGameOver) return;

    if (isValidPosition(board, activePiece, -1, 0)) {
      this.state.activePiece = {
        ...activePiece,
        position: { ...activePiece.position, x: activePiece.position.x - 1 },
      };
      this.lastMoveWasRotation = false;
      this.resetLockDelayIfOnGround();
      this.onStateChange({ ...this.state });
    }
  }

  moveRight(): void {
    const { activePiece, board } = this.state;
    if (!activePiece || this.state.isGameOver) return;

    if (isValidPosition(board, activePiece, 1, 0)) {
      this.state.activePiece = {
        ...activePiece,
        position: { ...activePiece.position, x: activePiece.position.x + 1 },
      };
      this.lastMoveWasRotation = false;
      this.resetLockDelayIfOnGround();
      this.onStateChange({ ...this.state });
    }
  }

  softDrop(): void {
    if (this.softDropStep()) {
      this.onStateChange({ ...this.state });
    }
  }

  /** Drop as far as possible in one step (SDF “infinity”). */
  sonicSoftDrop(): void {
    let any = false;
    while (this.softDropStep()) {
      any = true;
    }
    if (any) {
      this.onStateChange({ ...this.state });
    }
  }

  private softDropStep(): boolean {
    const { activePiece, board } = this.state;
    if (!activePiece || this.state.isGameOver) return false;

    if (isValidPosition(board, activePiece, 0, 1)) {
      this.state.activePiece = {
        ...activePiece,
        position: { ...activePiece.position, y: activePiece.position.y + 1 },
      };
      this.state.score += SCORE_TABLE.softDrop;
      this.gravityAccumulator = 0;
      return true;
    }
    return false;
  }

  hardDrop(): void {
    const { activePiece, board } = this.state;
    if (!activePiece || this.state.isGameOver) return;

    const dropDistance = getHardDropDistance(board, activePiece);
    this.state.activePiece = {
      ...activePiece,
      position: {
        ...activePiece.position,
        y: activePiece.position.y + dropDistance,
      },
    };
    this.state.score += SCORE_TABLE.hardDrop * dropDistance;
    this.lockPieceNow();
  }

  rotateClockwise(): void {
    this.rotate(1);
  }

  rotateCounter(): void {
    this.rotate(-1);
  }

  rotate180(): void {
    this.rotate(2);
  }

  hold(): void {
    const { activePiece, heldPiece, canHold } = this.state;
    if (!activePiece || !canHold || this.state.isGameOver) return;

    const pieceToHold = activePiece.type;

    if (heldPiece) {
      this.state.heldPiece = pieceToHold;
      this.spawnSpecificPiece(heldPiece);
    } else {
      this.state.heldPiece = pieceToHold;
      this.state.activePiece = null;
      this.spawnPiece();
    }

    this.state.canHold = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastMoveWasRotation = false;
    this.onStateChange({ ...this.state });
  }

  private rotate(direction: 1 | -1 | 2): void {
    const { activePiece, board } = this.state;
    if (!activePiece || this.state.isGameOver) return;

    const rotated = tryRotate(board, activePiece, direction);
    if (rotated) {
      this.state.activePiece = rotated;
      this.lastMoveWasRotation = true;
      this.resetLockDelayIfOnGround();
      this.onStateChange({ ...this.state });
    }
  }

  private resetLockDelayIfOnGround(): void {
    if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  private spawnPiece(): void {
    const type = this.state.nextQueue.shift()!;
    this.state.nextQueue.push(this.bag.next());
    this.spawnSpecificPiece(type);
  }

  private spawnSpecificPiece(type: PieceType): void {
    const spawnPos = getSpawnPosition(type);
    let piece: ActivePiece = {
      type,
      rotation: 0,
      position: spawnPos,
    };

    if (!isValidPosition(this.state.board, piece)) {
      const nudged: ActivePiece = {
        ...piece,
        position: { ...piece.position, y: piece.position.y - 1 },
      };
      if (!isValidPosition(this.state.board, nudged)) {
        this.state.isGameOver = true;
        this.state.activePiece = null;
        this.onGameOver({ ...this.state });
        cancelAnimationFrame(this.animFrameId);
        return;
      }
      piece = nudged;
    }

    this.state.activePiece = piece;
    this.isOnGround = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.onPieceSpawn();
  }

  private lockPieceNow(): void {
    const { activePiece, board } = this.state;
    if (!activePiece) return;

    const { isTSpin, isMiniTSpin } = detectTSpin(board, activePiece, this.lastMoveWasRotation);

    const newBoard = lockPiece(board, activePiece);
    this.state.piecesPlaced++;

    if (this.state.garbageQueue > 0) {
      const boardWithGarbage = addGarbage(newBoard, this.state.garbageQueue);
      this.state.garbageQueue = 0;
      const { board: clearedBoard, linesCleared } = clearLines(boardWithGarbage);
      this.state.board = clearedBoard;
      this.processClear(linesCleared, isTSpin, isMiniTSpin);
    } else {
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);
      this.state.board = clearedBoard;
      this.processClear(linesCleared, isTSpin, isMiniTSpin);
    }

    this.state.activePiece = null;
    this.state.canHold = true;
    this.lastMoveWasRotation = false;

    // TETR.IO-style: if the stack reaches hidden rows after placement/clears, end immediately.
    if (isTopOut(this.state.board)) {
      this.state.isGameOver = true;
      this.onGameOver({ ...this.state });
      cancelAnimationFrame(this.animFrameId);
      return;
    }

    if (this.checkModeCompletion()) return;

    this.spawnPiece();
    this.onStateChange({ ...this.state });
  }

  private processClear(linesCleared: number, isTSpin: boolean, isMiniTSpin: boolean): void {
    if (linesCleared === 0 && !isTSpin) {
      this.state.combo = -1;
      this.onStateChange({ ...this.state });
      return;
    }

    let clearType: ClearType = 'none';
    if (isTSpin) {
      if (isMiniTSpin) {
        clearType =
          linesCleared === 0 ? 'tSpinMini' : linesCleared === 1 ? 'tSpinMiniSingle' : 'tSpinMiniDouble';
      } else {
        clearType =
          linesCleared === 0
            ? 'none'
            : linesCleared === 1
              ? 'tSpinSingle'
              : linesCleared === 2
                ? 'tSpinDouble'
                : 'tSpinTriple';
      }
    } else {
      clearType =
        linesCleared === 1 ? 'single' : linesCleared === 2 ? 'double' : linesCleared === 3 ? 'triple' : 'tetris';
    }

    const isB2BEligible = linesCleared === 4 || (isTSpin && linesCleared > 0);
    const isBackToBack = this.state.isBackToBack && isB2BEligible;
    this.state.isBackToBack = isB2BEligible;

    if (linesCleared > 0) {
      this.state.combo++;
    } else {
      this.state.combo = -1;
    }

    const isPC = isPerfectClear(this.state.board);

    const scoreKey = clearType as keyof typeof SCORE_TABLE;
    const baseScore = typeof SCORE_TABLE[scoreKey] === 'number' ? (SCORE_TABLE[scoreKey] as number) : 0;
    const b2bBonus = isBackToBack ? baseScore * SCORE_TABLE.backToBack : 0;
    const comboBonus = this.state.combo > 0 ? SCORE_TABLE.combo * this.state.combo : 0;
    const pcBonus = isPC ? SCORE_TABLE.perfectClear : 0;
    const totalScore = Math.floor((baseScore + b2bBonus + comboBonus + pcBonus) * this.state.level);

    const attackKey = clearType as keyof typeof ATTACK_TABLE;
    let attack =
      typeof ATTACK_TABLE[attackKey] === 'number' ? (ATTACK_TABLE[attackKey] as number) : 0;
    if (isBackToBack) attack += ATTACK_TABLE.backToBack;
    const comboIdx = Math.max(0, Math.min(this.state.combo, ATTACK_TABLE.combo.length - 1));
    const comboAttack = ATTACK_TABLE.combo[comboIdx] ?? 0;
    attack += comboAttack;
    if (isPC) attack += ATTACK_TABLE.perfectClear;

    this.state.score += totalScore;
    this.state.lines += linesCleared;
    this.state.level = Math.floor(this.state.lines / 10) + 1;

    const clearResult: ClearResult = {
      linesCleared,
      clearType,
      isTSpin,
      isMiniTSpin,
      isBackToBack,
      isPerfectClear: isPC,
      attack,
      score: totalScore,
      combo: this.state.combo,
    };

    this.state.lastClear = clearResult;

    if (attack > 0) {
      this.onGarbageSend(attack);
    }

    this.onClear(clearResult);
  }

  private checkModeCompletion(): boolean {
    if (this.mode.type === 'sprint' && this.state.lines >= (this.mode.targetLines ?? 40)) {
      this.state.isGameOver = true;
      this.onGameOver({ ...this.state });
      cancelAnimationFrame(this.animFrameId);
      return true;
    }
    return false;
  }

  private getGravityMs(): number {
    const level = Math.min(this.state.level, 15);
    return GRAVITY_TABLE[level] ?? 7;
  }

  private loop = (now: number): void => {
    const delta = now - this.lastTick;
    this.lastTick = now;

    if (!this.state.isGameOver && this.state.activePiece) {
      this.state.gameTime = now - this.state.startTime;

      if (this.mode.type === 'ultra' && this.mode.timeLimit) {
        if (this.state.gameTime >= this.mode.timeLimit) {
          this.state.isGameOver = true;
          this.onGameOver({ ...this.state });
          cancelAnimationFrame(this.animFrameId);
          return;
        }
      }

      const activePiece = this.state.activePiece;
      const board = this.state.board;
      const onGround = !isValidPosition(board, activePiece, 0, 1);

      if (onGround) {
        this.isOnGround = true;
        this.lockTimer += delta;
        if (this.lockTimer >= LOCK_DELAY || this.lockResets >= MAX_LOCK_RESETS) {
          this.lockPieceNow();
          if (!this.state.isGameOver) {
            this.animFrameId = requestAnimationFrame(this.loop);
          }
          return;
        }
      } else {
        this.isOnGround = false;
        this.lockTimer = 0;
        this.gravityAccumulator += delta;
        const gravityMs = this.getGravityMs();
        while (this.gravityAccumulator >= gravityMs) {
          this.gravityAccumulator -= gravityMs;
          const cur: ActivePiece | null = this.state.activePiece;
          if (!cur) break;
          if (isValidPosition(board, cur, 0, 1)) {
            this.state.activePiece = {
              ...cur,
              position: { ...cur.position, y: cur.position.y + 1 },
            };
          }
        }
      }

      this.onStateChange({ ...this.state });
    }

    if (!this.state.isGameOver) {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  };
}
