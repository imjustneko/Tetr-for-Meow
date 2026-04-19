import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import type { GameRoom, JwtPayload, RoomPlayer } from '../types';
import { prisma } from '../lib/prisma';

type AuthedIoServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { user: JwtPayload }
>;
type AuthedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { user: JwtPayload }
>;

const rooms = new Map<string, GameRoom>();
const playerToRoom = new Map<string, string>();

function normalizeQueueMode(mode?: string): 'versus' | 'league' {
  return mode === 'league' ? 'league' : 'versus';
}

function expectedRoundsTarget(room: GameRoom): number {
  return room.series?.targetWins ?? 1;
}

function expectedBestOf(room: GameRoom): number {
  return room.series?.bestOf ?? 1;
}

function getSeriesWins(room: GameRoom, userId: string): number {
  if (!room.series) return 0;
  return room.series.wins[userId] ?? 0;
}

function calculateEloDelta(winnerRating: number, loserRating: number, k = 24): number {
  const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  return Math.max(5, Math.round(k * (1 - expectedWinner)));
}

async function applyRatingResult(winner: RoomPlayer, loser: RoomPlayer): Promise<{ delta: number } | null> {
  try {
    const winnerRow = await prisma.user.findUnique({
      where: { id: winner.userId },
      select: { rating: true },
    });
    const loserRow = await prisma.user.findUnique({
      where: { id: loser.userId },
      select: { rating: true },
    });
    const winnerRating = winnerRow?.rating ?? winner.rating ?? 1000;
    const loserRating = loserRow?.rating ?? loser.rating ?? 1000;
    const delta = calculateEloDelta(winnerRating, loserRating);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: winner.userId },
        data: { rating: { increment: delta } },
      }),
      prisma.user.update({
        where: { id: loser.userId },
        data: { rating: { decrement: delta } },
      }),
      prisma.userStats.update({
        where: { userId: winner.userId },
        data: { gamesPlayed: { increment: 1 }, wins: { increment: 1 } },
      }),
      prisma.userStats.update({
        where: { userId: loser.userId },
        data: { gamesPlayed: { increment: 1 }, losses: { increment: 1 } },
      }),
    ]);
    winner.rating = winnerRating + delta;
    loser.rating = loserRating - delta;
    return { delta };
  } catch (err) {
    console.error('[ELO] Failed to update ratings', err);
    return null;
  }
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function initSocket(io: AuthedIoServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const user = socket.data.user;
    console.log(`[Socket] Connected: ${user.username} (${socket.id})`);

    socket.on('join_queue', (payload?: { mode?: string }) => {
      const queueMode = normalizeQueueMode(payload?.mode);
      let foundRoom: GameRoom | null = null;

      for (const [, room] of rooms) {
        if (
          room.mode === queueMode &&
          room.status === 'waiting' &&
          room.players.length < 2 &&
          !room.roomCode
        ) {
          foundRoom = room;
          break;
        }
      }

      if (foundRoom) {
        joinRoom(socket, foundRoom.id, user, io);
      } else {
        const roomId = generateRoomCode();
        const newRoom: GameRoom = {
          id: roomId,
          mode: queueMode,
          status: 'waiting',
          players: [],
          series:
            queueMode === 'league'
              ? {
                  bestOf: 3,
                  targetWins: 2,
                  wins: {},
                }
              : undefined,
          matchResolved: false,
        };
        rooms.set(roomId, newRoom);
        joinRoom(socket, roomId, user, io);
      }
    });

    socket.on('leave_queue', () => {
      void leaveRoom(socket, io);
    });
    socket.on('leave_room', () => {
      void leaveRoom(socket, io);
    });

    socket.on('create_room', ({ mode }: { mode?: string }) => {
      const roomCode = generateRoomCode();
      const roomMode = normalizeQueueMode(mode);
      const room: GameRoom = {
        id: roomCode,
        mode: roomMode,
        status: 'waiting',
        roomCode,
        players: [],
        series:
          roomMode === 'league'
            ? {
                bestOf: 3,
                targetWins: 2,
                wins: {},
              }
            : undefined,
        matchResolved: false,
      };
      rooms.set(roomCode, room);
      joinRoom(socket, roomCode, user, io);
      socket.emit('room_created', { roomCode });
    });

    socket.on('join_room', ({ roomCode }: { roomCode: string }) => {
      const code = roomCode?.trim?.()?.toUpperCase?.() ?? '';
      const room = rooms.get(code);
      if (!room) {
        socket.emit('room_error', { message: 'Room not found' });
        return;
      }
      if (room.players.length >= 2) {
        socket.emit('room_error', { message: 'Room is full' });
        return;
      }
      joinRoom(socket, code, user, io);
    });

    socket.on('player_ready', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.ready = true;
        io.to(roomId).emit('room_update', sanitizeRoom(room));
        if (room.players.length >= 2 && room.players.every((p) => p.ready)) {
          startCountdown(io, room);
        }
      }
    });

    socket.on('player_unready', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== 'waiting') return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.ready = false;
        io.to(roomId).emit('room_update', sanitizeRoom(room));
      }
    });

    /** Garbage / attack lines from the game engine after a lock + clear */
    socket.on('send_attack', (payload: { lines?: number }) => {
      const lines = Math.max(0, Math.min(20, Math.floor(Number(payload?.lines) || 0)));
      if (lines <= 0) return;

      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      socket.to(roomId).emit('garbage_incoming', {
        lines,
        from: user.userId,
      });
    });

    socket.on('hard_drop', (data: { board?: number[][]; linesCleared?: number; attack?: number }) => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      if (data?.board) {
        socket.to(roomId).emit('opponent_drop', {
          userId: user.userId,
          board: data.board,
          linesCleared: data.linesCleared ?? 0,
        });
      }

      const attack = Math.max(0, Math.floor(Number(data?.attack) || 0));
      if (attack > 0) {
        socket.to(roomId).emit('garbage_incoming', {
          lines: attack,
          from: user.userId,
        });
      }
    });

    socket.on('board_update', (data: { board?: number[][] }) => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      if (!data?.board) return;
      socket.to(roomId).emit('opponent_board', {
        userId: user.userId,
        board: data.board,
      });
    });

    socket.on('top_out', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player && player.alive) {
        player.alive = false;
        io.to(roomId).emit('player_eliminated', { userId: user.userId });

        const alivePlayers = room.players.filter((p) => p.alive);
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0] || null;
          const loser = room.players.find((p) => p.userId === user.userId) || null;
          if (!winner || !loser) {
            room.status = 'finished';
            io.to(roomId).emit('game_over', { winner: winner?.userId ?? null });
            return;
          }
          void finishRound(io, room, winner, loser);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.username}`);
      void leaveRoom(socket, io);
    });
  });
}

function joinRoom(
  socket: AuthedSocket,
  roomId: string,
  user: { userId: string; username: string },
  io: AuthedIoServer
): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const existing = room.players.find((p) => p.userId === user.userId);
  if (existing) {
    room.players = room.players.filter((p) => p.userId !== user.userId);
    playerToRoom.delete(existing.socketId);
  }

  const player: RoomPlayer = {
    userId: user.userId,
    username: user.username,
    socketId: socket.id,
    ready: false,
    alive: true,
    rating: 1000,
  };

  room.players.push(player);
  if (room.players.length === 2) {
    room.players.forEach((p) => {
      p.ready = false;
    });
  }

  playerToRoom.set(socket.id, roomId);
  socket.join(roomId);
  socket.emit('room_joined', { roomId, room: sanitizeRoom(room) });
  io.to(roomId).emit('room_update', sanitizeRoom(room));

  if (room.players.length === 2) {
    io.to(roomId).emit('match_found', { roomId });
  }
}

async function leaveRoom(socket: AuthedSocket, io: AuthedIoServer): Promise<void> {
  const roomId = playerToRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const wasPlaying = room.status === 'playing';

  room.players = room.players.filter((p) => p.socketId !== socket.id);
  playerToRoom.delete(socket.id);
  socket.leave(roomId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return;
  }

  if (room.status === 'finished') {
    io.to(roomId).emit('room_update', sanitizeRoom(room));
    return;
  }

  room.players.forEach((p) => {
    p.ready = false;
  });
  room.status = 'waiting';
  io.to(roomId).emit('room_update', sanitizeRoom(room));
  if (wasPlaying) {
    const winner = room.players[0] ?? null;
    if (winner && !room.matchResolved) {
      room.matchResolved = true;
      const leavingPlayer: RoomPlayer = {
        userId: socket.data.user.userId,
        username: socket.data.user.username,
        socketId: socket.id,
        ready: false,
        alive: false,
        rating: 1000,
      };
      const rating = await applyRatingResult(winner, leavingPlayer);
      io.to(roomId).emit('game_over', {
        winner: winner.userId,
        winnerUsername: winner.username,
        reason: 'opponent_disconnected',
        ratingDelta: rating?.delta ?? null,
      });
      return;
    }
    io.to(roomId).emit('game_over', { reason: 'opponent_disconnected' });
  }
}

async function finishRound(
  io: AuthedIoServer,
  room: GameRoom,
  winner: RoomPlayer,
  loser: RoomPlayer
): Promise<void> {
  if (room.mode === 'league' && room.series) {
    room.series.wins[winner.userId] = (room.series.wins[winner.userId] ?? 0) + 1;
    const winnerWins = room.series.wins[winner.userId];
    const targetWins = expectedRoundsTarget(room);

    io.to(room.id).emit('series_update', {
      mode: 'league',
      bestOf: expectedBestOf(room),
      targetWins,
      wins: room.series.wins,
      roundWinner: winner.userId,
    });

    if (winnerWins < targetWins) {
      room.status = 'waiting';
      room.players.forEach((p) => {
        p.alive = true;
        p.ready = true;
      });
      io.to(room.id).emit('round_over', {
        roundWinner: winner.userId,
        bestOf: expectedBestOf(room),
        targetWins,
        wins: room.series.wins,
      });
      io.to(room.id).emit('room_update', sanitizeRoom(room));
      startCountdown(io, room);
      return;
    }
  }

  room.status = 'finished';
  if (!room.matchResolved) {
    room.matchResolved = true;
    const rating = await applyRatingResult(winner, loser);
    io.to(room.id).emit('game_over', {
      winner: winner.userId,
      winnerUsername: winner.username,
      players: room.players.map((p) => ({ userId: p.userId, username: p.username, alive: p.alive })),
      mode: room.mode,
      bestOf: expectedBestOf(room),
      wins: room.series?.wins ?? null,
      ratingDelta: rating?.delta ?? null,
    });
    return;
  }

  io.to(room.id).emit('game_over', {
    winner: winner.userId,
    winnerUsername: winner.username,
    mode: room.mode,
  });
}

function startCountdown(io: AuthedIoServer, room: GameRoom): void {
  if (room.status === 'finished') return;
  room.status = 'countdown';
  io.to(room.id).emit('room_update', sanitizeRoom(room));
  let count = 3;
  io.to(room.id).emit('countdown', { count: 3 });

  const interval = setInterval(() => {
    count--;
    if (count < 0) {
      clearInterval(interval);
      room.status = 'playing';
      room.players.forEach((p) => {
        p.alive = true;
        p.ready = true;
      });
      io.to(room.id).emit('game_start', { roomId: room.id });
      return;
    }
    io.to(room.id).emit('countdown', { count });
  }, 1000);
}

function sanitizeRoom(room: GameRoom) {
  return {
    id: room.id,
    mode: room.mode,
    status: room.status,
    roomCode: room.roomCode,
    series: room.series
      ? {
          bestOf: room.series.bestOf,
          targetWins: room.series.targetWins,
          wins: room.series.wins,
        }
      : undefined,
    players: room.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      ready: p.ready,
      alive: p.alive,
      rating: p.rating,
    })),
  };
}
