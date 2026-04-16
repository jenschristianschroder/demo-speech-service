import React, { useState, useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

const CANDIDATE_LANGUAGES = [
  'en-US', 'da-DK', 'de-DE', 'fr-FR', 'es-ES',
  'it-IT', 'ja-JP', 'zh-CN', 'ko-KR', 'pt-BR',
  'ar-SA', 'nl-NL', 'sv-SE', 'nb-NO', 'fi-FI',
  'pl-PL', 'ru-RU', 'hi-IN', 'tr-TR', 'th-TH',
];

const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English (US)',
  'da-DK': 'Danish',
  'de-DE': 'German',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  'zh-CN': 'Chinese (Mandarin)',
  'ko-KR': 'Korean',
  'pt-BR': 'Portuguese (Brazil)',
  'ar-SA': 'Arabic',
  'nl-NL': 'Dutch',
  'sv-SE': 'Swedish',
  'nb-NO': 'Norwegian',
  'fi-FI': 'Finnish',
  'pl-PL': 'Polish',
  'ru-RU': 'Russian',
  'hi-IN': 'Hindi',
  'tr-TR': 'Turkish',
  'th-TH': 'Thai',
};

interface DetectionResult {
  language: string;
  languageName: string;
  text: string;
}

const LanguageDetectionDemo: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setResult(null);
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);

      // Use at-start language detection on the first 4 candidates (SDK limit)
      const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(
        CANDIDATE_LANGUAGES.slice(0, 4),
      );

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = SpeechSDK.SpeechRecognizer.FromConfig(
        speechConfig,
        autoDetectConfig,
        audioConfig,
      );
      recognizerRef.current = recognizer;

      setIsRecording(true);

      recognizer.recognizeOnceAsync(
        (speechResult) => {
          setIsRecording(false);
          recognizer.close();
          recognizerRef.current = null;

          if (speechResult.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            const autoDetectResult = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(speechResult);
            const detectedLang = autoDetectResult.language || 'unknown';

            setResult({
              language: detectedLang,
              languageName: LANGUAGE_NAMES[detectedLang] || detectedLang,
              text: speechResult.text,
            });
          } else if (speechResult.reason === SpeechSDK.ResultReason.NoMatch) {
            setError('No speech detected. Please speak clearly and try again.');
          } else {
            setError('Could not detect language. Please try again.');
          }
        },
        (err) => {
          setIsRecording(false);
          recognizer.close();
          recognizerRef.current = null;
          setError(`Error: ${err}`);
        },
      );
    } catch (err) {
      setIsRecording(false);
      setError(err instanceof Error ? err.message : 'Failed to start detection');
    }
  }, []);

  const handleClear = () => {
    setResult(null);
    setError(null);
  };

  return (
    <>
      <p className="demo-hint">
        Speak in any of these languages: English, Danish, German, or French.
        The service will detect which language you are speaking.
      </p>

      <div className="demo-mic-section">
        <button
          className={`mic-btn ${isRecording ? 'mic-btn-active' : ''}`}
          onClick={isRecording ? undefined : startRecording}
          type="button"
          disabled={isRecording}
        >
          {isRecording ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          {isRecording ? 'Listening…' : 'Detect Language'}
        </button>
      </div>

      {error && <p className="demo-error">{error}</p>}

      {result && (
        <div className="demo-output">
          <div className="output-header">
            <h2 className="output-title">Detected Language</h2>
            <button className="output-clear-btn" onClick={handleClear} type="button">Clear</button>
          </div>
          <div className="language-result">
            <span className="language-name">{result.languageName}</span>
            <span className="language-code">{result.language}</span>
          </div>
          {result.text && (
            <div className="demo-output" style={{ marginTop: 16 }}>
              <h2 className="output-title">Recognized Text</h2>
              <div className="transcript-area">
                <span className="transcript-final">{result.text}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default LanguageDetectionDemo;
