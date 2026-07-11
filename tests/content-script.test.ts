// tests/content-script.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const VTT = 'WEBVTT\n\n00:00.000 --> 00:02.000\nhello';

const track = (id: string, language: string, desc: string) => ({
  id, language, languageDescription: desc,
  isForcedNarrative: false, isNoneTrack: false, rawTrackType: 'subtitles',
  downloadables: { 'webvtt-lssdh-ios8': { urls: [{ url: `https://cdn.test/${id}.vtt` }] } },
});

function sendTracks(): void {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      type: 'sla-copilot:tracks', movieId: 99999,
      textTracks: [track('en1', 'en', 'English'), track('pt1', 'pt-BR', 'Português')],
    },
    source: window,
  }));
}

describe('content-script wiring', () => {
  let video: HTMLVideoElement;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: () => Promise.resolve(VTT) }));
    window.history.pushState({}, '', '/watch/99999');
    video = document.createElement('video');
    video.pause = vi.fn();
    video.play = vi.fn().mockResolvedValue(undefined);
    document.body.appendChild(video);
    await import('../src/content/content-script');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('attaches both tracks to the video after a tracks message', async () => {
    sendTracks();
    await vi.advanceTimersByTimeAsync(1100);
    expect(video.querySelectorAll('track')).toHaveLength(2);
  });

  it('renders clean clickable tokens on cuechange and pauses + pops up on click', async () => {
    const targetTrackElem = video.querySelectorAll('track')[0]!;
    Object.defineProperty(targetTrackElem.track, 'activeCues', {
      value: [{ text: '<c.white>BE INTO SOMEONE</c.white>', startTime: 8.5 }],
      configurable: true,
    });
    targetTrackElem.dispatchEvent(new Event('cuechange'));

    const tokens = document.querySelectorAll('#sla-copilot-overlay .sla-copilot-token');
    expect([...tokens].map((t) => t.textContent)).toEqual(['BE', 'INTO', 'SOMEONE']);

    (tokens[1] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);

    expect(video.pause).toHaveBeenCalled();
    const popup = document.querySelector('#sla-copilot-popup-container .sla-copilot-popup');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('INTO');
  });
});
