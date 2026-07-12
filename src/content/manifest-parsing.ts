import { NETFLIX_PROFILES, WEBVTT_FMT } from '../adapter/netflix-profiles';
import type { RawManifestResult } from '../adapter/types';

function isProfilesArray(key: string, value: unknown[]): boolean {
  return key === 'profiles' || value.some((item) => NETFLIX_PROFILES.includes(item as string));
}

// `seen` guards against cycles, and the walk itself is iterative (an
// explicit stack, not JS recursion): this runs inside the JSON.stringify
// hook on every object Netflix serializes, and real app-state objects
// (unlike parsed JSON) can be both circular AND far deeper than any test
// fixture — a recursive walker overflows the JS call stack on that real
// data and the thrown RangeError breaks Netflix's own stringify call,
// hanging the player.
function findProfilesArray(obj: unknown, seen: WeakSet<object>): unknown[] | null {
  const stack: unknown[] = [obj];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const key of Object.keys(current as Record<string, unknown>)) {
      const value = (current as Record<string, unknown>)[key];
      if (Array.isArray(value) && isProfilesArray(key, value)) {
        return value;
      }
      if (typeof value === 'object') {
        stack.push(value);
      }
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
