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
  it('defaults to English target + Portuguese native', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    const selected = selectTracks(tracks);
    expect(selected.target?.language).toBe('en');
    expect(selected.native?.language).toBe('pt-BR');
  });

  it('picks the chosen study language by prefix', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    expect(selectTracks(tracks, 'it').target?.language).toBe('it');
  });

  it('returns a null target when the chosen study language is absent', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter(
      (t) => t.language !== 'en'
    );
    expect(selectTracks(tracks, 'en').target).toBeNull();
  });

  it('matches the chosen native language by prefix', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    expect(selectTracks(tracks, 'en', 'pt').native?.language).toBe('pt-BR');
    expect(selectTracks(tracks, 'en', 'en').native?.language).toBe('en');
  });

  it('returns a null native track when the chosen native language is absent', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter(
      (t) => t.language !== 'pt-BR'
    );
    expect(selectTracks(tracks, 'en', 'pt').native).toBeNull();
  });
});
