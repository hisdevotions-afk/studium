import { NETFLIX_PROFILES, WEBVTT_FMT } from '../adapter/netflix-profiles';
import type { RawManifestResult } from '../adapter/types';

function isProfilesArray(key: string, value: unknown[]): boolean {
  return key === 'profiles' || value.some((item) => NETFLIX_PROFILES.includes(item as string));
}

// `seen` guards against cycles: this walker runs inside the JSON.stringify
// hook on every object Netflix serializes, and app-state objects (unlike
// parsed JSON) can contain circular references — without the guard the
// recursion overflows the stack and the thrown RangeError breaks Netflix's
// own stringify call, hanging the player.
function findProfilesArray(obj: unknown, seen: WeakSet<object>): unknown[] | null {
  if (obj === null || typeof obj !== 'object') return null;
  if (seen.has(obj)) return null;
  seen.add(obj);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    if (Array.isArray(value) && isProfilesArray(key, value)) {
      return value;
    }
    if (typeof value === 'object') {
      const found = findProfilesArray(value, seen);
      if (found) return found;
    }
  }
  return null;
}

export function injectWebvttProfile(value: unknown): unknown {
  const profiles = findProfilesArray(value, new WeakSet());
  if (profiles && !profiles.includes(WEBVTT_FMT)) {
    profiles.unshift(WEBVTT_FMT);
  }
  return value;
}

export function extractManifestPayload(value: unknown): RawManifestResult | null {
  if (value === null || typeof value !== 'object') return null;
  const result = (value as Record<string, unknown>).result;
  if (
    result &&
    typeof result === 'object' &&
    typeof (result as Record<string, unknown>).movieId === 'number' &&
    Array.isArray((result as Record<string, unknown>).textTracks)
  ) {
    return result as unknown as RawManifestResult;
  }
  return null;
}
