import { describe, it, expect, vi } from 'vitest';
import { attachCueListener } from '../src/adapter/cue-listener';
import type { SubtitleTrack } from '../src/adapter/types';

const sampleTrack: SubtitleTrack = {
  id: 'track-en',
  language: 'en',
  languageDescription: 'English',
  webvttUrl: 'https://example.com/en.vtt',
  isClosedCaptions: false,
};

describe('attachCueListener', () => {
  it('creates a hidden track element with the track URL and appends it to the video', () => {
    const video = document.createElement('video');
    const trackElem = attachCueListener(video, sampleTrack, () => {});
    expect(trackElem.tagName).toBe('TRACK');
    expect(trackElem.src).toBe(sampleTrack.webvttUrl);
    expect(trackElem.srclang).toBe('en');
    expect(trackElem.track.mode).toBe('hidden');
    expect(video.contains(trackElem)).toBe(true);
  });

  it('calls onCue with the active cue text and start time on cuechange', () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = attachCueListener(video, sampleTrack, onCue);

    const fakeCue = { text: 'be into someone', startTime: 12.5 };
    Object.defineProperty(trackElem.track, 'activeCues', {
      value: [fakeCue],
      configurable: true,
    });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).toHaveBeenCalledWith('be into someone', 12.5);
  });

  it('does not call onCue when there are no active cues', () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = attachCueListener(video, sampleTrack, onCue);

    Object.defineProperty(trackElem.track, 'activeCues', { value: [], configurable: true });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).not.toHaveBeenCalled();
  });
});
