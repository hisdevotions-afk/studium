import { describe, it, expect } from 'vitest';
import { extractUsableTracks, selectTracks } from '../src/adapter/track-selection';
import type { RawNetflixTrack } from '../src/adapter/types';
import fixture from './fixtures/manifest-sample.json';

describe('extractUsableTracks', () => {
  it('extracts every track that has a webvtt downloadable', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    expect(tracks.map((t) => t.language)).toEqual(['en', 'it', 'pt-BR']);
  });

  it('drops forced-narrative and none tracks', () => {
    const raw: RawNetflixTrack[] = [
      {
        id: 'forced',
        language: 'en',
        languageDescription: 'English [Forced]',
        isForcedNarrative: true,
        isNoneTrack: false,
        rawTrackType: 'subtitles',
        downloadables: { 'webvtt-lssdh-ios8': { urls: [{ url: 'https://x/forced.vtt' }] } },
      },
      {
        id: 'none',
        language: 'none',
        languageDescription: 'Off',
        isForcedNarrative: false,
        isNoneTrack: true,
        rawTrackType: 'subtitles',
      },
    ];
    expect(extractUsableTracks(raw)).toEqual([]);
  });

  it('drops tracks without a webvtt downloadable', () => {
    const raw: RawNetflixTrack[] = [
      {
        id: 'ttml-only',
        language: 'fr',
        languageDescription: 'French',
        isForcedNarrative: false,
        isNoneTrack: false,
        rawTrackType: 'subtitles',
        downloadables: { 'dfxp-ls-sdh': { urls: [{ url: 'https://x/fr.dfxp' }] } },
      },
    ];
    expect(extractUsableTracks(raw)).toEqual([]);
  });
});

describe('selectTracks', () => {
  it('prefers English over Italian when both are available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    const selected = selectTracks(tracks);
    expect(selected.target?.language).toBe('en');
    expect(selected.native?.language).toBe('pt-BR');
  });

  it('falls back to Italian when English is unavailable', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter((t) => t.language !== 'en');
    expect(selectTracks(tracks).target?.language).toBe('it');
  });

  it('returns a null target when neither English nor Italian is available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter(
      (t) => t.language !== 'en' && t.language !== 'it'
    );
    expect(selectTracks(tracks).target).toBeNull();
  });

  it('returns a null native track when no Portuguese track is available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter((t) => t.language !== 'pt-BR');
    expect(selectTracks(tracks).native).toBeNull();
  });
});
