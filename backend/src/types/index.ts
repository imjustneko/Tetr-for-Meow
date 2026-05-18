export interface JwtPayload {
    userId: string;
    username: string;
    email: string;
  }

  export interface AuthenticatedRequest extends Express.Request {
    user?: JwtPayload;
  }

  export interface ReviveMission {
    partnerId: string;
    partnerUsername: string;
    linesNeeded: number;
    linesCleared: number;
  }

  export interface GameRoom {
    id: string;
    mode: string;
    status: 'waiting' | 'countdown' | 'playing' | 'finished';
    roomCode?: string;
    isPublic?: boolean;
    maxPlayers: number;
    players: RoomPlayer[];
    matchId?: string;
  series?: {
    bestOf: number;
    targetWins: number;
    wins: Record<string, number>;
  };
  matchResolved?: boolean;
  // Zenith / Quick Play fields
  altitude?: Record<string, number>;
  garbageTargets?: Record<string, string>;
  spectators?: Set<string>;
  zenithStartTimer?: ReturnType<typeof setTimeout>;
  zenithGarbageTimer?: ReturnType<typeof setInterval>;
  zenithGameStartTime?: number;
  zenithSubMode?: 'open' | 'solo' | 'duo';
  teams?: Record<string, string>;        // userId → teamId ('A', 'B', …)
  reviveMissions?: Record<string, ReviveMission>; // survivorUserId → mission
  }

  export interface RoomPlayer {
    userId: string;
    username: string;
    socketId: string;
    ready: boolean;
    alive: boolean;
    rating: number;
    teamId?: string;
  }

  export interface GameEvent {
    type: string;
    payload: Record<string, unknown>;
    timestamp: number;
  }
