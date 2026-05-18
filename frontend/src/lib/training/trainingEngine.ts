import { GameState, ClearResult, ActivePiece, Board, PieceType, ClearType } from '@/lib/game/types';
import { Lesson, LessonStep } from './lessons';
import {
  BOARD_HEIGHT, GRAVITY_TABLE,
  MAX_LOCK_RESETS
} from '@/lib/game/constants';
import { getSpawnPosition, getPieceMatrix } from '@/lib/game/tetrominos';
import {
  isValidPosition, lockPiece, clearLines,
  tryRotate, detectTSpin, isPerfectClear,
  getHardDropDistance
} from '@/lib/game/board';

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

  // Board state
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

  // Piece queue
  private pieceQueue: PieceType[];
  private queuePosition = 0;

  // Timing
  private animFrame = 0;
  private lastTick = 0;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private isOnGround = false;
  private lastMoveWasRotation = false;
  private isPaused = false;
  private isGameOver = false;

  // Hologram
  private showHologramActive = true;

  // Callbacks
  onStateChange: (state: TrainingState) => void = () => {};
  onStepComplete: (index: number, result: StepResult) => void = () => {};

  constructor(lesson: Lesson) {
    this.lesson = lesson;
    this.board = lesson.initialBoard.map(row => [...row]) as Board;
    this.heldPiece = lesson.initialHold;
    this.pieceQueue = this.buildQueue(lesson.initialQueue);
    this.queuePosition = 0;
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  // Build a long queue: lesson's forced pieces first, then 7-bag shuffles
  private buildQueue(forced: PieceType[]): PieceType[] {
    const allPieces: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const queue: PieceType[] = [...forced];
    while (queue.length < 60) {
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
    const p = this.pieceQueue[this.queuePosition % this.pieceQueue.length];
    this.queuePosition++;
    return p;
  }

  private getNextQueuePreview(): PieceType[] {
    return Array.from({ length: 5 }, (_, i) =>
      this.pieceQueue[(this.queuePosition + i) % this.pieceQueue.length]
    );
  }

  // ── Hologram ──────────────────────────────────────────────────────────────
  // Key fix: compute Y by actually simulating a drop from row 0
  // This handles I piece correctly because we use isValidPosition properly
  private computeHologram(): HologramData | null {
    if (!this.showHologramActive) return null;
    if (this.stepResult !== 'pending') return null;

    const step = this.getCurrentStep();
    if (!step) return null;

    // Only show hologram when active piece matches the needed piece
    if (!this.activePiece || this.activePiece.type !== step.neededPiece) return null;

    const target = step.targetPosition;
    const piece = step.neededPiece;

    // Create a test piece at target x and rotation, starting from top
    // Then find the lowest y it can occupy (gravity drop simulation)
    const testPiece: ActivePiece = {
      type: piece,
      rotation: target.rotation,
      position: { x: target.x, y: -4 }, // start above board
    };

    // Check if this x+rotation is even valid on the current board
    // Walk down from y=-4 to find the landing y
    let landingY = -4;
    let found = false;

    for (let y = -4; y < BOARD_HEIGHT; y++) {
      const probe = { ...testPiece, position: { x: target.x, y } };
      const probeBelow = { ...testPiece, position: { x: target.x, y: y + 1 } };

      if (!isValidPosition(this.board, probe)) {
        // Can't be here at all — skip
        continue;
      }

      if (!isValidPosition(this.board, probeBelow)) {
        // This is the lowest valid y
        landingY = y;
        found = true;
        break;
      }

      if (y === BOARD_HEIGHT - 1) {
        landingY = y;
        found = true;
        break;
      }
    }

    if (!found) return null;

    // Validate final position is on the visible board (at least 1 cell visible)
    const matrix = getPieceMatrix(piece, target.rotation);
    let hasVisibleCell = false;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!matrix[r][c]) continue;
        const by = landingY + r;
        if (by >= 0 && by < BOARD_HEIGHT) {
          hasVisibleCell = true;
          break;
        }
      }
    }
    if (!hasVisibleCell) return null;

    return {
      x: target.x,
      y: landingY,
      rotation: target.rotation,
      piece,
    };
  }

  private getCurrentStep(): LessonStep | null {
    return this.lesson.steps[this.currentStepIndex] ?? null;
  }

  // ── Piece spawning ────────────────────────────────────────────────────────
  private spawnNext(): void {
    this.spawnPiece(this.nextPiece());
  }

  private spawnPiece(type: PieceType): void {
    const pos = getSpawnPosition(type);
    const piece: ActivePiece = { type, rotation: 0, position: pos };

    if (!isValidPosition(this.board, piece) &&
        !isValidPosition(this.board, piece, 0, -1)) {
      this.isGameOver = true;
      this.activePiece = null;
      this.emitState();
      return;
    }

    this.activePiece = piece;
    this.isOnGround = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.gravityAcc = 0;
    this.lastMoveWasRotation = false;
    this.emitState();
  }

  // ── Lock and clear ────────────────────────────────────────────────────────
  private lockActive(): void {
    if (!this.activePiece) return;

    const { isTSpin, isMiniTSpin } = detectTSpin(
      this.board, this.activePiece, this.lastMoveWasRotation
    );

    const newBoard = lockPiece(this.board, this.activePiece);
    const { board: clearedBoard, linesCleared } = clearLines(newBoard);
    this.board = clearedBoard;
    this.piecesPlaced++;
    this.lines += linesCleared;

    const isPC = isPerfectClear(this.board);
    const isB2BEligible = linesCleared === 4 || (isTSpin && linesCleared > 0);
    const wasB2B = this.isBackToBack && isB2BEligible;
    this.isBackToBack = isB2BEligible;
    if (linesCleared > 0) this.combo++; else this.combo = -1;

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
    this.isOnGround = false;
    this.lockTimer = 0;

    this.checkStepSuccess(clearResult, linesCleared, isTSpin, isMiniTSpin, isPC);
  }

  private determineClearType(
    lines: number, isTSpin: boolean, isMini: boolean
  ): ClearType {
    if (isTSpin) {
      if (isMini) {
        return lines === 1 ? 'tSpinMiniSingle'
             : lines === 2 ? 'tSpinMiniDouble'
             : 'tSpinMini';
      }
      return lines === 1 ? 'tSpinSingle'
           : lines === 2 ? 'tSpinDouble'
           : lines === 3 ? 'tSpinTriple'
           : 'none';
    }
    return lines === 1 ? 'single'
         : lines === 2 ? 'double'
         : lines === 3 ? 'triple'
         : lines === 4 ? 'tetris'
         : 'none';
  }

  // ── Step success logic ────────────────────────────────────────────────────
  // IMPORTANT: 'place' type only passes when the CORRECT piece (neededPiece) was placed
  private checkStepSuccess(
    result: ClearResult,
    linesCleared: number,
    isTSpin: boolean,
    isMini: boolean,
    isPC: boolean
  ): void {
    const step = this.getCurrentStep();

    if (!step) {
      // No more steps — just keep playing freely
      this.spawnNext();
      this.emitState();
      return;
    }

    const cond = step.successCondition;

    // What piece was just placed? We track it before nulling activePiece
    // We need to check this — store it in lockActive before nulling
    // This is handled by lastPlacedPiece below
    const placedPiece = this.lastPlacedPiece;
    let success = false;

    switch (cond.type) {
      case 'place':
        // Only pass if the correct piece was placed
        success = placedPiece === step.neededPiece;
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
      this.emitState();

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
      // Fail feedback only if:
      // - They placed the right piece type but in the wrong way (for tspin/clear conditions)
      // - OR it was a 'place' condition and wrong piece
      const shouldShowFail = (
        (cond.type !== 'place' && (linesCleared > 0 || isTSpin)) ||
        (cond.type === 'place' && placedPiece === step.neededPiece)
      );

      if (shouldShowFail) {
        this.stepResult = 'fail';
        this.feedbackMessage = step.feedbackFail;
        this.isPaused = true;
        this.emitState();

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
        // Silently keep going — wrong piece placed, no feedback
        this.spawnNext();
        this.emitState();
      }
    }
  }

  // Track what piece was just locked (set right before nulling activePiece)
  private lastPlacedPiece: PieceType = 'T';

  // ── State emission ────────────────────────────────────────────────────────
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
      pendingGarbage: 0,
      isGameOver: this.isGameOver,
      lastClear: null,
      startTime: this.startTime,
      gameTime: Date.now() - this.startTime,
      piecesPlaced: this.piecesPlaced,
    };

    this.onStateChange({
      gameState,
      currentStep: this.currentStepIndex,
      totalSteps: this.lesson.steps.length,
      stepResult: this.stepResult,
      feedbackMessage: this.feedbackMessage,
      lessonComplete: this.lessonComplete,
      hologram: this.computeHologram(),
    });
  }

  // ── Game loop — SLOW gravity for training, lock delay active ──────────────
  private loop = (now: number): void => {
    if (this.isGameOver) return;

    const delta = Math.min(now - this.lastTick, 100); // cap delta so tab focus doesn't cause instant drop
    this.lastTick = now;

    if (!this.isPaused && this.activePiece) {
      const onGround = !isValidPosition(this.board, this.activePiece, 0, 1);

      if (onGround) {
        this.isOnGround = true;
        this.lockTimer += delta;

        // Lock after 300ms (shorter than game's 500ms so training feels snappy)
        if (this.lockTimer >= 300) {
          this.lastPlacedPiece = this.activePiece.type;
          this.lockActive();
          this.animFrame = requestAnimationFrame(this.loop);
          return;
        }
      } else {
        this.isOnGround = false;
        this.lockTimer = 0;

        // Very slow gravity for training (level 1)
        this.gravityAcc += delta;
        const gravMs = GRAVITY_TABLE[1]; // 1000ms per row
        while (this.gravityAcc >= gravMs) {
          this.gravityAcc -= gravMs;
          if (isValidPosition(this.board, this.activePiece, 0, 1)) {
            this.activePiece = {
              ...this.activePiece,
              position: {
                ...this.activePiece.position,
                y: this.activePiece.position.y + 1,
              },
            };
          }
        }
      }

      this.emitState();
    }

    this.animFrame = requestAnimationFrame(this.loop);
  };

  // ── Public API ────────────────────────────────────────────────────────────
  start(): void {
    this.spawnNext();
    this.lastTick = performance.now();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  restart(): void {
    cancelAnimationFrame(this.animFrame);

    // Reset ALL state to initial
    this.board = this.lesson.initialBoard.map(row => [...row]) as Board;
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
    this.piecesPlaced = 0;
    this.startTime = Date.now();
    this.lastMoveWasRotation = false;

    // Fresh queue each restart for variety
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

  // ── Input ─────────────────────────────────────────────────────────────────
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

  // TRAINING DROP: sonic drop to ghost position (Space = drop).
  // Piece auto-locks after LOCK_DELAY (300ms), giving time to rotate for T-spins.
  // If piece is already on ground, Space locks immediately — no double-press confusion.
  hardDrop(): void {
    if (!this.activePiece || this.isPaused || this.isGameOver) return;

    const dist = getHardDropDistance(this.board, this.activePiece);

    if (dist === 0) {
      // Already on ground — lock now (avoids needing to wait for auto-lock)
      this.lastPlacedPiece = this.activePiece.type;
      this.lockActive();
      return;
    }

    // Teleport to ghost position — piece sits on ground waiting for lock timer
    this.activePiece = {
      ...this.activePiece,
      position: {
        ...this.activePiece.position,
        y: this.activePiece.position.y + dist,
      },
    };
    this.isOnGround = true;
    this.lockTimer = 0;
    this.gravityAcc = 0;
    this.emitState();
    // Piece auto-locks after LOCK_DELAY via game loop.
    // Player can still rotate during this window for T-spins.
  }

  rotateClockwise(): void { this.rotate(1); }
  rotateCounter(): void { this.rotate(-1); }
  rotate180(): void { this.rotate(2); }

  hold(): void {
    if (!this.activePiece || !this.canHold || this.isPaused || this.isGameOver) return;
    const toHold = this.activePiece.type;
    if (this.heldPiece) {
      const swapIn = this.heldPiece;
      this.heldPiece = toHold;
      this.spawnPiece(swapIn);
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
