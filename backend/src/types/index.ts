export interface JwtPayload {
    userId: string;
    username: string;
    email: string;
  }
  
  export interface AuthenticatedRequest extends Express.Request {
    user?: JwtPayload;
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
  altitude?: Record<string, number>;     // userId → meters climbed
  garbageTargets?: Record<string, string>; // userId → target userId
  spectators?: Set<string>;              // socket IDs watching
  zenithStartTimer?: ReturnType<typeof setTimeout>;
  }
  
  export interface RoomPlayer {
    userId: string;
    username: string;
    socketId: string;
    ready: boolean;
    alive: boolean;
    rating: number;
  }
  
  export interface GameEvent {
    type: string;
    payload: Record<string, unknown>;
    timestamp: number;
  }