# Azure Speech Service Demos

An interactive demo application showcasing [Azure AI Speech Service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/) capabilities. Built with React, TypeScript, and Vite, with an Express backend that brokers Azure authentication tokens.

## Demos

| Demo | Description |
|------|-------------|
| **Speech to Text** | Speak into the microphone and see live transcription |
| **Text to Speech** | Type text and hear it spoken with Azure neural voices |
| **Speech Translation** | Speak in one language and see real-time translation |
| **Pronunciation Assessment** | Read a sentence aloud and get scored on pronunciation |
| **Language Detection** | Speak freely and detect which language is being spoken |
| **Real-time Captioning** | See live closed captions as you speak |

## Architecture

The application consists of two services:

- **SPA (frontend)** — React + TypeScript app built with Vite, served by Nginx in production. Uses the [Microsoft Cognitive Services Speech SDK](https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk) in the browser.
- **API (backend)** — Express server (`services/api`) that issues short-lived Azure Speech authorization tokens to the frontend. Uses `@azure/identity` for Azure authentication.

```
┌──────────────┐       POST /api/speech/token       ┌──────────────┐
│              │ ──────────────────────────────────▶  │              │
│   React SPA  │                                     │  Express API │
│  (browser)   │  ◀────────────────────────────────  │  (Node.js)   │
│              │       { token, region }              │              │
└──────┬───────┘                                     └──────┬───────┘
       │                                                    │
       │  Speech SDK (WebSocket)                            │  @azure/identity
       ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Azure Speech Service                          │
└──────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [Azure Speech Service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/overview) resource

## Getting Started

### 1. Configure environment variables

Copy the example and fill in your Azure Speech resource details:

```bash
cp .env.example .env
```

Set the following values in `.env`:

| Variable | Description |
|----------|-------------|
| `AZURE_SPEECH_REGION` | Azure region of your Speech resource (e.g. `northeurope`) |
| `AZURE_SPEECH_ENDPOINT` | Custom subdomain endpoint (e.g. `https://<your-resource>.cognitiveservices.azure.com`) |

### 2. Run with Docker Compose

```bash
docker compose up --build
```

This starts both the SPA (port 3000) and the API (port 3001).

### 3. Run locally (development)

Install dependencies and start both services:

```bash
# Frontend
npm install
npm run dev

# API (in a separate terminal)
cd services/api
npm install
npm run dev
```

The frontend dev server starts on `http://localhost:5173` and the API on `http://localhost:3001`.

## Project Structure

```
├── src/                        # React frontend source
│   ├── pages/
│   │   ├── WelcomeScreen.tsx   # Landing page
│   │   ├── FeaturesScreen.tsx  # Demo selection grid
│   │   ├── DemoScreen.tsx      # Demo runner (routes to individual demos)
│   │   └── demos/              # Individual demo components
│   │       ├── SpeechToTextDemo.tsx
│   │       ├── TextToSpeechDemo.tsx
│   │       ├── SpeechTranslationDemo.tsx
│   │       ├── PronunciationDemo.tsx
│   │       ├── LanguageDetectionDemo.tsx
│   │       └── CaptioningDemo.tsx
│   ├── services/               # Frontend service utilities
│   └── types.ts                # Shared types and feature definitions
├── services/api/               # Express backend
│   └── src/
│       ├── index.ts            # Server entry point
│       ├── azureClient.ts      # Azure token acquisition
│       └── routes/
│           ├── speech.ts       # Token endpoint
│           └── health.ts       # Health check
├── infra/                      # Azure Bicep IaC templates
├── Dockerfile                  # Multi-stage SPA build (Nginx)
├── docker-compose.yml          # Local orchestration (SPA + API)
└── nginx.conf                  # Nginx reverse-proxy config
```

## Deployment

Infrastructure-as-code templates are provided in the `infra/` directory using [Azure Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/). The templates deploy to **Azure Container Apps** with:

- Azure Container Registry (ACR)
- Container Apps Environment
- Managed Identity with Cognitive Services User role for passwordless auth
- Separate container apps for the SPA and API

## License

See [LICENSE](LICENSE) for details.
