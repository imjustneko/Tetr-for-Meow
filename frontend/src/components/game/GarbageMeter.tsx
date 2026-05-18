'use client';

type Props = {
  lines: number;
  pending?: number;
  max?: number;
  heightPx: number;
};

/**
 * Vertical garbage meter beside the playfield.
 * - `lines` (orange) = queued garbage about to be applied
 * - `pending` (yellow) = incoming garbage that can still be countered
 */
export function GarbageMeter({ lines, pending = 0, max = 20, heightPx }: Props) {
  const total = lines + pending;
  const ratio = Math.min(1, total / max);
  const fillPx = Math.round(ratio * heightPx);

  const queuedRatio = total > 0 ? lines / total : 0;
  const queuedPx = Math.round(fillPx * queuedRatio);
  const pendingPx = fillPx - queuedPx;

  return (
    <div
      className="flex w-2 shrink-0 flex-col justify-end overflow-hidden border border-white/10 bg-black/40"
      style={{ height: heightPx }}
      aria-hidden
    >
      {/* Queued garbage (solid orange-red — about to hit) */}
      {queuedPx > 0 && (
        <div
          className="w-full bg-gradient-to-t from-red-700 to-orange-500"
          style={{ height: queuedPx }}
        />
      )}
      {/* Pending garbage (yellow — can be countered) */}
      {pendingPx > 0 && (
        <div
          className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300"
          style={{ height: pendingPx, order: -1 }}
        />
      )}
    </div>
  );
}
