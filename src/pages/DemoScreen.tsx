import React from 'react';
import { useParams } from 'react-router-dom';
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

  const featureId = feature as SpeechFeature;
  const featureInfo = FEATURES.find((f) => f.id === featureId);
  const DemoComponent = demoComponents[featureId];

  if (!featureInfo || !DemoComponent) {
    return (
      <div className="demo-screen">
        <div className="demo-content kiosk-container">
          <p className="demo-error">Unknown feature: {feature}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-screen">
      <div className="demo-content kiosk-container">
        <h1 className="demo-title">{featureInfo.label}</h1>
        <p className="demo-subtitle">{featureInfo.description}</p>

        <DemoComponent />
      </div>
    </div>
  );
};

export default DemoScreen;
