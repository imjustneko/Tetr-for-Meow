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

function getPublicRoomsList() {
  const list: { id: string; host: string; mode: string; roomCode: string }[] = [];
  for (const [, room] of rooms) {
    if (room.isPublic && room.status === 'waiting' && room.players.length < 2 && room.roomCode) {
      list.push({
        id: room.id,
        host: room.players[0]?.username ?? '?',
        mode: room.mode,
        roomCode: room.roomCode,
      });
    }
  }
  return list;
}

function broadcastPublicRooms(io: AuthedIoServer): void {
  io.to('public_lobby').emit('public_rooms', getPublicRoomsList());
}

// ── Zenith helpers ────────────────────────────────────────────────────────────

const ZENITH_MAX_PLAYERS = 10;
const ZENITH_START_WAIT_MS = 15_000;
const REVIVE_LINES_NEEDED = 6;

function buildZenithLeaderboard(room: GameRoom) {
  return room.players
    .map((p) => ({
      userId: p.userId,
      username: p.username,
      altitude: room.altitude?.[p.userId] ?? 0,
      alive: p.alive,
      teamId: room.teams?.[p.userId] ?? undefined,
    }))
    .sort((a, b) => b.altitude - a.altitude);
}

function reassignGarbageTargets(room: GameRoom): void {
  const alive = room.players.filter((p) => p.alive);
  if (alive.length < 2) return;
  room.garbageTargets = {};
  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    room.garbageTargets[shuffled[i].userId] = shuffled[(i + 1) % shuffled.length].userId;
  }
}

function assignDuoTeams(room: GameRoom): void {
  room.teams = {};
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const letters = 'ABCDEFGHIJ';
  for (let i = 0; i < shuffled.length; i++) {
    const teamId = letters[Math.floor(i / 2)] ?? 'Z';
    room.teams[shuffled[i].userId] = teamId;
    const player = room.players.find((p) => p.userId === shuffled[i].userId);
    if (player) player.teamId = teamId;
  }
}

// Returns team IDs that still have at least one alive member.
function getAliveTeams(room: GameRoom): string[] {
  if (!room.teams || room.zenithSubMode !== 'duo') {
    return room.players.filter((p) => p.alive).map((p) => p.userId);
  }
  const aliveTeams = new Set<string>();
  room.players.forEach((p) => {
    if (p.alive && room.teams![p.userId]) aliveTeams.add(room.teams![p.userId]);
  });
  return [...aliveTeams];
}

function cancelReviveMissionsFor(room: GameRoom, userId: string): void {
  if (!room.reviveMissions) return;
  // Cancel the mission this player was working on
  delete room.reviveMissions[userId];
  // Cancel missions where this player was the target to be revived
  for (const key of Object.keys(room.reviveMissions)) {
    if (room.reviveMissions[key].partnerId === userId) {
      delete room.reviveMissions[key];
    }
  }
}

// ── Spectate helpers ──────────────────────────────────────────────────────────

const spectatorToRoom = new Map<string, string>();

