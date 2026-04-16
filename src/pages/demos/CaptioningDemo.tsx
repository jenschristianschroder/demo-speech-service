import React, { useState, useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'ko-KR', label: 'Korean' },
];

interface CaptionLine {
  id: number;
  text: string;
  timestamp: string;
}

let captionIdCounter = 0;

const CaptioningDemo: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('en-US');
  const [partialText, setPartialText] = useState('');
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const captionsEndRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = language;

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognizing = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          setPartialText(e.result.text);
        }
      };

      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          const newCaption: CaptionLine = {
            id: ++captionIdCounter,
            text: e.result.text,
            timestamp: formatTime(new Date()),
          };
          setCaptions((prev) => [...prev, newCaption]);
          setPartialText('');
          setTimeout(() => captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      };

      recognizer.canceled = (_s, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          setError(`Captioning error: ${e.errorDetails}`);
        }
        setIsRecording(false);
        recognizer.close();
        recognizerRef.current = null;
      };

      recognizer.startContinuousRecognitionAsync(
        () => setIsRecording(true),
        (err) => setError(`Failed to start: ${err}`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start captioning');
    }
  }, [language]);

  const stopRecording = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
          recognizerRef.current = null;
          setIsRecording(false);
          setPartialText('');
        },
        () => {
          recognizer.close();
          recognizerRef.current = null;
          setIsRecording(false);
        },
      );
    } else {
      setIsRecording(false);
    }
  }, []);

  const handleClear = () => {
    stopRecording();
    setCaptions([]);
    setPartialText('');
    setError(null);
  };

  return (
    <>
      <div className="demo-controls">
        <select
          className="demo-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isRecording}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="demo-mic-section">
        <button
          className={`mic-btn ${isRecording ? 'mic-btn-active' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          type="button"
        >
          {isRecording ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          {isRecording ? 'Stop Captioning' : 'Start Captioning'}
        </button>
      </div>

      {error && <p className="demo-error">{error}</p>}

      <div className="demo-output">
        <div className="output-header">
          <h2 className="output-title">Captions</h2>
          {captions.length > 0 && (
            <button className="output-clear" onClick={handleClear} type="button">Clear</button>
          )}
        </div>
        <div className="captions-area">
          {captions.length === 0 && !partialText && (
            <span className="transcript-placeholder">
              {isRecording ? 'Listening for speech…' : 'Captions will appear here…'}
            </span>
          )}
          {captions.map((c) => (
            <div key={c.id} className="caption-line">
              <span className="caption-timestamp">{c.timestamp}</span>
              <span className="caption-text">{c.text}</span>
            </div>
          ))}
          {partialText && (
            <div className="caption-line caption-partial">
              <span className="caption-timestamp">{formatTime(new Date())}</span>
              <span className="caption-text">{partialText}</span>
            </div>
          )}
          <div ref={captionsEndRef} />
        </div>
      </div>
    </>
  );
};

export default CaptioningDemo;
