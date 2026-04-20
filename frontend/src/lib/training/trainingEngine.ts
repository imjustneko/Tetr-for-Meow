import type { GameState, ClearResult, ActivePiece, Board, PieceType } from '@/lib/game/types';
import type { Lesson, LessonStep } from './lessons';
import { BOARD_HEIGHT, GRAVITY_TABLE, LOCK_DELAY, MAX_LOCK_RESETS } from '@/lib/game/constants';
import { getSpawnPosition } from '@/lib/game/tetrominos';
import {
  isValidPosition,
  lockPiece,
  clearLines,
  tryRotate,
  detectTSpin,
  isPerfectClear,
  getHardDropDistance,
} from '@/lib/game/board';
import type { ClearType } from '@/lib/game/types';

export type StepResult = 'success' | 'fail' | 'pending';

export interface HologramData {
  x: number;
  y: number;
  rotation: 0 | 1 | 2 | 3;
  piece: PieceType;
}

export interface TrainingState {
  gameState: GameState;
  currentStep: number;
  totalSteps: number;
  stepResult: StepResult;
  feedbackMessage: string;
  lessonComplete: boolean;
  hologram: HologramData | null;
}

export class TrainingEngine {
  private lesson: Lesson;
  private currentStepIndex = 0;
  private stepResult: StepResult = 'pending';
  private feedbackMessage = '';
  private lessonComplete = false;

  private board: Board;
  private activePiece: ActivePiece | null = null;
  private heldPiece: PieceType | null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private combo = -1;
  private isBackToBack = false;
  private piecesPlaced = 0;
  private startTime = Date.now();
  private linesCleared = 0;

  private pieceQueue: PieceType[];
  private queuePosition = 0;

  private animFrame = 0;
  private lastTick = 0;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private isOnGround = false;
  private lastMoveWasRotation = false;
  private isPaused = false;
  private isGameOver = false;

  private showHologramActive = true;

  onStateChange: (state: TrainingState) => void = () => {};
  onStepComplete: (index: number, result: StepResult) => void = () => {};

  constructor(lesson: Lesson) {
    this.lesson = lesson;
    this.board = lesson.initialBoard.map((row) => [...row]) as Board;
    this.heldPiece = lesson.initialHold;
    this.pieceQueue = this.buildQueue(lesson.initialQueue);
    this.queuePosition = 0;
  }

  private buildQueue(forced: PieceType[]): PieceType[] {
    const allPieces: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const queue = [...forced];
    while (queue.length < 50) {
      const bag = [...allPieces];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      queue.push(...bag);
    }
    return queue;
  }

  private nextPiece(): PieceType {
    const piece = this.pieceQueue[this.queuePosition % this.pieceQueue.length];
    this.queuePosition++;
    return piece;
  }

  private getNextQueuePreview(): PieceType[] {
    return Array.from({ length: 5 }, (_, i) => this.pieceQueue[(this.queuePosition + i) % this.pieceQueue.length]);
  }

  private computeHologram(): HologramData | null {
    if (!this.showHologramActive) return null;
    if (this.stepResult !== 'pending') return null;

    const step = this.getCurrentStep();
    if (!step) return null;

    const target = step.targetPosition;
    const piece = step.neededPiece;
    if (!this.activePiece || this.activePiece.type !== piece) return null;

    const testPiece: ActivePiece = {
      type: piece,
      rotation: target.rotation,
      position: { x: target.x, y: -2 },
    };

    let bestY = target.y;
    let testY = -4;
    while (testY < BOARD_HEIGHT) {
      const test = { ...testPiece, position: { x: target.x, y: testY } };
      if (!isValidPosition(this.board, test)) {
        bestY = testY - 1;
        break;
      }
      if (testY === BOARD_HEIGHT - 1) {
        bestY = testY;
        break;
      }
      testY++;
    }

    const holoPiece: ActivePiece = {
      type: piece,
      rotation: target.rotation,
      position: { x: target.x, y: bestY },
    };
    if (!isValidPosition(this.board, holoPiece, 0, 0)) return null;

    return {
      x: target.x,
      y: bestY,
      rotation: target.rotation,
      piece,
    };
  }

  private getCurrentStep(): LessonStep | null {
    return this.lesson.steps[this.currentStepIndex] ?? null;
  }

  private spawnNext(): void {
    const type = this.nextPiece();
    this.spawnPiece(type);
  }

  private spawnPiece(type: PieceType): void {
    const pos = getSpawnPosition(type);
    const piece: ActivePiece = { type, rotation: 0, position: pos };

    if (!isValidPosition(this.board, piece) && !isValidPosition(this.board, piece, 0, -1)) {
      this.isGameOver = true;
      this.activePiece = null;
      this.emitState();
      return;
    }

    this.activePiece = piece;
    this.isOnGround = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastMoveWasRotation = false;
    this.emitState();
  }

