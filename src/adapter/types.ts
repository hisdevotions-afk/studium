export interface RawNetflixTrack {
  id: string;
  language: string;
  languageDescription: string;
  isForcedNarrative: boolean;
  isNoneTrack: boolean;
  rawTrackType: string;
  downloadables?: Record<string, { urls: { url: string }[] }>;
}

export interface RawManifestResult {
  movieId: number;
  textTracks: RawNetflixTrack[];
}

export interface SubtitleTrack {
  id: string;
  language: string;
  languageDescription: string;
  webvttUrl: string;
  isClosedCaptions: boolean;
}

export interface SelectedTracks {
  target: SubtitleTrack | null;
  native: SubtitleTrack | null;
}

export type TargetLang = 'en' | 'it';

export interface LookupPayload {
  videoId: number;
  timestampBucket: number;
  sentence: string;
  clickedSpan: string;
  targetLang: TargetLang;
  nativeLang: 'pt-BR';
}

export interface Explanation {
  translation: string;
  contextualExplanation: string;
  isIdiom: boolean;
  morphologyNote: string | null;
}
