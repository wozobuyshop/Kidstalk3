
export enum AppLanguage {
  ARABIC = 'ar',
  ENGLISH = 'en',
  FRENCH = 'fr'
}

export interface TranslationResult {
  originalText: string;
  detectedLanguage: string;
  translations: {
    en: string;
    ar: string;
    fr: string;
  };
}

export interface ReplyResult {
  childOriginalText: string;
  translatedReply: string;
  targetLanguage: string;
}

export interface AppState {
  uiLanguage: AppLanguage;
  darkMode: boolean;
  isRecording: boolean;
  replyTargetLanguage: AppLanguage | null;
  audioBlob: Blob | null;
  transcription: TranslationResult | null;
  replyResult: ReplyResult | null;
  isLoading: boolean;
  error: string | null;
}
