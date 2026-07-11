import { injectWebvttProfile, extractManifestPayload } from './manifest-parsing';
import { readVideoIdFromDom } from './video-id';

const POLL_INTERVAL_MS = 500;

// These hooks sit inside Netflix's own JSON calls: any exception we leak
// breaks their caller and can hang the player on boot. Our side-channel work
// is best-effort — swallow our failures, always defer to the original.
const originalStringify = JSON.stringify;
JSON.stringify = function stringify(this: any, ...args: Parameters<typeof JSON.stringify>) {
  try {
    if (args[0] !== undefined) {
      injectWebvttProfile(args[0]);
    }
  } catch {
    // ignore: worst case this request just doesn't get the WebVTT profile
  }
  return originalStringify.apply(this, args);
} as typeof JSON.stringify;

const originalParse = JSON.parse;
JSON.parse = function parse(this: any, ...args: Parameters<typeof JSON.parse>) {
  const value = originalParse.apply(this, args);
  try {
    const manifest = extractManifestPayload(value);
    if (manifest) {
      window.postMessage(
        { type: 'sla-copilot:tracks', movieId: manifest.movieId, textTracks: manifest.textTracks },
        window.location.origin
      );
    }
  } catch {
    // ignore: worst case we miss one manifest broadcast
  }
  return value;
} as typeof JSON.parse;

let lastVideoId: number | null = null;
function pollVideoId(): void {
  const videoId = readVideoIdFromDom(document);
  if (videoId !== lastVideoId) {
    lastVideoId = videoId;
    window.postMessage({ type: 'sla-copilot:videoid', videoId }, window.location.origin);
  }
}
pollVideoId();
setInterval(pollVideoId, POLL_INTERVAL_MS);
