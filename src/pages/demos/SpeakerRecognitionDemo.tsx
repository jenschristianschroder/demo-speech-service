import React, { useState, useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getSpeechToken } from '../../services/speechToken';

interface EnrolledSpeaker {
  name: string;
  profileId: string;
  profile: SpeechSDK.VoiceProfile;
  enrollmentCount: number;
  remainingSeconds: number;
}

interface IdentificationResult {
  speakerName: string;
  profileId: string;
  score: number;
}

const SpeakerRecognitionDemo: React.FC = () => {
  const [speakers, setSpeakers] = useState<EnrolledSpeaker[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollingIndex, setEnrollingIndex] = useState<number | null>(null);
  const [enrollStatus, setEnrollStatus] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profileClientRef = useRef<SpeechSDK.VoiceProfileClient | null>(null);

  const getProfileClient = useCallback(async () => {
    const { token, region } = await getSpeechToken();
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    return new SpeechSDK.VoiceProfileClient(speechConfig);
  }, []);

  const handleAddSpeaker = useCallback(async () => {
    if (!newSpeakerName.trim()) return;
    try {
      setError(null);
      const client = await getProfileClient();
      profileClientRef.current = client;

      const profile = await new Promise<SpeechSDK.VoiceProfile>((resolve, reject) => {
        client.createProfileAsync(
          SpeechSDK.VoiceProfileType.TextIndependentIdentification,
          'en-US',
          (result) => resolve(result),
          (err) => reject(new Error(err)),
        );
      });

      setSpeakers((prev) => [
        ...prev,
        {
          name: newSpeakerName.trim(),
          profileId: profile.profileId,
          profile,
          enrollmentCount: 0,
          remainingSeconds: 20,
        },
      ]);
      setNewSpeakerName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create speaker profile');
    }
  }, [newSpeakerName, getProfileClient]);

  const handleEnroll = useCallback(async (index: number) => {
    try {
      setError(null);
      setIsEnrolling(true);
      setEnrollingIndex(index);
      setEnrollStatus('Recording… speak naturally for at least 20 seconds');

      const speaker = speakers[index];
      const client = await getProfileClient();
      profileClientRef.current = client;

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      const result = await new Promise<SpeechSDK.VoiceProfileEnrollmentResult>((resolve, reject) => {
        client.enrollProfileAsync(
          speaker.profile,
          audioConfig,
          (res) => resolve(res),
          (err) => reject(new Error(err)),
        );
      });

      if (result.reason === SpeechSDK.ResultReason.EnrolledVoiceProfile) {
        setSpeakers((prev) =>
          prev.map((s, i) =>
            i === index
              ? { ...s, enrollmentCount: s.enrollmentCount + 1, remainingSeconds: 0 }
              : s,
          ),
        );
        setEnrollStatus('Enrollment complete!');
      } else if (result.reason === SpeechSDK.ResultReason.EnrollingVoiceProfile) {
        const remaining = result.privDetails?.remainingEnrollmentsSpeechLength
          ?? (result as unknown as { enrollmentsLength?: number }).enrollmentsLength
          ?? 0;
        setSpeakers((prev) =>
          prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  enrollmentCount: s.enrollmentCount + 1,
                  remainingSeconds: Math.max(0, Math.ceil(remaining)),
                }
              : s,
          ),
        );
        setEnrollStatus(`More speech needed. Continue speaking…`);
      } else {
        setEnrollStatus('Enrollment failed. Try speaking longer.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setIsEnrolling(false);
      setEnrollingIndex(null);
    }
  }, [speakers, getProfileClient]);

  const handleIdentify = useCallback(async () => {
    const enrolledSpeakers = speakers.filter((s) => s.remainingSeconds === 0);
    if (enrolledSpeakers.length === 0) {
      setError('At least one fully enrolled speaker is required for identification.');
      return;
    }

    try {
      setError(null);
      setIdentificationResult(null);
      setIsIdentifying(true);

      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      const model = SpeechSDK.SpeakerIdentificationModel.fromProfiles(
        enrolledSpeakers.map((s) => s.profile),
      );

      const recognizer = new SpeechSDK.SpeakerRecognizer(speechConfig, audioConfig);

      const result = await new Promise<SpeechSDK.SpeakerRecognitionResult>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          model,
          (res) => {
            recognizer.close();
            resolve(res);
          },
          (err) => {
            recognizer.close();
            reject(new Error(err));
          },
        );
      });

      if (result.reason === SpeechSDK.ResultReason.RecognizedSpeakers || result.reason === SpeechSDK.ResultReason.RecognizedSpeaker) {
        const matchedId = result.profileId;
        const matchedSpeaker = speakers.find((s) => s.profileId === matchedId);
        setIdentificationResult({
          speakerName: matchedSpeaker?.name || 'Unknown',
          profileId: matchedId,
          score: result.score,
        });
      } else {
        setError('Could not identify the speaker. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed');
    } finally {
      setIsIdentifying(false);
    }
  }, [speakers]);

  const handleDeleteSpeaker = useCallback(async (index: number) => {
    try {
      const speaker = speakers[index];
      const client = await getProfileClient();
      await new Promise<SpeechSDK.VoiceProfileResult>((resolve, reject) => {
        client.deleteProfileAsync(
          speaker.profile,
          (res) => resolve(res),
          (err) => reject(new Error(err)),
        );
      });
      setSpeakers((prev) => prev.filter((_, i) => i !== index));
    } catch {
      // Remove locally even if cloud delete fails
      setSpeakers((prev) => prev.filter((_, i) => i !== index));
    }
  }, [speakers, getProfileClient]);

  const handleClear = async () => {
    // Delete all profiles
    for (const speaker of speakers) {
      try {
        const client = await getProfileClient();
        await new Promise<SpeechSDK.VoiceProfileResult>((resolve) => {
          client.deleteProfileAsync(speaker.profile, resolve, () => resolve({} as SpeechSDK.VoiceProfileResult));
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

  const enrolledCount = speakers.filter((s) => s.remainingSeconds === 0).length;

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
            disabled={isEnrolling || isIdentifying}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSpeaker()}
          />
          <button
            className="action-btn action-btn-primary"
            onClick={handleAddSpeaker}
            type="button"
            disabled={!newSpeakerName.trim() || isEnrolling || isIdentifying}
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
                  <span className={`speaker-status ${speaker.remainingSeconds === 0 ? 'speaker-enrolled' : 'speaker-pending'}`}>
                    {speaker.remainingSeconds === 0 ? 'Enrolled' : `~${speaker.remainingSeconds}s more needed`}
                  </span>
                </div>
                <div className="speaker-actions">
                  <button
                    className="action-btn action-btn-secondary"
                    style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.875rem' }}
                    onClick={() => handleEnroll(index)}
                    type="button"
                    disabled={isEnrolling || isIdentifying || speaker.remainingSeconds === 0}
                  >
                    {isEnrolling && enrollingIndex === index ? 'Recording…' : speaker.remainingSeconds === 0 ? 'Done' : 'Enroll'}
                  </button>
                  <button
                    className="action-btn action-btn-secondary"
                    style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.875rem', color: '#c62828' }}
                    onClick={() => handleDeleteSpeaker(index)}
                    type="button"
                    disabled={isEnrolling || isIdentifying}
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
        <button
          className={`mic-btn ${isIdentifying ? 'mic-btn-active' : ''}`}
          onClick={isIdentifying ? undefined : handleIdentify}
          type="button"
          disabled={isIdentifying || enrolledCount < 1}
        >
          {isIdentifying ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
          {isIdentifying ? 'Listening…' : 'Identify Speaker'}
        </button>
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
