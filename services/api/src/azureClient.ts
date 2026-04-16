import { DefaultAzureCredential } from '@azure/identity';

const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

if (!AZURE_SPEECH_REGION) {
  throw new Error('AZURE_SPEECH_REGION environment variable is required');
}

const credential = new DefaultAzureCredential();
const SCOPE = 'https://cognitiveservices.azure.com/.default';

export async function getSpeechToken(): Promise<{ token: string; region: string }> {
  const tokenResponse = await credential.getToken(SCOPE);
  return {
    token: tokenResponse.token,
    region: AZURE_SPEECH_REGION!,
  };
}

export function getRegion(): string {
  return AZURE_SPEECH_REGION!;
}
