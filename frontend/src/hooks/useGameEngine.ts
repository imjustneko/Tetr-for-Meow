'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '@/lib/game/engine';
import type { GameState, GameMode, PieceType } from '@/lib/game/types';
import { useSettingsStore } from '@/store/settingsStore';
import { createIrsInputRef, useGameInput, type IrsInputRef } from './useGameInput';

export type GameEngineCallbacks = {
  onGarbageSend?: (lines: number) => void;
  /** Called after every engine state tick (throttle board sync in your handler) */
  onStateTick?: (state: GameState) => void;
  /** Optional fixed sequence for practice/training modes. */
  practiceSequence?: PieceType[];
};

export function useGameEngine(mode: GameMode, callbacks?: GameEngineCallbacks) {
  const engineRef = useRef<GameEngine | null>(null);
  const irsInputRef = useRef<IrsInputRef>(createIrsInputRef());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [finalState, setFinalState] = useState<GameState | null>(null);

  useGameInput(engineRef, isActive, irsInputRef);

  const modeType = mode.type;
  const targetLines = mode.targetLines;
  const timeLimit = mode.timeLimit;
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  const startGame = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
    }

    const modeConfig: GameMode = { type: modeType, targetLines, timeLimit };
    const engine = new GameEngine(modeConfig);
    if (modeType === 'practice' && cbRef.current?.practiceSequence?.length) {
      engine.setPracticeSequence(cbRef.current.practiceSequence, true);
    }
    engineRef.current = engine;

    engine.onPieceSpawn = () => {
      const hs = useSettingsStore.getState().handling;
      if (hs.irs === 'off') return;
      const ir = irsInputRef.current;
      if (hs.irs === 'hold') {
        if (ir.rotateCWHeld) engine.rotateClockwise();
        else if (ir.rotateCCWHeld) engine.rotateCounter();
        else if (ir.rotate180Held) engine.rotate180();
      } else {
        const dt = performance.now() - ir.tapAt;
        if (dt < 100 && (ir.rotateCWHeld || ir.rotateCCWHeld || ir.rotate180Held)) {
          if (ir.rotateCWHeld) engine.rotateClockwise();
          else if (ir.rotateCCWHeld) engine.rotateCounter();
          else if (ir.rotate180Held) engine.rotate180();
        }
      }
    };

    engine.onStateChange = (state) => {
      setGameState({ ...state });
      cbRef.current?.onStateTick?.(state);
    };
    engine.onClear = () => {};
    engine.onGarbageSend = (lines) => {
      cbRef.current?.onGarbageSend?.(lines);
    };
    engine.onGameOver = (state) => {
      setGameState({ ...state });
      setIsActive(false);
      setIsFinished(true);
      setFinalState({ ...state });
    };

    engine.start();
    setIsActive(true);
    setIsFinished(false);
    setFinalState(null);
  }, [modeType, targetLines, timeLimit]);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const receiveGarbage = useCallback((lines: number) => {
    engineRef.current?.receiveGarbage(lines);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  return { gameState, isActive, isFinished, finalState, startGame, restartGame, engineRef, receiveGarbage };
}
