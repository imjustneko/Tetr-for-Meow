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
    players: RoomPlayer[];
    matchId?: string;
  series?: {
    bestOf: number;
    targetWins: number;
    wins: Record<string, number>;
  };
  matchResolved?: boolean;
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