import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { DefaultEventsMap, Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import { initSocket } from './socket';
import type { JwtPayload } from './types';

/** Browsers send Origin without a trailing slash; env vars often include one. */
function normalizeFrontendOrigin(url: string): string {
  return url.replace(/\/+$/, '') || 'http://localhost:3000';
}

const frontendOrigin = normalizeFrontendOrigin(
  process.env.FRONTEND_URL || 'http://localhost:3000'
);

const app = express();
const httpServer = createServer(app);

const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: JwtPayload }>(
  httpServer,
  {
    cors: {
      origin: frontendOrigin,
      credentials: true,
    },
  }
);

// Middleware
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', game: 'MeowTetr' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Socket.IO
initSocket(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🐱 MeowTetr backend running on port ${PORT}`);
});