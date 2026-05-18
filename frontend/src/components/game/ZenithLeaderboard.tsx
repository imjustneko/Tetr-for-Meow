'use client';

export interface ZenithEntry {
  userId: string;
  username: string;
  altitude: number;
  alive: boolean;
}

interface Props {
  entries: ZenithEntry[];
  myUserId: string | null;
  playerCount: number;
  maxPlayers: number;
}

export function ZenithLeaderboard({ entries, myUserId, playerCount, maxPlayers }: Props) {
  const sorted = [...entries].sort((a, b) => b.altitude - a.altitude);
  const aliveCount = entries.filter((e) => e.alive).length;

  return (
    <div className="flex w-44 flex-col gap-1">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[0.6rem] font-bold uppercase tracking-widest text-orange-400">Tower</p>
        <p className="text-[0.6rem] text-zinc-500">{aliveCount}/{playerCount} alive</p>
      </div>

      {/* Waiting bar */}
      {playerCount < maxPlayers && (
        <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${(playerCount / maxPlayers) * 100}%` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {sorted.map((entry, i) => {
          const isMe = entry.userId === myUserId;
          return (
            <div
              key={entry.userId}
              className={`flex items-center justify-between rounded px-2 py-1 text-xs transition-all ${
                !entry.alive
                  ? 'opacity-35 line-through'
                  : isMe
                  ? 'bg-orange-500/20 font-bold text-orange-200'
                  : 'bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-4 text-right text-[0.6rem] text-zinc-600">{i + 1}</span>
                <span className="max-w-[80px] truncate">{entry.username}</span>
              </span>
              <span className="font-mono text-[0.65rem] text-orange-300">
                {Math.round(entry.altitude)}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
