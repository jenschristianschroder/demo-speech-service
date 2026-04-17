import express from 'express';
import cors from 'cors';
import { speechRouter } from './routes/speech.js';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/speech', speechRouter);
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Speech Service API listening on port ${PORT}`);
});
