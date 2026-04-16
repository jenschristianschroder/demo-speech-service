import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FEATURES, SpeechFeature } from '../types';
import SpeechToTextDemo from './demos/SpeechToTextDemo';
import TextToSpeechDemo from './demos/TextToSpeechDemo';
import SpeechTranslationDemo from './demos/SpeechTranslationDemo';
import PronunciationDemo from './demos/PronunciationDemo';
import LanguageDetectionDemo from './demos/LanguageDetectionDemo';
import CaptioningDemo from './demos/CaptioningDemo';
import './DemoScreen.css';

const demoComponents: Record<SpeechFeature, React.FC> = {
  speechToText: SpeechToTextDemo,
  textToSpeech: TextToSpeechDemo,
  speechTranslation: SpeechTranslationDemo,
  pronunciationAssessment: PronunciationDemo,
  languageDetection: LanguageDetectionDemo,
  captioning: CaptioningDemo,
};

const DemoScreen: React.FC = () => {
  const { feature } = useParams<{ feature: string }>();
  const navigate = useNavigate();

  const featureId = feature as SpeechFeature;
  const featureInfo = FEATURES.find((f) => f.id === featureId);
  const DemoComponent = demoComponents[featureId];

  if (!featureInfo || !DemoComponent) {
    return (
      <div className="demo-screen">
        <div className="demo-nav">
          <button className="nav-btn" onClick={() => navigate('/features')} type="button">← Back</button>
        </div>
        <div className="demo-content kiosk-container">
          <p className="demo-error">Unknown feature: {feature}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-screen">
      <div className="demo-nav">
        <button className="nav-btn" onClick={() => navigate('/features')} type="button">← Back</button>
        <span className="demo-nav-title">{featureInfo.label}</span>
        <button className="nav-btn" onClick={() => navigate('/')} type="button">Home</button>
      </div>

      <div className="demo-content kiosk-container">
        <h1 className="demo-title">{featureInfo.label}</h1>
        <p className="demo-subtitle">{featureInfo.description}</p>

        <DemoComponent />
      </div>
    </div>
  );
};

export default DemoScreen;
