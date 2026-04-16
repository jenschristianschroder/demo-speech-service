import { SpeechToken } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

let cachedToken: SpeechToken | null = null;
let tokenExpiresAt = 0;

export async function getSpeechToken(): Promise<SpeechToken> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${API_BASE}/api/speech/token`, { method: 'POST' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Token error: ${res.status}`);
  }

  cachedToken = await res.json();
  tokenExpiresAt = Date.now() + 9 * 60 * 1000; // refresh at 9 min (tokens valid 10 min)
  return cachedToken!;
}
