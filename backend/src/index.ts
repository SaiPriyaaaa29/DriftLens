import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './api/analyze.router';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', analyzeRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`DriftLens backend listening on http://localhost:${PORT}`);
  });
}

export default app;