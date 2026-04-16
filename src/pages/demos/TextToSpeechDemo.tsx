import React, { useState, useRef } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

const VOICES = [
  { name: 'en-US-JennyNeural', label: 'Jenny (English US)' },
  { name: 'en-US-GuyNeural', label: 'Guy (English US)' },
  { name: 'en-GB-SoniaNeural', label: 'Sonia (English UK)' },
  { name: 'da-DK-ChristelNeural', label: 'Christel (Danish)' },
  { name: 'da-DK-JeppeNeural', label: 'Jeppe (Danish)' },
  { name: 'de-DE-KatjaNeural', label: 'Katja (German)' },
  { name: 'fr-FR-DeniseNeural', label: 'Denise (French)' },
  { name: 'es-ES-ElviraNeural', label: 'Elvira (Spanish)' },
  { name: 'it-IT-ElsaNeural', label: 'Elsa (Italian)' },
  { name: 'ja-JP-NanamiNeural', label: 'Nanami (Japanese)' },
  { name: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao (Chinese)' },
  { name: 'ko-KR-SunHiNeural', label: 'SunHi (Korean)' },
  { name: 'pt-BR-FranciscaNeural', label: 'Francisca (Portuguese BR)' },
  { name: 'ar-SA-ZariyahNeural', label: 'Zariyah (Arabic)' },
];

const SAMPLE_TEXTS: Record<string, string> = {
  'en-US': 'Azure AI Speech provides industry-leading speech-to-text, text-to-speech, speech translation, and speaker recognition capabilities. Experience the power of neural text-to-speech with natural-sounding voices.',
  'en-GB': 'Azure AI Speech provides industry-leading speech capabilities with natural-sounding neural voices.',
  'da-DK': 'Azure AI Speech tilbyder brancheførende tale-til-tekst, tekst-til-tale og taleoversættelse. Oplev kraften i neurale stemmer der lyder helt naturlige.',
  'de-DE': 'Azure AI Speech bietet branchenführende Sprach-zu-Text, Text-zu-Sprache und Sprachübersetzung mit natürlich klingenden neuronalen Stimmen.',
  'fr-FR': 'Azure AI Speech offre des capacités de reconnaissance vocale, de synthèse vocale et de traduction vocale de pointe avec des voix neuronales naturelles.',
  'es-ES': 'Azure AI Speech ofrece capacidades líderes en la industria de voz a texto, texto a voz y traducción de voz con voces neuronales de sonido natural.',
  'it-IT': 'Azure AI Speech offre funzionalità leader del settore per la sintesi vocale con voci neurali dal suono naturale.',
  'ja-JP': 'Azure AI Speechは、業界をリードする音声テキスト変換、テキスト音声変換、音声翻訳機能を提供します。',
  'zh-CN': 'Azure AI 语音服务提供行业领先的语音转文本、文本转语音和语音翻译功能，具有自然的神经语音。',
  'ko-KR': 'Azure AI Speech는 업계를 선도하는 음성 텍스트 변환, 텍스트 음성 변환 기능을 제공합니다.',
  'pt-BR': 'O Azure AI Speech oferece recursos líderes do setor de conversão de fala em texto e texto em fala com vozes neurais naturais.',
  'ar-SA': 'يوفر Azure AI Speech إمكانيات رائدة في تحويل الكلام إلى نص ونص إلى كلام مع أصوات عصبية طبيعية.',
};

const TextToSpeechDemo: React.FC = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('en-US-JennyNeural');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);

  const handleSpeak = async () => {
    if (!text.trim() || isSpeaking) return;
    try {
      setError(null);
      setIsSpeaking(true);
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = voice;

      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
      synthesizerRef.current = synthesizer;

      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === SpeechSDK.ResultReason.Canceled) {
            const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
            setError(`Synthesis canceled: ${cancellation.errorDetails}`);
          }
          synthesizer.close();
          synthesizerRef.current = null;
          setIsSpeaking(false);
        },
        (err) => {
          setError(`Synthesis error: ${err}`);
          synthesizer.close();
          synthesizerRef.current = null;
          setIsSpeaking(false);
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to synthesize speech');
      setIsSpeaking(false);
    }
  };

  const handleStop = () => {
    const synth = synthesizerRef.current;
    if (synth) {
      synth.close();
      synthesizerRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handleLoadSample = () => {
    const lang = voice.substring(0, 5);
    setText(SAMPLE_TEXTS[lang] || SAMPLE_TEXTS['en-US']);
  };

  const handleClear = () => {
    handleStop();
    setText('');
    setError(null);
  };

  return (
    <>
      <div className="demo-controls">
        <select
          className="demo-select"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          disabled={isSpeaking}
        >
          {VOICES.map((v) => (
            <option key={v.name} value={v.name}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="demo-input-group">
        <div className="textarea-wrapper">
          <textarea
            className="demo-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to speak…"
            rows={6}
          />
          {text && (
            <button className="textarea-clear-btn" onClick={handleClear} type="button" aria-label="Clear text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="demo-actions">
          <button className="action-btn action-btn-secondary" onClick={handleLoadSample} type="button">
            Load Sample
          </button>
          {isSpeaking ? (
            <button className="action-btn action-btn-primary" onClick={handleStop} type="button">
              Stop
            </button>
          ) : (
            <button
              className="action-btn action-btn-primary"
              onClick={handleSpeak}
              type="button"
              disabled={!text.trim()}
            >
              Speak
            </button>
          )}
        </div>
      </div>

      {error && <p className="demo-error">{error}</p>}

      {isSpeaking && (
        <div className="demo-output">
          <div className="speaking-indicator">
            <span className="speaking-dot" />
            <span className="speaking-dot" />
            <span className="speaking-dot" />
            <span className="speaking-label">Speaking…</span>
          </div>
        </div>
      )}
    </>
  );
};

export default TextToSpeechDemo;
