import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { analyzeRouter } from './api/analyze.router';
import { sweepStaleTempDirs } from './scanner/github-repository';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isTest = process.env.NODE_ENV === 'test';

// Behind a hosting proxy (Render, Railway, Fly.io) the real client IP is in
// X-Forwarded-For. Without this, every visitor shares one rate-limit bucket.
app.set('trust proxy', 1);

// Only these frontend origins may call the API from a browser.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

// The request body is only a URL, so a small limit is plenty.
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 5 analyses per IP per minute (relaxed in tests so they don't get 429s).
app.use(
  '/api/analyze',
  rateLimit({
    windowMs: 60_000,
    limit: isTest ? 1000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  }),
);

app.use('/api', analyzeRouter);

// JSON errors for body-parser problems (oversized or malformed bodies).
app.use((err: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large.' });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (!isTest) {
  // Remove leftover temp folders from earlier failed cleanups.
  sweepStaleTempDirs().catch(console.warn);

  app.listen(PORT, () => {
    console.log(`DriftLens backend listening on http://localhost:${PORT}`);
  });
}

export default app;