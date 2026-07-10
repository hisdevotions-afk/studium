import { WEBVTT_FMT } from './netflix-profiles';
import type { RawNetflixTrack, SubtitleTrack, SelectedTracks, TargetLang } from './types';

const TARGET_LANG_PREFERENCE: TargetLang[] = ['en', 'it'];

export function extractUsableTracks(rawTracks: RawNetflixTrack[]): SubtitleTrack[] {
  const usable: SubtitleTrack[] = [];
  for (const track of rawTracks) {
    if (track.isForcedNarrative || track.isNoneTrack) continue;
    if (!track.downloadables) continue;
    const webvtt = track.downloadables[WEBVTT_FMT];
    if (!webvtt || !webvtt.urls || !webvtt.urls[0] || !webvtt.urls[0].url) continue;

    usable.push({
      id: track.id,
      language: track.language,
      languageDescription: track.languageDescription,
      webvttUrl: webvtt.urls[0].url,
      isClosedCaptions: track.rawTrackType === 'closedcaptions',
    });
  }
  return usable;
}

function findByLanguagePrefix(tracks: SubtitleTrack[], prefix: string): SubtitleTrack | null {
  return tracks.find((t) => t.language.toLowerCase().startsWith(prefix)) ?? null;
}

export function selectTracks(tracks: SubtitleTrack[]): SelectedTracks {
  let target: SubtitleTrack | null = null;
  for (const lang of TARGET_LANG_PREFERENCE) {
    target = findByLanguagePrefix(tracks, lang);
    if (target) break;
  }
  return {
    target,
    native: findByLanguagePrefix(tracks, 'pt'),
  };
}
