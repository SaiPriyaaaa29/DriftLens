import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './api/analyze.router';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', analyzeRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DriftLens backend listening on port ${PORT}`);
  });
}

export default app;