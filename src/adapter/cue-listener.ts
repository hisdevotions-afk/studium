import type { SubtitleTrack } from './types';

// WebVTT cue text carries inline markup — styling classes (<c.white>,
// <c.mono_sans>), emphasis (<i>, <b>), voice tags (<v Speaker>), karaoke
// timestamps (<00:00:05.000>) — plus escaped entities (&amp;, &lt;). Netflix's
// English tracks are full of it; left in, it renders as literal garbage and
// pollutes the sentence we send to the LLM. Strip tags, then decode entities
// via a textarea (RCDATA: entities decode but tags never execute, so this is
// XSS-safe for untrusted subtitle text).
export function stripVttMarkup(text: string): string {
  const withoutTags = text.replace(/<[^>]+>/g, '');
  const decoder = document.createElement('textarea');
  decoder.innerHTML = withoutTags;
  return decoder.value;
}

export async function attachCueListener(
  video: HTMLVideoElement,
  track: SubtitleTrack,
  onCue: (cueText: string, startTime: number, endTime: number) => void
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
    const cue = activeCues[0] as unknown as { text: string; startTime: number; endTime: number };
    onCue(stripVttMarkup(cue.text), cue.startTime, cue.endTime);
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
