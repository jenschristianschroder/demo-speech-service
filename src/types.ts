export type SpeechFeature =
  | 'speechToText'
  | 'textToSpeech'
  | 'speechTranslation'
  | 'pronunciationAssessment'
  | 'languageDetection'
  | 'captioning'
  | 'speakerRecognition';

export interface FeatureInfo {
  id: SpeechFeature;
  label: string;
  description: string;
}

export const FEATURES: FeatureInfo[] = [
  {
    id: 'speechToText',
    label: 'Speech to Text',
    description: 'Speak into the microphone and see live transcription',
  },
  {
    id: 'textToSpeech',
    label: 'Text to Speech',
    description: 'Type text and hear it spoken with neural voices',
  },
  {
    id: 'speechTranslation',
    label: 'Speech Translation',
    description: 'Speak in one language and see real-time translation',
  },
  {
    id: 'pronunciationAssessment',
    label: 'Pronunciation Assessment',
    description: 'Read a sentence aloud and get scored on pronunciation',
  },
  {
    id: 'languageDetection',
    label: 'Language Detection',
    description: 'Speak freely and detect which language is being spoken',
  },
  {
    id: 'captioning',
    label: 'Real-time Captioning',
    description: 'See live closed captions as you speak',
  },
  {
    id: 'speakerRecognition',
    label: 'Speaker Recognition',
    description: 'Enroll voices and identify who is speaking',
  },
];

export interface SpeechToken {
  token: string;
  region: string;
}
