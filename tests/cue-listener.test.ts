import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachCueListener } from '../src/adapter/cue-listener';
import type { SubtitleTrack } from '../src/adapter/types';

const sampleTrack: SubtitleTrack = {
  id: 'track-en',
  language: 'en',
  languageDescription: 'English',
  webvttUrl: 'https://ipv6-c140.oca.nflxvideo.net/en.vtt',
  isClosedCaptions: false,
};

describe('attachCueListener', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ text: () => Promise.resolve('WEBVTT\n\n00:00.000 --> 00:02.000\nhello') })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a hidden track element and appends it to the video', async () => {
    const video = document.createElement('video');
    const trackElem = await attachCueListener(video, sampleTrack, () => {});
    expect(trackElem.tagName).toBe('TRACK');
    expect(trackElem.srclang).toBe('en');
    expect(trackElem.track.mode).toBe('hidden');
    expect(video.contains(trackElem)).toBe(true);
  });

  it('fetches the WebVTT file itself and serves it via a blob URL, instead of pointing src at the cross-origin CDN URL directly', async () => {
    const video = document.createElement('video');
    const trackElem = await attachCueListener(video, sampleTrack, () => {});
    expect(fetch).toHaveBeenCalledWith(sampleTrack.webvttUrl);
    expect(trackElem.src).toMatch(/^blob:/);
    expect(trackElem.src).not.toBe(sampleTrack.webvttUrl);
  });

  it('leaves the track without a src when the fetch fails, instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS blocked')));
    const video = document.createElement('video');
    const trackElem = await attachCueListener(video, sampleTrack, () => {});
    expect(trackElem.src).toBe('');
    expect(video.contains(trackElem)).toBe(true);
  });

  it('calls onCue with the active cue text and start time on cuechange', async () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = await attachCueListener(video, sampleTrack, onCue);

    const fakeCue = { text: 'be into someone', startTime: 12.5, endTime: 15.0 };
    Object.defineProperty(trackElem.track, 'activeCues', {
      value: [fakeCue],
      configurable: true,
    });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).toHaveBeenCalledWith('be into someone', 12.5, 15.0);
  });

  it('strips WebVTT cue markup and decodes entities before passing text to onCue', async () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = await attachCueListener(video, sampleTrack, onCue);

    const fakeCue = {
      text: '<c.white><c.mono_sans>HEY, JIM &amp; PAM.</c.mono_sans></c.white>',
      startTime: 1.6,
      endTime: 3.2,
    };
    Object.defineProperty(trackElem.track, 'activeCues', { value: [fakeCue], configurable: true });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).toHaveBeenCalledWith('HEY, JIM & PAM.', 1.6, 3.2);
  });

  it('does not call onCue when there are no active cues', async () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = await attachCueListener(video, sampleTrack, onCue);

    Object.defineProperty(trackElem.track, 'activeCues', { value: [], configurable: true });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).not.toHaveBeenCalled();
  });
});
