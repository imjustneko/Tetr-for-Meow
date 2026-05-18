'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '@/lib/game/engine';
import type { GameState, GameMode, PieceType, ClearResult } from '@/lib/game/types';
import { useSettingsStore } from '@/store/settingsStore';
import { createIrsInputRef, useGameInput, type IrsInputRef } from './useGameInput';
import { useGameSounds } from './useGameSounds';
import { soundEngine } from '@/lib/audio/soundEngine';
import { useAudioStore } from '@/store/audioStore';

export type GameEngineCallbacks = {
  onGarbageSend?: (lines: number) => void;
  /** Called after every engine state tick (throttle board sync in your handler) */
  onStateTick?: (state: GameState) => void;
  /** Called when a lock generates a clear result. */
  onClear?: (result: ClearResult) => void;
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
  const prevLevelRef = useRef(1);
  const sounds = useGameSounds();
  const { initAudio } = useAudioStore();

  useGameInput(engineRef, isActive, irsInputRef, {
    onMove: sounds.onMove,
    onRotate: sounds.onRotate,
    onSoftDrop: sounds.onSoftDrop,
    onHardDrop: sounds.onHardDrop,
    onHold: sounds.onHold,
  });

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
    initAudio();

    const modeConfig: GameMode = { type: modeType, targetLines, timeLimit };
    const engine = new GameEngine(modeConfig);
    prevLevelRef.current = 1;
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
      if (state.level > prevLevelRef.current) {
        prevLevelRef.current = state.level;
        sounds.onLevelUp();
      }
      cbRef.current?.onStateTick?.(state);
    };
    engine.onClear = (result) => {
      sounds.onClear(result);
      cbRef.current?.onClear?.(result);
    };
    engine.onGarbageSend = (lines) => {
      cbRef.current?.onGarbageSend?.(lines);
    };
    engine.onGameOver = (state) => {
      setGameState({ ...state });
      setIsActive(false);
      setIsFinished(true);
      setFinalState({ ...state });
      sounds.onGameOver();
      soundEngine.stopMusic();
    };

    // Stop any ambient music that was playing (e.g. from settings/menu)
    soundEngine.stopMusic();

    engine.start();
    setIsActive(true);
    setIsFinished(false);
    setFinalState(null);
  }, [modeType, targetLines, timeLimit, initAudio, sounds]);

  const restartGame = useCallback(() => {
    soundEngine.stopMusic();
    startGame();
  }, [startGame]);

  const receiveGarbage = useCallback((lines: number) => {
    engineRef.current?.receiveGarbage(lines);
    sounds.onGarbage(lines);
  }, [sounds]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      soundEngine.stopMusic();
    };
  }, []);

  return { gameState, isActive, isFinished, finalState, startGame, restartGame, engineRef, receiveGarbage };
}
