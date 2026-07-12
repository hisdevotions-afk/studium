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

  it('mounts playback controls after attach', () => {
    expect(document.querySelector('#sla-copilot-controls .sla-copilot-speed')).not.toBeNull();
    expect(document.querySelector('#sla-copilot-controls .sla-copilot-repeat')).not.toBeNull();
  });

  it('renders clean clickable tokens on cuechange and pauses + pops up on click', async () => {
    const targetTrackElem = video.querySelectorAll('track')[0]!;
    Object.defineProperty(targetTrackElem.track, 'activeCues', {
      value: [{ text: '<c.white>BE INTO SOMEONE</c.white>', startTime: 8.5, endTime: 10.5 }],
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

    const resumeBtn = document.querySelector('.sla-copilot-popup-resume') as HTMLElement;
    expect(resumeBtn.textContent).toBe('continuar ▶');
    resumeBtn.click();

    expect(video.play).toHaveBeenCalled();
    expect(document.querySelector('#sla-copilot-popup-container .sla-copilot-popup')).toBeNull();
  });

  it('hides Netflix native subtitles while attached', () => {
    const style = document.getElementById('sla-copilot-hide-native');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('.player-timedtext');
  });

  it('does not flicker native subtitles when switching between two titles that both have a valid target track', async () => {
    // Sanity: hidden from the previous title's successful attach.
    const styleBefore = document.getElementById('sla-copilot-hide-native');
    expect(styleBefore).not.toBeNull();

    // Switch to a different title that also has a usable target track.
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'sla-copilot:tracks', movieId: 55555,
        textTracks: [track('en2', 'en', 'English'), track('pt2', 'pt-BR', 'Português')],
      },
      source: window,
    }));
    await vi.advanceTimersByTimeAsync(1100);

    const styleAfter = document.getElementById('sla-copilot-hide-native');
    expect(styleAfter).not.toBeNull();
    // setNativeSubtitlesHidden(false) is a no-op once already hidden, but if
    // handleTracks called unhide unconditionally (the round-2 regression),
    // the tag would be removed and a fresh one recreated at the end of
    // tryAttach — a different DOM node. Same node proves it was never
    // removed, i.e. no flicker.
    expect(styleAfter).toBe(styleBefore);
  });

  it('unhides native subtitles when switching to a title with no usable target track', async () => {
    // Sanity: still hidden from the previous title's successful attach.
    expect(document.getElementById('sla-copilot-hide-native')).not.toBeNull();

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'sla-copilot:tracks', movieId: 88888,
        textTracks: [track('fr1', 'fr', 'Français')], // no en/it/pt track usable
      },
      source: window,
    }));
    await vi.advanceTimersByTimeAsync(1100);

    expect(document.getElementById('sla-copilot-hide-native')).toBeNull();
  });

  it('unhides native subtitles on leaving /watch, isolated from the no-target guard', async () => {
    // Re-hide by re-sending the original (usable) tracks and letting it attach.
    sendTracks();
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.getElementById('sla-copilot-hide-native')).not.toBeNull();

    // Reach "hide-style present + attachedVideo null" WITHOUT going through
    // the no-target branch (which now unhides on its own and would make this
    // test pass regardless of the leave-/watch guard). Instead, pull the
    // <video> out from under a subsequent *valid*-target tracks message:
    // handleTracks unconditionally nulls attachedVideo, then tryAttach's
    // querySelector('video') finds nothing and bails before it ever hides or
    // unhides anything. Style tag is left exactly as it was: present.
    video.remove();
    sendTracks();
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.getElementById('sla-copilot-hide-native')).not.toBeNull();

    // Now leave /watch entirely with attachedVideo already null.
    window.history.pushState({}, '', '/browse');
    await vi.advanceTimersByTimeAsync(1100);

    expect(document.getElementById('sla-copilot-hide-native')).toBeNull();

    document.body.appendChild(video);
    window.history.pushState({}, '', '/watch/99999');
  });
});
