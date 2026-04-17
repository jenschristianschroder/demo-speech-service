import { DefaultAzureCredential } from '@azure/identity';

const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const AZURE_SPEECH_ENDPOINT = process.env.AZURE_SPEECH_ENDPOINT;

if (!AZURE_SPEECH_REGION) {
  console.error('AZURE_SPEECH_REGION environment variable is required');
}

if (!AZURE_SPEECH_ENDPOINT) {
  console.error('AZURE_SPEECH_ENDPOINT environment variable is required (custom subdomain URL, e.g. https://<name>.cognitiveservices.azure.com)');
}

const credential = new DefaultAzureCredential();
const SCOPE = 'https://cognitiveservices.azure.com/.default';

export async function getSpeechToken(): Promise<{ token: string; region: string }> {
  if (!AZURE_SPEECH_REGION || !AZURE_SPEECH_ENDPOINT) {
    throw new Error('Speech service is not configured. AZURE_SPEECH_REGION and AZURE_SPEECH_ENDPOINT are required.');
  }

  // 1. Obtain a Microsoft Entra ID (AAD) access token
  const tokenResponse = await credential.getToken(SCOPE);

  // 2. Exchange it for a short-lived Cognitive Services authorization token
  //    via the /sts/v1.0/issueToken endpoint. The Speech SDK's
  //    fromAuthorizationToken() expects this kind of token, not a raw AAD JWT.
  //    Token-based auth requires a custom subdomain endpoint, not the regional
  //    endpoint (see https://aka.ms/cogsvc-authenticatewithtoken).
  const baseUrl = AZURE_SPEECH_ENDPOINT!.replace(/\/+$/, '');
  const issueTokenUrl = `${baseUrl}/sts/v1.0/issueToken`;
  const res = await fetch(issueTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
      'Content-Length': '0',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to issue speech token from ${issueTokenUrl} (${res.status}): ${body}`);
  }

  const speechToken = await res.text();
  return {
    token: speechToken,
    region: AZURE_SPEECH_REGION!,
  };
}
