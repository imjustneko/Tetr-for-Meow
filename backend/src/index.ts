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
import { prisma } from './lib/prisma';

/** Browsers send Origin without a trailing slash; env vars often include one. */
function normalizeFrontendOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '') || 'http://localhost:3000';
}

/** Comma-separated FRONTEND_URL values (production + preview domains, etc.). */
function parseFrontendOrigins(): string[] {
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
  const list = raw
    .split(',')
    .map((s) => normalizeFrontendOrigin(s))
    .filter(Boolean);
  return list.length ? list : ['http://localhost:3000'];
}

const frontendOrigins = parseFrontendOrigins();

/**
 * Infer Vercel project slug from FRONTEND_URL (e.g. https://meowtetr.vercel.app → meowtetr).
 * Override with VERCEL_PROJECT_SLUG when needed.
 */
function inferVercelProjectSlug(): string | null {
  const explicit = process.env.VERCEL_PROJECT_SLUG?.trim();
  if (explicit) return explicit;
  for (const url of frontendOrigins) {
    try {
      const host = new URL(url).hostname;
      if (!host.endsWith('.vercel.app')) continue;
      const base = host.slice(0, -'.vercel.app'.length);
      if (!base) continue;
      if (base.includes('-git-')) return base.split('-git-')[0] || null;
      if (!base.includes('-')) return base;
      return base.split('-')[0] || null;
    } catch {
      /* skip */
    }
  }
  return null;
}

const vercelProjectSlug = inferVercelProjectSlug();
/** When FRONTEND_URL points at *.vercel.app, preview URLs like meowtetr-xxx-team.vercel.app are allowed unless VERCEL_PREVIEW_CORS=0. */
const allowVercelPreviewOrigins =
  vercelProjectSlug !== null && process.env.VERCEL_PREVIEW_CORS !== '0';

function hostMatchesVercelProject(host: string, slug: string): boolean {
  return host === `${slug}.vercel.app` || (host.startsWith(`${slug}-`) && host.endsWith('.vercel.app'));
}

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (frontendOrigins.includes(origin)) return true;
  if (!allowVercelPreviewOrigins || !vercelProjectSlug) return false;
  try {
    const host = new URL(origin).hostname;
    return hostMatchesVercelProject(host, vercelProjectSlug);
  } catch {
    return false;
  }
}

const app = express();
const httpServer = createServer(app);

const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: JwtPayload }>(
  httpServer,
  {
    cors: {
      origin: (origin, cb) => {
        if (isAllowedCorsOrigin(origin)) {
          cb(null, true);
        } else {
          console.warn(`[CORS] Blocked Socket.IO origin: ${origin ?? '(none)'}`);
          cb(null, false);
        }
      },
      credentials: true,
    },
  }
);

// Middleware
app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedCorsOrigin(origin)) {
        cb(null, true);
      } else {
        console.warn(`[CORS] Blocked HTTP origin: ${origin ?? '(none)'} (allowed: ${frontendOrigins.join(' | ')}${allowVercelPreviewOrigins ? ` + Vercel previews for "${vercelProjectSlug}"` : ''})`);
        cb(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', game: 'MeowTetr' });
});

/** Confirms Prisma can query Supabase (or any Postgres) at runtime — not only at build. */
app.get('/health/db', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('[health/db]', err);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
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