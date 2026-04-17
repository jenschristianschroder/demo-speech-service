import { DefaultAzureCredential } from '@azure/identity';

const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

if (!AZURE_SPEECH_REGION) {
  throw new Error('AZURE_SPEECH_REGION environment variable is required');
}

const credential = new DefaultAzureCredential();
const SCOPE = 'https://cognitiveservices.azure.com/.default';

export async function getSpeechToken(): Promise<{ token: string; region: string }> {
  // 1. Obtain a Microsoft Entra ID (AAD) access token
  const tokenResponse = await credential.getToken(SCOPE);

  // 2. Exchange it for a short-lived Cognitive Services authorization token
  //    via the /sts/v1.0/issueToken endpoint. The Speech SDK's
  //    fromAuthorizationToken() expects this kind of token, not a raw AAD JWT.
  const issueTokenUrl = `https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const res = await fetch(issueTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
      'Content-Length': '0',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to issue speech token (${res.status}): ${body}`);
  }

  const speechToken = await res.text();
  return {
    token: speechToken,
    region: AZURE_SPEECH_REGION!,
  };
}
