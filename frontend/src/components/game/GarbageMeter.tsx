'use client';

type Props = {
  lines: number;
  pending?: number;
  buffered?: number;
  max?: number;
  heightPx: number;
};

/**
 * Vertical garbage meter beside the playfield.
 * - `lines`   (red/orange) = queued garbage applied at next lock
 * - `pending` (yellow)     = counterable by clearing lines
 * - `buffered`(gray)       = just arrived, becomes counterable next piece
 */
export function GarbageMeter({ lines, pending = 0, buffered = 0, max = 20, heightPx }: Props) {
  const total = lines + pending + buffered;
  const ratio = Math.min(1, total / max);
  const fillPx = Math.round(ratio * heightPx);

  const queuedPx  = total > 0 ? Math.round(fillPx * (lines   / total)) : 0;
  const pendingPx = total > 0 ? Math.round(fillPx * (pending / total)) : 0;
  const bufferedPx = Math.max(0, fillPx - queuedPx - pendingPx);

  return (
    <div
      className="flex w-2 shrink-0 flex-col justify-end overflow-hidden border border-white/10 bg-black/40"
      style={{ height: heightPx }}
      aria-hidden
    >
      {/* Queued (red-orange — will hit this lock) */}
      {queuedPx > 0 && (
        <div
          className="w-full bg-gradient-to-t from-red-700 to-orange-500"
          style={{ height: queuedPx }}
        />
      )}
      {/* Pending (yellow — counter now) */}
      {pendingPx > 0 && (
        <div
          className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300"
          style={{ height: pendingPx, order: -1 }}
        />
      )}
      {/* Buffered (gray — arrives next piece) */}
      {bufferedPx > 0 && (
        <div
          className="w-full bg-zinc-600/70"
          style={{ height: bufferedPx, order: -2 }}
        />
      )}
    </div>
  );
}
