import React, { useState, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface EnrolledSpeaker {
  name: string;
  profileId: string;
  enrollmentStatus: string;
  remainingEnrollmentsSpeechLength: number;
}

interface IdentificationResult {
  speakerName: string;
  profileId: string;
  score: number;
}

/** Record PCM audio from microphone and return a WAV Blob (16 kHz, 16-bit, mono). */
function useAudioRecorder() {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

    chunksRef.current = [];
    processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(data));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    mediaStreamRef.current = stream;
    processorRef.current = processor;
    contextRef.current = audioCtx;
    setIsRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Blob> => {
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    await contextRef.current?.close();

    const chunks = chunksRef.current;
    chunksRef.current = [];
    setIsRecording(false);

    // Merge Float32 chunks → Int16
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const pcm = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    }

    // Build WAV
    const sampleRate = 16000;
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i)); };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, pcm.length * 2, true);

    const pcmBytes = new Uint8Array(pcm.buffer);
    new Uint8Array(buffer, 44).set(pcmBytes);

    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  return { isRecording, start, stop };
}

const SpeakerRecognitionDemo: React.FC = () => {
  const [speakers, setSpeakers] = useState<EnrolledSpeaker[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [enrollingIndex, setEnrollingIndex] = useState<number | null>(null);
  const [enrollStatus, setEnrollStatus] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enrollRecorder = useAudioRecorder();
  const identifyRecorder = useAudioRecorder();

  // ─── Add Speaker ──────────────────────────────────────────
  const handleAddSpeaker = useCallback(async () => {
    if (!newSpeakerName.trim() || busy) return;
    try {
      setError(null);
      setBusy(true);

      const res = await fetch(`${API_BASE}/api/speaker/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'en-US' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error?.message || body.error || `Failed (${res.status})`);
      }

      const data = await res.json();

      setSpeakers((prev) => [
        ...prev,
        {
          name: newSpeakerName.trim(),
          profileId: data.profileId,
          enrollmentStatus: data.enrollmentStatus ?? 'Enrolling',
          remainingEnrollmentsSpeechLength: data.remainingEnrollmentsSpeechLength ?? 20,
        },
      ]);
      setNewSpeakerName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create speaker profile');
    } finally {
      setBusy(false);
    }
  }, [newSpeakerName, busy]);

  // ─── Enroll ───────────────────────────────────────────────
  const handleStartEnroll = useCallback(async (index: number) => {
    try {
      setError(null);
      setEnrollingIndex(index);
      setEnrollStatus('Recording… speak naturally for at least 20 seconds');
      await enrollRecorder.start();
    } catch (err) {
      setEnrollingIndex(null);
      setError(err instanceof Error ? err.message : 'Microphone access failed');
    }
  }, [enrollRecorder]);

  const handleStopEnroll = useCallback(async () => {
    if (enrollingIndex === null) return;
    try {
      setEnrollStatus('Uploading audio…');
      const audioBlob = await enrollRecorder.stop();
      const speaker = speakers[enrollingIndex];

      const res = await fetch(
        `${API_BASE}/api/speaker/profiles/${encodeURIComponent(speaker.profileId)}/enroll`,
        { method: 'POST', body: audioBlob },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error?.message || body.error || `Enrollment failed (${res.status})`);
      }

      const data = await res.json();

      setSpeakers((prev) =>
        prev.map((s, i) =>
          i === enrollingIndex
            ? {
                ...s,
                enrollmentStatus: data.enrollmentStatus ?? s.enrollmentStatus,
                remainingEnrollmentsSpeechLength: data.remainingEnrollmentsSpeechLength ?? 0,
              }
            : s,
        ),
      );

      const enrolled = (data.enrollmentStatus ?? '').toLowerCase() === 'enrolled';
      setEnrollStatus(enrolled ? 'Enrollment complete!' : 'More speech needed — enroll again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
      setEnrollStatus('');
    } finally {
      setEnrollingIndex(null);
    }
  }, [enrollingIndex, speakers, enrollRecorder]);

  // ─── Identify ─────────────────────────────────────────────
  const handleStartIdentify = useCallback(async () => {
    const enrolledSpeakers = speakers.filter((s) => s.enrollmentStatus.toLowerCase() === 'enrolled');
    if (enrolledSpeakers.length === 0) {
      setError('At least one fully enrolled speaker is required for identification.');
      return;
    }
    try {
      setError(null);
      setIdentificationResult(null);
      setIsIdentifying(true);
      await identifyRecorder.start();
    } catch (err) {
      setIsIdentifying(false);
      setError(err instanceof Error ? err.message : 'Microphone access failed');
    }
  }, [speakers, identifyRecorder]);

  const handleStopIdentify = useCallback(async () => {
    try {
      const audioBlob = await identifyRecorder.stop();
      const enrolledSpeakers = speakers.filter((s) => s.enrollmentStatus.toLowerCase() === 'enrolled');
      const profileIds = enrolledSpeakers.map((s) => s.profileId).join(',');

      const res = await fetch(
        `${API_BASE}/api/speaker/identify?profileIds=${encodeURIComponent(profileIds)}`,
        { method: 'POST', body: audioBlob },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error?.message || body.error || `Identification failed (${res.status})`);
      }

      const data = await res.json();

      if (data.profilesRanking && data.profilesRanking.length > 0) {
        const best = data.profilesRanking[0];
        const matchedSpeaker = speakers.find((s) => s.profileId === best.profileId);
        setIdentificationResult({
          speakerName: matchedSpeaker?.name || 'Unknown',
          profileId: best.profileId,
          score: best.score ?? 0,
        });
      } else if (data.identifiedProfile?.profileId) {
        const matchedSpeaker = speakers.find((s) => s.profileId === data.identifiedProfile.profileId);
        setIdentificationResult({
          speakerName: matchedSpeaker?.name || 'Unknown',
          profileId: data.identifiedProfile.profileId,
          score: data.identifiedProfile.score ?? 0,
        });
      } else {
        setError('Could not identify the speaker. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed');
    } finally {
      setIsIdentifying(false);
    }
  }, [speakers, identifyRecorder]);

  // ─── Delete ───────────────────────────────────────────────
  const handleDeleteSpeaker = useCallback(async (index: number) => {
    const speaker = speakers[index];
    try {
      await fetch(`${API_BASE}/api/speaker/profiles/${encodeURIComponent(speaker.profileId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Remove locally even if cloud delete fails
    }
    setSpeakers((prev) => prev.filter((_, i) => i !== index));
  }, [speakers]);

  const handleClear = async () => {
    for (const speaker of speakers) {
      try {
        await fetch(`${API_BASE}/api/speaker/profiles/${encodeURIComponent(speaker.profileId)}`, {
          method: 'DELETE',
        });
      } catch {
        // ignore cleanup errors
      }
    }
    setSpeakers([]);
    setIdentificationResult(null);
    setEnrollStatus('');
    setError(null);
  };

  const enrolledCount = speakers.filter((s) => s.enrollmentStatus.toLowerCase() === 'enrolled').length;
  const isRecording = enrollRecorder.isRecording || identifyRecorder.isRecording;

  return (
    <>
      <p className="demo-hint">
        Enroll speakers by recording voice samples, then identify who is speaking.
        Each speaker needs ~20 seconds of speech for enrollment.
      </p>

      {/* Add Speaker */}
      <div className="demo-input-group">
        <div className="demo-actions" style={{ alignItems: 'stretch' }}>
          <input
            className="demo-textarea"
            style={{ minHeight: 'auto', height: 48, resize: 'none', flex: 2 }}
            value={newSpeakerName}
            onChange={(e) => setNewSpeakerName(e.target.value)}
            placeholder="Enter speaker name…"
            disabled={isRecording || busy}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSpeaker()}
          />
          <button
            className="action-btn action-btn-primary"
            onClick={handleAddSpeaker}
            type="button"
            disabled={!newSpeakerName.trim() || isRecording || busy}
            style={{ flex: 1 }}
          >
            Add Speaker
          </button>
        </div>
      </div>

      {/* Speaker List */}
      {speakers.length > 0 && (
        <div className="demo-output">
          <div className="output-header">
            <h2 className="output-title">Speakers ({speakers.length})</h2>
            <button className="output-clear-btn" onClick={handleClear} type="button">
              Clear All
            </button>
          </div>
          <div className="speaker-list">
            {speakers.map((speaker, index) => (
              <div key={speaker.profileId} className="speaker-card">
                <div className="speaker-info">
                  <span className="speaker-name">{speaker.name}</span>
                  <span className={`speaker-status ${speaker.enrollmentStatus.toLowerCase() === 'enrolled' ? 'speaker-enrolled' : 'speaker-pending'}`}>
                    {speaker.enrollmentStatus.toLowerCase() === 'enrolled'
                      ? 'Enrolled'
                      : `~${Math.ceil(speaker.remainingEnrollmentsSpeechLength)}s more needed`}
                  </span>
                </div>
                <div className="speaker-actions">
                  {enrollRecorder.isRecording && enrollingIndex === index ? (
                    <button
                      className="action-btn action-btn-primary"
                      style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.875rem' }}
                      onClick={handleStopEnroll}
                      type="button"
                    >
                      Stop Recording
                    </button>
                  ) : (
                    <button
                      className="action-btn action-btn-secondary"
                      style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.875rem' }}
                      onClick={() => handleStartEnroll(index)}
                      type="button"
                      disabled={isRecording || busy || speaker.enrollmentStatus.toLowerCase() === 'enrolled'}
                    >
                      {speaker.enrollmentStatus.toLowerCase() === 'enrolled' ? 'Done' : 'Enroll'}
                    </button>
                  )}
                  <button
                    className="action-btn action-btn-secondary"
                    style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.875rem', color: '#c62828' }}
                    onClick={() => handleDeleteSpeaker(index)}
                    type="button"
                    disabled={isRecording || busy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enrollStatus && (
        <p className="demo-hint" style={{ marginTop: 12, fontWeight: 500 }}>{enrollStatus}</p>
      )}

      {error && <p className="demo-error">{error}</p>}

      {/* Identify Button */}
      <div className="demo-mic-section" style={{ marginTop: 16 }}>
        {identifyRecorder.isRecording ? (
          <button
            className="mic-btn mic-btn-active"
            onClick={handleStopIdentify}
            type="button"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop &amp; Identify
          </button>
        ) : (
          <button
            className={`mic-btn ${isIdentifying ? 'mic-btn-active' : ''}`}
            onClick={handleStartIdentify}
            type="button"
            disabled={isIdentifying || isRecording || enrolledCount < 1}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Identify Speaker
          </button>
        )}
      </div>

      {/* Result */}
      {identificationResult && (
        <div className="demo-output">
          <h2 className="output-title">Identification Result</h2>
          <div className="language-result">
            <span className="language-name">{identificationResult.speakerName}</span>
            <span className="language-code">
              Confidence: {(identificationResult.score * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default SpeakerRecognitionDemo;
