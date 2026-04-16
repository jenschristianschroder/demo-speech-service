import React, { useState, useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

const SOURCE_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'ar-SA', label: 'Arabic' },
];

const TARGET_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Danish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
];

const SpeechTranslationDemo: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('da');
  const [sourcePartial, setSourcePartial] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.TranslationRecognizer | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const { token, region } = await getSpeechToken();
      const translationConfig = SpeechSDK.SpeechTranslationConfig.fromAuthorizationToken(token, region);
      translationConfig.speechRecognitionLanguage = sourceLanguage;
      translationConfig.addTargetLanguage(targetLanguage);

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.TranslationRecognizer(translationConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognizing = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.TranslatingSpeech) {
          setSourcePartial(e.result.text);
        }
      };

      recognizer.recognized = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech) {
          setSourceText((prev) => prev + (prev ? ' ' : '') + e.result.text);
          const translation = e.result.translations.get(targetLanguage);
          if (translation) {
            setTranslatedText((prev) => prev + (prev ? ' ' : '') + translation);
          }
          setSourcePartial('');
        }
      };

      recognizer.canceled = (_, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          setError(`Translation error: ${e.errorDetails}`);
        }
        setIsRecording(false);
      };

      recognizer.startContinuousRecognitionAsync(
        () => setIsRecording(true),
        (err) => setError(`Failed to start: ${err}`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start translation');
    }
  }, [sourceLanguage, targetLanguage]);

  const stopRecording = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
          recognizerRef.current = null;
          setIsRecording(false);
          setSourcePartial('');
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
    setSourceText('');
    setTranslatedText('');
    setSourcePartial('');
    setError(null);
  };

  return (
    <>
      <div className="demo-controls">
        <div className="demo-control-group">
          <label className="demo-label">From</label>
          <select
            className="demo-select"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            disabled={isRecording}
          >
            {SOURCE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="demo-control-group">
          <label className="demo-label">To</label>
          <select
            className="demo-select"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={isRecording}
          >
            {TARGET_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
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
          {isRecording ? 'Stop' : 'Start Recording'}
        </button>
      </div>

      {error && <p className="demo-error">{error}</p>}

      <div className="demo-output">
        <div className="output-header">
          <h2 className="output-title">Source</h2>
          {sourceText && (
            <button className="output-clear-btn" onClick={handleClear} type="button">Clear</button>
          )}
        </div>
        <div className="transcript-area">
          {sourceText && <span className="transcript-final">{sourceText}</span>}
          {sourcePartial && <span className="transcript-partial"> {sourcePartial}</span>}
          {!sourceText && !sourcePartial && (
            <span className="transcript-placeholder">
              {isRecording ? 'Listening…' : 'Speak to see source text here…'}
            </span>
          )}
        </div>
      </div>

      <div className="demo-output">
        <h2 className="output-title">Translation</h2>
        <div className="transcript-area translation-area">
          {translatedText ? (
            <span className="transcript-final">{translatedText}</span>
          ) : (
            <span className="transcript-placeholder">Translation will appear here…</span>
          )}
        </div>
      </div>
    </>
  );
};

export default SpeechTranslationDemo;
