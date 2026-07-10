import type { RawNetflixTrack } from '../adapter/types';

export type BridgeMessage =
  | { type: 'sla-copilot:tracks'; movieId: number; textTracks: RawNetflixTrack[] }
  | { type: 'sla-copilot:videoid'; videoId: number | null };

export function parseBridgeMessage(event: MessageEvent, expectedWindow: Window): BridgeMessage | null {
  if (event.source !== expectedWindow) return null;
  const data = event.data;
  if (!data || typeof data !== 'object') return null;

  if (data.type === 'sla-copilot:tracks' && typeof data.movieId === 'number' && Array.isArray(data.textTracks)) {
    return { type: 'sla-copilot:tracks', movieId: data.movieId, textTracks: data.textTracks };
  }
  if (data.type === 'sla-copilot:videoid' && (typeof data.videoId === 'number' || data.videoId === null)) {
    return { type: 'sla-copilot:videoid', videoId: data.videoId };
  }
  return null;
}
