import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { TrainingEngine } from '@/lib/training/trainingEngine';

export function useTrainingInput(
  engineRef: React.RefObject<TrainingEngine | null>,
  active: boolean
) {
  const { keybinds, das, arr } = useSettingsStore();
  const heldKeys = useRef<Set<string>>(new Set());
  const dasTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const arrIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const softDropInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearKeyTimers = useCallback((code: string) => {
    const dt = dasTimers.current.get(code);
    if (dt) {
      clearTimeout(dt);
      dasTimers.current.delete(code);
    }
    const ai = arrIntervals.current.get(code);
    if (ai) {
      clearInterval(ai);
      arrIntervals.current.delete(code);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    dasTimers.current.forEach((t) => clearTimeout(t));
    arrIntervals.current.forEach((t) => clearInterval(t));
    dasTimers.current.clear();
    arrIntervals.current.clear();
    if (softDropInterval.current) {
      clearInterval(softDropInterval.current);
      softDropInterval.current = null;
    }
  }, []);

  const clearHeldKeys = useCallback(() => {
    heldKeys.current.clear();
  }, []);

  const handleAction = useCallback((action: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    switch (action) {
      case 'moveLeft':
        engine.moveLeft();
        break;
      case 'moveRight':
        engine.moveRight();
        break;
      case 'softDrop':
        engine.softDrop();
        break;
      case 'hardDrop':
        engine.hardDrop();
        break;
      case 'rotateClockwise':
        engine.rotateClockwise();
        break;
      case 'rotateCounter':
        engine.rotateCounter();
        break;
      case 'rotate180':
        engine.rotate180();
        break;
      case 'hold':
        engine.hold();
        break;
    }
  }, [engineRef]);

  useEffect(() => {
    if (!active) return;
    const keyToAction: Record<string, string> = {};
    for (const [action, key] of Object.entries(keybinds)) keyToAction[key] = action;

    // Track movement key codes for continuous processing
    const movementDasTimes = new Map<string, number>();
    const movementArrsHandled = new Map<string, number>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      const action = keyToAction[e.code];
      if (!action) return;
      if (heldKeys.current.has(e.code)) return;
      heldKeys.current.add(e.code);
      
      // For movement, trigger immediately and track for DAS/ARR
      if (action === 'moveLeft' || action === 'moveRight') {
        handleAction(action);
        movementDasTimes.set(e.code, performance.now());
        movementArrsHandled.set(e.code, 0);
        return;
      }
      
      handleAction(action);
      
      if (action === 'softDrop') {
        if (softDropInterval.current) clearInterval(softDropInterval.current);
        const code = e.code;
        softDropInterval.current = setInterval(() => {
          if (heldKeys.current.has(code)) {
            handleAction('softDrop');
          } else if (softDropInterval.current) {
            clearInterval(softDropInterval.current);
            softDropInterval.current = null;
          }
        }, arr === 0 ? 1 : arr);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.code);
      clearKeyTimers(e.code);
      const action = keyToAction[e.code];
      
      if (action === 'softDrop' && softDropInterval.current) {
        clearInterval(softDropInterval.current);
        softDropInterval.current = null;
      }
      
      // Clean up movement tracking
      if (action === 'moveLeft' || action === 'moveRight') {
        movementDasTimes.delete(e.code);
        movementArrsHandled.delete(e.code);
      }
    };

    // Process movement continuously via RAF for smooth, uninterruptible input
    let lastMovementTick = performance.now();
    const processMovementFrame = (now: number) => {
      const dt = Math.min(now - lastMovementTick, 50);
      lastMovementTick = now;

      for (const [code, dasStart] of movementDasTimes.entries()) {
        const action = keyToAction[code];
        if (!action || !heldKeys.current.has(code)) {
          movementDasTimes.delete(code);
          movementArrsHandled.delete(code);
          continue;
        }

        const timeSinceDas = now - dasStart;
        if (timeSinceDas >= das) {
          const arrTime = timeSinceDas - das;
          const arrInterval = arr === 0 ? 1 : arr;
          const arrCount = Math.floor(arrTime / arrInterval);
          const prevCount = movementArrsHandled.get(code) || 0;

          if (arrCount > prevCount) {
            handleAction(action);
            movementArrsHandled.set(code, arrCount);
          }
        }
      }

      if (movementDasTimes.size > 0 || heldKeys.current.size > 0) {
        requestAnimationFrame(processMovementFrame);
      }
    };

    let movementRafId: number | null = null;
    const startMovementProcessor = () => {
      if (movementRafId === null) {
        lastMovementTick = performance.now();
        movementRafId = requestAnimationFrame(processMovementFrame);
      }
    };

    const onBlur = () => {
      heldKeys.current.clear();
      clearAllTimers();
      movementDasTimes.clear();
      movementArrsHandled.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    startMovementProcessor();
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (movementRafId !== null) cancelAnimationFrame(movementRafId);
      clearAllTimers();
      clearHeldKeys();
      movementDasTimes.clear();
      movementArrsHandled.clear();
    };
  }, [active, keybinds, das, arr, handleAction, clearKeyTimers, clearAllTimers, clearHeldKeys]);
}
