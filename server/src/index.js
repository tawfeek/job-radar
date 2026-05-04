// JobRadar API + static SPA host.
//
// Routes:
//   POST /api/auth/login                  — returns JWT for the single password
//   * /api/...                            — all other API routes require Bearer token
//   GET  /                                — serves client/dist (in production)
//
// In dev: only the API mounts here. The Vite dev server runs on 5174 with
// a proxy to /api → 5173.

import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobSearch.js';
import { requireAuth } from './middleware/auth.js';
import { startCron } from './cron/schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

// API responses must never be cached — the Kanban + run history change
// constantly and a stale 304 is the worst possible UX here.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);

// Production: serve the built SPA at /. SPA catch-all so deep links work.
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../../client/dist');
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[jobradar] listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
  startCron();
});