function getSpectatorBoards(room: GameRoom, io: AuthedIoServer, spectatorSocket: { id: string; emit: (ev: string, data: unknown) => void }) {
  spectatorSocket.emit('spectate_init', {
    roomId: room.id,
    players: room.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      alive: p.alive,
      altitude: room.altitude?.[p.userId] ?? 0,
    })),
    status: room.status,
    mode: room.mode,
  });
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

    void socket.join('public_lobby');

    socket.on('request_public_rooms', () => {
      socket.emit('public_rooms', getPublicRoomsList());
    });

    // ── Spectate ─────────────────────────────────────────────────────────────
    socket.on('spectate_room', ({ roomId }: { roomId: string }) => {
      const code = roomId?.trim?.()?.toUpperCase?.() ?? '';
      const room = rooms.get(code);
      if (!room) { socket.emit('spectate_error', { message: 'Room not found' }); return; }
      if (!room.spectators) room.spectators = new Set();
      room.spectators.add(socket.id);
      spectatorToRoom.set(socket.id, code);
      void socket.join(code);
      getSpectatorBoards(room, io, socket);
    });

    socket.on('stop_spectating', () => {
      const roomId = spectatorToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      room?.spectators?.delete(socket.id);
      spectatorToRoom.delete(socket.id);
      socket.leave(roomId);
    });

    // ── Zenith / Quick Play ───────────────────────────────────────────────────
    socket.on('join_zenith', (payload?: { subMode?: string }) => {
      const raw = payload?.subMode;
      const subMode: 'open' | 'solo' | 'duo' =
        raw === 'solo' ? 'solo' : raw === 'duo' ? 'duo' : 'open';

      // ── SOLO: private room, start immediately ─────────────────────────────
      if (subMode === 'solo') {
        const id = generateRoomCode();
        const soloRoom: GameRoom = {
          id,
          mode: 'zenith',
          status: 'waiting',
          maxPlayers: 1,
          players: [],
          altitude: {},
          garbageTargets: {},
          spectators: new Set(),
          matchResolved: false,
          zenithSubMode: 'solo',
        };
        rooms.set(id, soloRoom);
        joinRoom(socket, id, user, io);
        const r = rooms.get(id);
        if (r) {
          r.players.forEach((p) => { p.ready = true; });
          startCountdown(io, r);
        }
        return;
      }

      // ── OPEN / DUO: find or create a room; allow mid-game joining ─────────
      let zenithRoom: GameRoom | null = null;
      for (const [, room] of rooms) {
        if (
          room.mode === 'zenith' &&
          room.zenithSubMode === subMode &&
          (room.status === 'waiting' || room.status === 'playing') &&
          room.players.length < ZENITH_MAX_PLAYERS &&
          !room.players.find((p) => p.userId === user.userId)
        ) {
          zenithRoom = room;
          break;
        }
      }

      if (!zenithRoom) {
        const id = generateRoomCode();
        zenithRoom = {
          id,
          mode: 'zenith',
          status: 'waiting',
          maxPlayers: ZENITH_MAX_PLAYERS,
          players: [],
          altitude: {},
          garbageTargets: {},
          spectators: new Set(),
          matchResolved: false,
          zenithSubMode: subMode,
        };
        rooms.set(id, zenithRoom);
      }

      const wasPlaying = zenithRoom.status === 'playing';
      joinRoom(socket, zenithRoom.id, user, io);

      if (wasPlaying) {
        // Mid-game join: initialize state and start immediately
        const r = rooms.get(zenithRoom.id);
        if (r) {
          if (!r.altitude) r.altitude = {};
          r.altitude[user.userId] = 0;
          const player = r.players.find((p) => p.userId === user.userId);
          if (player) { player.alive = true; player.ready = true; }
          // Assign team for duo mid-game joiner
          if (r.zenithSubMode === 'duo' && r.teams) {
            const letters = 'ABCDEFGHIJ';
            const usedTeams = new Set(Object.values(r.teams));
            let assigned = false;
            for (const letter of letters) {
              const teamMembers = r.players.filter((p) => r.teams![p.userId] === letter);
              if (teamMembers.length < 2) {
                r.teams[user.userId] = letter;
                if (player) player.teamId = letter;
                assigned = true;
                break;
              }
            }
            if (!assigned) {
              const newTeam = letters[usedTeams.size] ?? 'Z';
              r.teams[user.userId] = newTeam;
              if (player) player.teamId = newTeam;
            }
          }
          reassignGarbageTargets(r);
          socket.emit('game_start', { roomId: r.id });
          socket.emit('zenith_teams', r.teams ?? {});
          io.to(r.id).emit('zenith_leaderboard', buildZenithLeaderboard(r));
        }
        return;
      }

      // Waiting room: start the countdown timer if not already running
      const rId = zenithRoom.id;
      if (!zenithRoom.zenithStartTimer) {
        zenithRoom.zenithStartTimer = setTimeout(() => {
          const r = rooms.get(rId);
          if (!r || r.status !== 'waiting' || r.players.length < 1) return;
          r.players.forEach((p) => { p.ready = true; });
          startCountdown(io, r);
        }, ZENITH_START_WAIT_MS);
      }
    });

    // Player reports line clears → altitude + garbage routing + revive missions
    socket.on('zenith_clear', ({ linesCleared, attack }: { linesCleared: number; attack: number }) => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.mode !== 'zenith' || room.status !== 'playing') return;

      if (!room.altitude) room.altitude = {};
      const alt = room.altitude[user.userId] ?? 0;
      room.altitude[user.userId] = alt + linesCleared + Math.floor(attack * 0.5);

      // Route garbage
      const targetId = room.garbageTargets?.[user.userId];
      if (targetId && attack > 0) {
        const targetPlayer = room.players.find((p) => p.userId === targetId);
        if (targetPlayer?.alive) {
          io.to(roomId).emit('zenith_garbage', { to: targetId, lines: attack, from: user.userId });
        } else {
          reassignGarbageTargets(room);
          const newTarget = room.garbageTargets?.[user.userId];
          if (newTarget) {
            io.to(roomId).emit('zenith_garbage', { to: newTarget, lines: attack, from: user.userId });
          }
        }
      }

      // Track revive mission progress (duo mode)
      if (room.reviveMissions && room.zenithSubMode === 'duo') {
        const mission = room.reviveMissions[user.userId];
        if (mission && linesCleared > 0) {
          mission.linesCleared += linesCleared;
          io.to(roomId).emit('zenith_revive_progress', {
            reviverUserId: user.userId,
            linesCleared: mission.linesCleared,
            linesNeeded: mission.linesNeeded,
          });

          if (mission.linesCleared >= mission.linesNeeded) {
            const { partnerId } = mission;
            delete room.reviveMissions[user.userId];
            const partner = room.players.find((p) => p.userId === partnerId);
            if (partner) {
              partner.alive = true;
              reassignGarbageTargets(room);
              io.to(roomId).emit('zenith_revive', {
                revivedUserId: partnerId,
                reviverUserId: user.userId,
                reviverUsername: user.username,
              });
              io.to(roomId).emit('zenith_leaderboard', buildZenithLeaderboard(room));
            }
          }
        }
      }

      io.to(roomId).emit('zenith_leaderboard', buildZenithLeaderboard(room));
    });

    socket.on('zenith_top_out', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.mode !== 'zenith') return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || !player.alive) return;

      player.alive = false;
      const finalAlt = room.altitude?.[player.userId] ?? 0;
      const place = room.players.filter((p) => !p.alive).length;
      io.to(roomId).emit('zenith_ko', { userId: player.userId, username: player.username, altitude: finalAlt, place });

      // Cancel any pending missions involving this player
      cancelReviveMissionsFor(room, player.userId);

      // Duo mode: check if partner can start a revive mission
      if (room.zenithSubMode === 'duo' && room.teams) {
        const myTeamId = room.teams[player.userId];
        const teammate = myTeamId
          ? room.players.find(
              (p) => p.userId !== player.userId && room.teams![p.userId] === myTeamId && p.alive
            )
          : null;

        if (teammate) {
          if (!room.reviveMissions) room.reviveMissions = {};
          room.reviveMissions[teammate.userId] = {
            partnerId: player.userId,
            partnerUsername: player.username,
            linesNeeded: REVIVE_LINES_NEEDED,
            linesCleared: 0,
          };
          io.to(roomId).emit('zenith_partner_ko', {
            ko_userId: player.userId,
            ko_username: player.username,
            reviver_userId: teammate.userId,
            linesNeeded: REVIVE_LINES_NEEDED,
          });
          io.to(roomId).emit('zenith_leaderboard', buildZenithLeaderboard(room));
          return; // Don't check game-over yet — partner can still revive
        }
      }

      reassignGarbageTargets(room);
      io.to(roomId).emit('zenith_leaderboard', buildZenithLeaderboard(room));

      const aliveTeams = getAliveTeams(room);
      if (aliveTeams.length <= 1) {
        room.status = 'finished';
        const winner = room.players.find((p) => p.alive) ?? null;
        io.to(roomId).emit('zenith_game_over', {
          winner: winner?.userId ?? null,
          winnerUsername: winner?.username ?? null,
          leaderboard: buildZenithLeaderboard(room),
        });
      }
    });

    socket.on('create_public_room', ({ mode, maxPlayers }: { mode?: string; maxPlayers?: number }) => {
      const roomCode = generateRoomCode();
      const roomMode = normalizeQueueMode(mode);
      const room: GameRoom = {
        id: roomCode,
        mode: roomMode,
        status: 'waiting',
        roomCode,
        isPublic: true,
        maxPlayers: Math.min(6, Math.max(2, Math.floor(Number(maxPlayers) || 2))),
        players: [],
        matchResolved: false,
      };
      rooms.set(roomCode, room);
      joinRoom(socket, roomCode, user, io);
      socket.emit('room_created', { roomCode });
      broadcastPublicRooms(io);
    });

    socket.on('join_queue', (payload?: { mode?: string }) => {
      const queueMode = normalizeQueueMode(payload?.mode);
      let foundRoom: GameRoom | null = null;

      for (const [, room] of rooms) {
        if (
          room.mode === queueMode &&
          room.status === 'waiting' &&
          room.players.length < (room.maxPlayers ?? 2) &&
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
          maxPlayers: 2,
          players: [],
          series:
            queueMode === 'league'
              ? { bestOf: 3, targetWins: 2, wins: {} }
              : undefined,
          matchResolved: false,
        };
        rooms.set(roomId, newRoom);
        joinRoom(socket, roomId, user, io);
      }
    });

    socket.on('leave_queue', () => { void leaveRoom(socket, io); });
    socket.on('leave_room', () => { void leaveRoom(socket, io); });

    socket.on('create_room', ({ mode, maxPlayers }: { mode?: string; maxPlayers?: number }) => {
      const roomCode = generateRoomCode();
      const roomMode = normalizeQueueMode(mode);
      const room: GameRoom = {
        id: roomCode,
        mode: roomMode,
        status: 'waiting',
        roomCode,
        maxPlayers: Math.min(6, Math.max(2, Math.floor(Number(maxPlayers) || 2))),
        players: [],
        series:
          roomMode === 'league'
            ? { bestOf: 3, targetWins: 2, wins: {} }
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
      if (!room) { socket.emit('room_error', { message: 'Room not found' }); return; }
      if (room.players.length >= (room.maxPlayers ?? 2)) {
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
        const readyCount = room.players.filter((p) => p.ready).length;
        const enoughPlayers = room.players.length >= 2;
        const allReady = room.players.every((p) => p.ready);
        if (enoughPlayers && allReady) {
          startCountdown(io, room);
        } else if (enoughPlayers && readyCount >= 2 && room.players.length === room.maxPlayers) {
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

    socket.on('send_attack', (payload: { lines?: number }) => {
      const lines = Math.max(0, Math.min(20, Math.floor(Number(payload?.lines) || 0)));
      if (lines <= 0) return;
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;
      socket.to(roomId).emit('garbage_incoming', { lines, from: user.userId });
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
        socket.to(roomId).emit('garbage_incoming', { lines: attack, from: user.userId });
      }
    });

    socket.on('board_update', (data: { board?: number[][] }) => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      if (!data?.board) return;
      socket.to(roomId).emit('opponent_board', { userId: user.userId, board: data.board });
    });

    socket.on('top_out', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player && player.alive) {
        player.alive = false;
        const place = room.players.filter((p) => !p.alive).length;
        io.to(roomId).emit('player_eliminated', { userId: user.userId, place });

        const alivePlayers = room.players.filter((p) => p.alive);
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0] ?? null;
          const loser = player;
          if (!winner) {
            room.status = 'finished';
            io.to(roomId).emit('game_over', { winner: null });
            return;
          }
          void finishRound(io, room, winner, loser);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.username}`);
      const spectatedRoom = spectatorToRoom.get(socket.id);
      if (spectatedRoom) {
        rooms.get(spectatedRoom)?.spectators?.delete(socket.id);
        spectatorToRoom.delete(socket.id);
      }
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
    room.players.forEach((p) => { p.ready = false; });
  }

  playerToRoom.set(socket.id, roomId);
  socket.join(roomId);
  socket.emit('room_joined', { roomId, room: sanitizeRoom(room) });
  io.to(roomId).emit('room_update', sanitizeRoom(room));

  if (room.players.length >= (room.maxPlayers ?? 2)) {
    io.to(roomId).emit('match_found', { roomId });
    broadcastPublicRooms(io);
  } else if (room.isPublic) {
    broadcastPublicRooms(io);
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
    broadcastPublicRooms(io);
    return;
  }

  if (room.status === 'finished') {
    io.to(roomId).emit('room_update', sanitizeRoom(room));
    return;
  }

  room.players.forEach((p) => { p.ready = false; });
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
      room.players.forEach((p) => { p.alive = true; p.ready = true; });
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
  if (room.mode === 'zenith') {
    room.altitude = {};
    room.garbageTargets = {};
    room.reviveMissions = {};
    room.players.forEach((p) => { if (room.altitude) room.altitude[p.userId] = 0; });
    if (room.zenithSubMode === 'duo') {
      assignDuoTeams(room);
    }
    reassignGarbageTargets(room);
  }
  // Broadcast team assignments before game starts
  if (room.teams) {
    io.to(room.id).emit('zenith_teams', room.teams);
  }
  io.to(room.id).emit('room_update', sanitizeRoom(room));
  let count = 3;
  io.to(room.id).emit('countdown', { count: 3 });

  const interval = setInterval(() => {
    count--;
    if (count < 0) {
      clearInterval(interval);
      room.status = 'playing';
      room.players.forEach((p) => { p.alive = true; p.ready = true; });
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
    maxPlayers: room.maxPlayers ?? 2,
    altitude: room.altitude ?? {},
    zenithSubMode: room.zenithSubMode,
    teams: room.teams ?? {},
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
      teamId: p.teamId,
    })),
  };
}