  private lockActive(): void {
    if (!this.activePiece) return;

    const { isTSpin, isMiniTSpin } = detectTSpin(this.board, this.activePiece, this.lastMoveWasRotation);
    const newBoard = lockPiece(this.board, this.activePiece);
    const { board: clearedBoard, linesCleared } = clearLines(newBoard);
    this.board = clearedBoard;
    this.piecesPlaced++;
    this.linesCleared += linesCleared;
    this.lines += linesCleared;

    const isPC = isPerfectClear(this.board);
    const isB2BEligible = linesCleared === 4 || (isTSpin && linesCleared > 0);
    const wasB2B = this.isBackToBack && isB2BEligible;
    this.isBackToBack = isB2BEligible;
    if (linesCleared > 0) this.combo++;
    else this.combo = -1;

    const clearResult: ClearResult = {
      linesCleared,
      clearType: this.determineClearType(linesCleared, isTSpin, isMiniTSpin),
      isTSpin,
      isMiniTSpin,
      isBackToBack: wasB2B,
      isPerfectClear: isPC,
      attack: 0,
      score: 0,
      combo: this.combo,
    };

    this.activePiece = null;
    this.canHold = true;
    this.lastMoveWasRotation = false;
    this.checkStepSuccess(clearResult, linesCleared, isTSpin, isMiniTSpin, isPC);
  }

  private determineClearType(lines: number, isTSpin: boolean, isMini: boolean): ClearType {
    if (isTSpin) {
      if (isMini) {
        return lines === 1 ? 'tSpinMiniSingle' : lines === 2 ? 'tSpinMiniDouble' : 'tSpinMini';
      }
      return lines === 1 ? 'tSpinSingle' : lines === 2 ? 'tSpinDouble' : lines === 3 ? 'tSpinTriple' : 'none';
    }
    return lines === 1 ? 'single' : lines === 2 ? 'double' : lines === 3 ? 'triple' : lines === 4 ? 'tetris' : 'none';
  }

  private checkStepSuccess(
    result: ClearResult,
    linesCleared: number,
    isTSpin: boolean,
    isMini: boolean,
    isPC: boolean
  ): void {
    const step = this.getCurrentStep();
    if (!step) {
      this.spawnNext();
      this.emitState();
      return;
    }

    const cond = step.successCondition;
    let success = false;

    switch (cond.type) {
      case 'place':
        success = true;
        break;
      case 'clear':
        success = linesCleared >= (cond.minLines || 1);
        break;
      case 'tspin':
        success = isTSpin && linesCleared >= (cond.minLines || 1);
        break;
      case 'tspin_double':
        success = isTSpin && !isMini && linesCleared === 2;
        break;
      case 'tspin_triple':
        success = isTSpin && linesCleared === 3;
        break;
      case 'perfect_clear':
        success = isPC;
        break;
    }

    if (success) {
      this.stepResult = 'success';
      this.feedbackMessage = step.feedbackSuccess;
      this.isPaused = true;
      this.onStepComplete(this.currentStepIndex, 'success');

      setTimeout(() => {
        this.currentStepIndex++;
        this.stepResult = 'pending';
        this.feedbackMessage = '';

        if (this.currentStepIndex >= this.lesson.steps.length) {
          this.lessonComplete = true;
          this.isPaused = true;
          this.emitState();
        } else {
          this.isPaused = false;
          this.spawnNext();
          this.emitState();
        }
      }, 1500);
    } else {
      if (linesCleared > 0 || cond.type === 'place') {
        this.stepResult = 'fail';
        this.feedbackMessage = step.feedbackFail;
        this.isPaused = true;

        setTimeout(() => {
          if (this.stepResult === 'fail') {
            this.stepResult = 'pending';
            this.feedbackMessage = '';
            this.isPaused = false;
            this.spawnNext();
            this.emitState();
          }
        }, 2500);
      } else {
        this.spawnNext();
      }
    }

    this.emitState();
  }

