import { Router, Request, Response } from 'express';
import { getSpeechToken } from '../azureClient.js';

export const speechRouter = Router();

/**
 * POST /api/speech/token
 * Issues a short-lived authorization token for the browser Speech SDK.
 * The token is valid for ~10 minutes.
 */
speechRouter.post('/token', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { token, region } = await getSpeechToken();
    res.json({ token, region });
  } catch (err) {
    console.error('Token issuance error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to issue speech token: ${message}` });
  }
});
