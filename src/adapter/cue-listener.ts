import type { SubtitleTrack } from './types';

export function attachCueListener(
  video: HTMLVideoElement,
  track: SubtitleTrack,
  onCue: (cueText: string, startTime: number) => void
): HTMLTrackElement {
  const trackElem = document.createElement('track');
  trackElem.kind = 'subtitles';
  trackElem.src = track.webvttUrl;
  trackElem.srclang = track.language;
  trackElem.label = track.languageDescription;
  video.appendChild(trackElem);
  trackElem.track.mode = 'hidden';

  trackElem.addEventListener('cuechange', () => {
    const activeCues = trackElem.track.activeCues;
    if (!activeCues || activeCues.length === 0) return;
    const cue = activeCues[0] as unknown as { text: string; startTime: number };
    onCue(cue.text, cue.startTime);
  });

  return trackElem;
}
