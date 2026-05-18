'use client';

interface Props {
  altitude: number;
  heightPx: number;
}

export function AltitudeMeter({ altitude, heightPx }: Props) {
  const displayAlt = Math.round(altitude);
  const maxShow = Math.max(100, displayAlt + 50);
  const ratio = Math.min(1, displayAlt / maxShow);
  const fillPx = Math.round(ratio * heightPx);

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[0.55rem] font-bold uppercase tracking-widest text-orange-400">ALT</p>
      <div
        className="relative flex w-3 shrink-0 flex-col justify-end overflow-hidden rounded-full border border-orange-500/30 bg-black/40"
        style={{ height: heightPx }}
      >
        <div
          className="w-full rounded-full bg-gradient-to-t from-orange-700 via-orange-400 to-yellow-300 transition-all duration-300"
          style={{ height: fillPx }}
        />
      </div>
      <p className="font-mono text-[0.6rem] font-bold text-orange-300">{displayAlt}m</p>
    </div>
  );
}
