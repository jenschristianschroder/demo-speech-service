import { Router, Request, Response } from 'express';

export const healthRouter = Router();

let started = false;

healthRouter.get('/startup', (_req: Request, res: Response) => {
  started = true;
  res.json({ status: 'ok' });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', (_req: Request, res: Response) => {
  if (!started) {
    res.status(503).json({ status: 'not ready' });
    return;
  }
  res.json({ status: 'ok' });
});