  private emitState(): void {
    const gameState: GameState = {
      board: this.board,
      activePiece: this.activePiece,
      heldPiece: this.heldPiece,
      canHold: this.canHold,
      nextQueue: this.getNextQueuePreview(),
      score: this.score,
      level: 1,
      lines: this.lines,
      combo: this.combo,
      isBackToBack: this.isBackToBack,
      garbageQueue: 0,
      isGameOver: this.isGameOver,
      lastClear: null,
      startTime: this.startTime,
      gameTime: Date.now() - this.startTime,
      piecesPlaced: this.piecesPlaced,
    };

    const hologram = this.computeHologram();
    this.onStateChange({
      gameState,
      currentStep: this.currentStepIndex,
      totalSteps: this.lesson.steps.length,
      stepResult: this.stepResult,
      feedbackMessage: this.feedbackMessage,
      lessonComplete: this.lessonComplete,
      hologram,
    });
  }

  private loop = (now: number): void => {
    if (this.isGameOver) return;

    const delta = now - this.lastTick;
    this.lastTick = now;

    if (!this.isPaused && this.activePiece) {
      const onGround = !isValidPosition(this.board, this.activePiece, 0, 1);

      if (onGround) {
        this.isOnGround = true;
        this.lockTimer += delta;
        if (this.lockTimer >= LOCK_DELAY) {
          this.lockActive();
          this.animFrame = requestAnimationFrame(this.loop);
          return;
        }
      } else {
        this.isOnGround = false;
        this.lockTimer = 0;
        this.gravityAcc += delta;
        const gravMs = GRAVITY_TABLE[1];
        while (this.gravityAcc >= gravMs) {
          this.gravityAcc -= gravMs;
          if (isValidPosition(this.board, this.activePiece, 0, 1)) {
            this.activePiece = {
              ...this.activePiece,
              position: { ...this.activePiece.position, y: this.activePiece.position.y + 1 },
            };
          }
        }
      }

      this.emitState();
    }

    this.animFrame = requestAnimationFrame(this.loop);
  };

  start(): void {
    this.spawnNext();
    this.lastTick = performance.now();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  restart(): void {
    cancelAnimationFrame(this.animFrame);
    this.board = this.lesson.initialBoard.map((row) => [...row]) as Board;
    this.heldPiece = this.lesson.initialHold;
    this.canHold = true;
    this.activePiece = null;
    this.currentStepIndex = 0;
    this.stepResult = 'pending';
    this.feedbackMessage = '';
    this.lessonComplete = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.isOnGround = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.gravityAcc = 0;
    this.combo = -1;
    this.isBackToBack = false;
    this.lines = 0;
    this.linesCleared = 0;
    this.piecesPlaced = 0;
    this.startTime = Date.now();
    this.pieceQueue = this.buildQueue(this.lesson.initialQueue);
    this.queuePosition = 0;
    this.start();
  }

  stop(): void {
    cancelAnimationFrame(this.animFrame);
  }

  setShowHologram(show: boolean): void {
    this.showHologramActive = show;
    this.emitState();
  }

  moveLeft(): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;
    if (isValidPosition(this.board, this.activePiece, -1, 0)) {
      this.activePiece = {
        ...this.activePiece,
        position: { ...this.activePiece.position, x: this.activePiece.position.x - 1 },
      };
      this.lastMoveWasRotation = false;
      this.resetLock();
      this.emitState();
    }
  }

  moveRight(): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;
    if (isValidPosition(this.board, this.activePiece, 1, 0)) {
      this.activePiece = {
        ...this.activePiece,
        position: { ...this.activePiece.position, x: this.activePiece.position.x + 1 },
      };
      this.lastMoveWasRotation = false;
      this.resetLock();
      this.emitState();
    }
  }

  softDrop(): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;
    if (isValidPosition(this.board, this.activePiece, 0, 1)) {
      this.activePiece = {
        ...this.activePiece,
        position: { ...this.activePiece.position, y: this.activePiece.position.y + 1 },
      };
      this.gravityAcc = 0;
      this.emitState();
    }
  }

  hardDrop(): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;
    const dist = getHardDropDistance(this.board, this.activePiece);
    this.activePiece = {
      ...this.activePiece,
      position: { ...this.activePiece.position, y: this.activePiece.position.y + dist },
    };
    this.emitState();
    this.lockActive();
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
    if (!this.activePiece || !this.canHold || this.isPaused || this.isGameOver) return;
    const toHold = this.activePiece.type;
    if (this.heldPiece) {
      const swap = this.heldPiece;
      this.heldPiece = toHold;
      this.spawnPiece(swap);
    } else {
      this.heldPiece = toHold;
      this.spawnNext();
    }
    this.canHold = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.emitState();
  }

  private rotate(dir: 1 | -1 | 2): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;
    const rotated = tryRotate(this.board, this.activePiece, dir);
    if (rotated) {
      this.activePiece = rotated;
      this.lastMoveWasRotation = true;
      this.resetLock();
      this.emitState();
    }
  }

  private resetLock(): void {
    if (this.isOnGround && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }
}
