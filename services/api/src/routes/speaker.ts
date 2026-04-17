import { Router, Request, Response } from 'express';
import { getAzureBearerToken, getSpeakerRecognitionBaseUrl } from '../azureClient.js';

export const speakerRouter = Router();

/**
 * POST /api/speaker/profiles
 * Create a new text-independent identification profile.
 * Body: { "locale": "en-US" }
 */
speakerRouter.post('/profiles', async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = req.body?.locale || 'en-US';
    const token = await getAzureBearerToken();
    const baseUrl = getSpeakerRecognitionBaseUrl();

    const upstream = await fetch(
      `${baseUrl}/speaker-recognition/identification/text-independent/profiles?api-version=2024-11-15`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const body = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json(body);
      return;
    }
    res.json(body);
  } catch (err) {
    console.error('Create profile error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create speaker profile: ${message}` });
  }
});

/**
 * POST /api/speaker/profiles/:profileId/enroll
 * Enroll audio for a speaker profile.
 * Body: raw audio (WAV 16kHz 16-bit mono)
 */
speakerRouter.post('/profiles/:profileId/enroll', async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params;
    const token = await getAzureBearerToken();
    const baseUrl = getSpeakerRecognitionBaseUrl();

    // Collect raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const upstream = await fetch(
      `${baseUrl}/speaker-recognition/identification/text-independent/profiles/${encodeURIComponent(profileId)}/enrollments?api-version=2024-11-15`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30_000),
      },
    );

    const body = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json(body);
      return;
    }
    res.json(body);
  } catch (err) {
    console.error('Enroll error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to enroll speaker: ${message}` });
  }
});

/**
 * POST /api/speaker/identify
 * Identify the speaker from audio against a set of profiles.
 * Query: profileIds=id1,id2,id3
 * Body: raw audio (WAV 16kHz 16-bit mono)
 */
speakerRouter.post('/identify', async (req: Request, res: Response): Promise<void> => {
  try {
    const profileIds = req.query.profileIds as string;
    if (!profileIds) {
      res.status(400).json({ error: 'profileIds query parameter is required' });
      return;
    }

    const token = await getAzureBearerToken();
    const baseUrl = getSpeakerRecognitionBaseUrl();

    // Collect raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const upstream = await fetch(
      `${baseUrl}/speaker-recognition/identification/text-independent/profiles/identifySingleSpeaker?api-version=2024-11-15&profileIds=${encodeURIComponent(profileIds)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30_000),
      },
    );

    const body = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json(body);
      return;
    }
    res.json(body);
  } catch (err) {
    console.error('Identify error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to identify speaker: ${message}` });
  }
});

/**
 * DELETE /api/speaker/profiles/:profileId
 * Delete a single speaker profile from Azure.
 */
speakerRouter.delete('/profiles/:profileId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params;
    const token = await getAzureBearerToken();
    const baseUrl = getSpeakerRecognitionBaseUrl();

    const upstream = await fetch(
      `${baseUrl}/speaker-recognition/identification/text-independent/profiles/${encodeURIComponent(profileId)}?api-version=2024-11-15`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (upstream.status === 204 || upstream.ok) {
      res.status(204).end();
      return;
    }

    const body = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(body);
  } catch (err) {
    console.error('Delete profile error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete speaker profile: ${message}` });
  }
});

/**
 * POST /api/speaker/profiles/delete-batch
 * Delete multiple speaker profiles from Azure in one call.
 * Body: { "profileIds": ["id1", "id2", ...] }
 * Returns: { "results": [{ "profileId": "…", "deleted": true/false, "error": "…" }] }
 */
speakerRouter.post('/profiles/delete-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const profileIds: string[] = req.body?.profileIds;
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      res.status(400).json({ error: 'profileIds array is required' });
      return;
    }

    const token = await getAzureBearerToken();
    const baseUrl = getSpeakerRecognitionBaseUrl();

    const results = await Promise.all(
      profileIds.map(async (profileId) => {
        try {
          const upstream = await fetch(
            `${baseUrl}/speaker-recognition/identification/text-independent/profiles/${encodeURIComponent(profileId)}?api-version=2024-11-15`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(10_000),
            },
          );

          if (upstream.status === 204 || upstream.ok) {
            return { profileId, deleted: true };
          }
          const body = await upstream.json().catch(() => ({}));
          return { profileId, deleted: false, error: body?.error?.message || `HTTP ${upstream.status}` };
        } catch (err) {
          return { profileId, deleted: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }),
    );

    res.json({ results });
  } catch (err) {
    console.error('Batch delete error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete speaker profiles: ${message}` });
  }
});
