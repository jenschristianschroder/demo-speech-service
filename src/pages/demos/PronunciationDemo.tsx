import React, { useState, useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

const REFERENCE_SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'Hello, how are you doing today?',
  'I would like to order a cup of coffee please.',
  'The weather is beautiful this morning.',
  'She sells seashells by the seashore.',
  'Peter Piper picked a peck of pickled peppers.',
  'How much wood would a woodchuck chuck if a woodchuck could chuck wood?',
  'The azure sky stretched endlessly above the mountains.',
  'Technology is transforming the way we communicate.',
  'Artificial intelligence is shaping our future.',
];

interface WordScore {
  word: string;
  accuracyScore: number;
  errorType: string;
}

interface PronunciationScores {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
  words: WordScore[];
}

const PronunciationDemo: React.FC = () => {
  const [referenceText, setReferenceText] = useState(REFERENCE_SENTENCES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [scores, setScores] = useState<PronunciationScores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  const getRandomSentence = () => {
    let next: string;
    do {
      next = REFERENCE_SENTENCES[Math.floor(Math.random() * REFERENCE_SENTENCES.length)];
    } while (next === referenceText && REFERENCE_SENTENCES.length > 1);
    setReferenceText(next);
    setScores(null);
    setError(null);
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setScores(null);
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = 'en-US';

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
        referenceText,
        SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
        SpeechSDK.PronunciationAssessmentGranularity.Word,
        true,
      );
      pronunciationConfig.applyTo(recognizer);

      setIsRecording(true);

      recognizer.recognizeOnceAsync(
        (result) => {
          setIsRecording(false);
          recognizer.close();
          recognizerRef.current = null;

          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            const pronResult = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
            const jsonStr = result.properties.getProperty(
              SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult,
            );
            let words: WordScore[] = [];
            try {
              const parsed = JSON.parse(jsonStr);
              const nBest = parsed?.NBest?.[0];
              if (nBest?.Words) {
                words = nBest.Words.map((w: { Word: string; PronunciationAssessment: { AccuracyScore: number; ErrorType: string } }) => ({
                  word: w.Word,
                  accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
                  errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
                }));
              }
            } catch {
              // fall back to top-level scores only
            }

            setScores({
              accuracyScore: pronResult.accuracyScore,
              fluencyScore: pronResult.fluencyScore,
              completenessScore: pronResult.completenessScore,
              pronunciationScore: pronResult.pronunciationScore,
              words,
            });
          } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
            setError('No speech detected. Please try again.');
          } else {
            setError('Recognition failed. Please try again.');
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
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [referenceText]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#2e7d32';
    if (score >= 60) return '#f57c00';
    return '#c62828';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs work';
  };

  return (
    <>
      <div className="demo-output">
        <div className="output-header">
          <h2 className="output-title">Read this sentence aloud</h2>
          <button className="output-clear-btn" onClick={getRandomSentence} type="button">
            New Sentence
          </button>
        </div>
        <div className="reference-text">
          {referenceText}
        </div>
      </div>

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
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          {isRecording ? 'Listening…' : 'Record'}
        </button>
      </div>

      {error && <p className="demo-error">{error}</p>}

      {scores && (
        <div className="demo-output">
          <h2 className="output-title">Results</h2>

          <div className="pronunciation-overall">
            <div className="pronunciation-score-big" style={{ borderColor: getScoreColor(scores.pronunciationScore) }}>
              <span className="score-value" style={{ color: getScoreColor(scores.pronunciationScore) }}>
                {Math.round(scores.pronunciationScore)}
              </span>
              <span className="score-sublabel">{getScoreLabel(scores.pronunciationScore)}</span>
            </div>
          </div>

          <div className="pronunciation-bars">
            <ScoreBar label="Accuracy" value={scores.accuracyScore} />
            <ScoreBar label="Fluency" value={scores.fluencyScore} />
            <ScoreBar label="Completeness" value={scores.completenessScore} />
          </div>

          {scores.words.length > 0 && (
            <div className="pronunciation-words">
              <h3 className="result-subheading">Word-by-word</h3>
              <div className="word-scores">
                {scores.words.map((w, i) => (
                  <span
                    key={i}
                    className="word-score-chip"
                    style={{
                      borderColor: getScoreColor(w.accuracyScore),
                      color: w.errorType !== 'None' ? '#c62828' : getScoreColor(w.accuracyScore),
                    }}
                    title={`${w.accuracyScore}% — ${w.errorType}`}
                  >
                    {w.word}
                    {w.errorType !== 'None' && (
                      <span className="word-error-type">{w.errorType}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const ScoreBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = value >= 80 ? '#2e7d32' : value >= 60 ? '#f57c00' : '#c62828';
  return (
    <div className="confidence-row">
      <span className="confidence-label">{label}</span>
      <div className="confidence-track">
        <div className="confidence-fill" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="confidence-value">{Math.round(value)}%</span>
    </div>
  );
};

export default PronunciationDemo;
