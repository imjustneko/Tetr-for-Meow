import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { TrainingEngine } from '@/lib/training/trainingEngine';

export function useTrainingInput(
  engineRef: React.RefObject<TrainingEngine | null>,
  active: boolean
) {
  const { keybinds, das, arr } = useSettingsStore();
  const heldKey = useRef<string | null>(null);
  const dasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const softDropInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (dasTimer.current) clearTimeout(dasTimer.current);
    if (arrInterval.current) clearInterval(arrInterval.current);
    if (softDropInterval.current) clearInterval(softDropInterval.current);
    dasTimer.current = null;
    arrInterval.current = null;
    softDropInterval.current = null;
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      const action = keyToAction[e.code];
      if (!action || heldKey.current === e.code) return;
      heldKey.current = e.code;
      handleAction(action);

      if (action === 'moveLeft' || action === 'moveRight') {
        clearTimers();
        dasTimer.current = setTimeout(() => {
          arrInterval.current = setInterval(() => handleAction(action), arr);
        }, das);
      }
      if (action === 'softDrop') {
        softDropInterval.current = setInterval(() => handleAction('softDrop'), 50);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === heldKey.current) {
        heldKey.current = null;
        clearTimers();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearTimers();
    };
  }, [active, keybinds, das, arr, handleAction, clearTimers]);
}
