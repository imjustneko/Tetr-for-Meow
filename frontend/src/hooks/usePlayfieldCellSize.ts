'use client';

import { useEffect, useState } from 'react';

/**
 * Responsive cell size so the 10×20 board fits on small viewports without horizontal scroll.
 */
export function usePlayfieldCellSize(): number {
  const [cell, setCell] = useState(28);

  useEffect(() => {
    const compute = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const h = typeof window !== 'undefined' ? window.innerHeight : 768;
      // Width budget: hold + meter + next queue + gaps.
      const maxByWidth = Math.min(360, Math.max(160, w - 220));
      // Height budget: navbar + drill panels + spacing (so 20 rows still fit at 1366x768).
      const maxByHeight = Math.max(140, h - 300);
      const maxBoard = Math.min(maxByWidth, maxByHeight);
      const next = Math.max(10, Math.min(30, Math.floor(maxBoard / 10)));
      setCell(next);
    };
    compute();
    window.addEventListener('resize', compute, { passive: true });
    return () => window.removeEventListener('resize', compute);
  }, []);

  return cell;
}
