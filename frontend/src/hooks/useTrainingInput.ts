import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { TrainingEngine } from '@/lib/training/trainingEngine';

export function useTrainingInput(
  engineRef: React.RefObject<TrainingEngine | null>,
  active: boolean
) {
  const { keybinds, das, arr } = useSettingsStore();
  const heldKeys = useRef<Set<string>>(new Set());
  const softDropInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const movementDasFired = new Map<string, number>(); // Track when DAS expired for each key

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
        movementDasFired.delete(e.code);
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
      const action = keyToAction[e.code];
      
      if (action === 'softDrop' && softDropInterval.current) {
        clearInterval(softDropInterval.current);
        softDropInterval.current = null;
      }
      
      // Clean up movement tracking
      if (action === 'moveLeft' || action === 'moveRight') {
        movementDasTimes.delete(e.code);
        movementDasFired.delete(e.code);
      }
    };

    // Process movement continuously via RAF for smooth, uninterruptible input
    let lastMovementTick = performance.now();
    const processMovementFrame = (now: number) => {
      lastMovementTick = now;

      for (const [code, dasStart] of movementDasTimes.entries()) {
        const action = keyToAction[code];
        if (!action || !heldKeys.current.has(code)) {
          movementDasTimes.delete(code);
          movementDasFired.delete(code);
          continue;
        }

        const timeSinceDas = now - dasStart;
        if (timeSinceDas >= das) {
          if (!movementDasFired.has(code)) {
            // First time crossing DAS threshold - fire immediately
            handleAction(action);
            movementDasFired.set(code, now);
          } else {
            // After first DAS fire, check ARR interval
            const lastFire = movementDasFired.get(code)!;
            if (now - lastFire >= arr) {
              handleAction(action);
              movementDasFired.set(code, now);
            }
          }
        }
      }

      if (movementDasTimes.size > 0) {
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
      if (softDropInterval.current) {
        clearInterval(softDropInterval.current);
        softDropInterval.current = null;
      }
      movementDasTimes.clear();
      movementDasFired.clear();
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
      if (softDropInterval.current) {
        clearInterval(softDropInterval.current);
        softDropInterval.current = null;
      }
      clearHeldKeys();
      movementDasTimes.clear();
      movementDasFired.clear();
    };
  }, [active, keybinds, das, arr, handleAction, clearHeldKeys]);
}
