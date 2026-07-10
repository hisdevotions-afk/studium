import { injectWebvttProfile, extractManifestPayload } from './manifest-parsing';
import { readVideoIdFromDom } from './video-id';

const POLL_INTERVAL_MS = 500;

const originalStringify = JSON.stringify;
JSON.stringify = function stringify(this: any, ...args: Parameters<typeof JSON.stringify>) {
  if (args[0] !== undefined) {
    injectWebvttProfile(args[0]);
  }
  return originalStringify.apply(this, args);
} as typeof JSON.stringify;

const originalParse = JSON.parse;
JSON.parse = function parse(this: any, ...args: Parameters<typeof JSON.parse>) {
  const value = originalParse.apply(this, args);
  const manifest = extractManifestPayload(value);
  if (manifest) {
    window.postMessage(
      { type: 'sla-copilot:tracks', movieId: manifest.movieId, textTracks: manifest.textTracks },
      window.location.origin
    );
  }
  return value;
} as typeof JSON.parse;

let lastVideoId: number | null = null;
setInterval(() => {
  const videoId = readVideoIdFromDom(document);
  if (videoId !== lastVideoId) {
    lastVideoId = videoId;
    window.postMessage({ type: 'sla-copilot:videoid', videoId }, window.location.origin);
  }
}, POLL_INTERVAL_MS);
