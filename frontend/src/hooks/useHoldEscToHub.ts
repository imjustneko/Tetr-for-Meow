'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_HOLD_MS = 720;

/**
 * Hold Escape to navigate to the main hub (/dashboard).
 * Uses rAF for smooth progress without extra input latency on other keys.
 */
export function useHoldEscToHub(
  enabled: boolean,
  options?: { holdMs?: number; onBeforeNavigate?: () => void }
) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const downAt = useRef<number | null>(null);
  const rafRef = useRef(0);
  const optsRef = useRef(options);
  useLayoutEffect(() => { optsRef.current = options; });
  const holdMs = options?.holdMs ?? DEFAULT_HOLD_MS;

  useEffect(() => {
    if (!enabled) {
      downAt.current = null;
      cancelAnimationFrame(rafRef.current);
      queueMicrotask(() => setProgress(0));
      return;
    }

    const loop = (t: number) => {
      const start = downAt.current;
      if (start == null) return;
      const ms = optsRef.current?.holdMs ?? DEFAULT_HOLD_MS;
      const p = Math.min(1, (t - start) / ms);
      setProgress(p);
      if (p >= 1) {
        downAt.current = null;
        setProgress(0);
        optsRef.current?.onBeforeNavigate?.();
        router.push('/dashboard');
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      if (downAt.current != null) return;
      downAt.current = performance.now();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    const cancel = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      downAt.current = null;
      cancelAnimationFrame(rafRef.current);
      setProgress(0);
    };

    const onBlur = () => {
      downAt.current = null;
      cancelAnimationFrame(rafRef.current);
      setProgress(0);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', cancel);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', cancel);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(rafRef.current);
      setProgress(0);
    };
  }, [enabled, holdMs, router]);

  return progress;
}
