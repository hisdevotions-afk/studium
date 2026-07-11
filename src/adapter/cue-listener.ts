import type { SubtitleTrack } from './types';

export async function attachCueListener(
  video: HTMLVideoElement,
  track: SubtitleTrack,
  onCue: (cueText: string, startTime: number) => void
): Promise<HTMLTrackElement> {
  const trackElem = document.createElement('track');
  trackElem.kind = 'subtitles';
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

  // A native <track src="cross-origin-cdn-url"> is subject to normal page
  // CORS rules and fails to load against Netflix's CDN. Fetching it
  // ourselves (host_permissions lets this bypass CORS) and serving the
  // result via a blob: URL keeps the native cuechange timing engine while
  // sidestepping that restriction.
  try {
    const response = await fetch(track.webvttUrl);
    const vttText = await response.text();
    trackElem.src = URL.createObjectURL(new Blob([vttText], { type: 'text/vtt' }));
  } catch {
    // Network/CORS failure: this track simply produces no cues.
  }

  return trackElem;
}
