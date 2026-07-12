import { WEBVTT_FMT } from './netflix-profiles';
import type { RawNetflixTrack, SubtitleTrack, SelectedTracks } from './types';

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

// target/native are the user's chosen study + native language codes (from the
// toolbar popup); we match by language prefix so 'pt' picks up 'pt-BR' etc.
export function selectTracks(
  tracks: SubtitleTrack[],
  targetPref: string = 'en',
  nativePref: string = 'pt'
): SelectedTracks {
  return {
    target: findByLanguagePrefix(tracks, targetPref),
    native: findByLanguagePrefix(tracks, nativePref),
  };
}
