import { NETFLIX_PROFILES, WEBVTT_FMT } from '../adapter/netflix-profiles';
import type { RawManifestResult } from '../adapter/types';

function isProfilesArray(key: string, value: unknown[]): boolean {
  return key === 'profiles' || value.some((item) => NETFLIX_PROFILES.includes(item as string));
}

function findProfilesArray(obj: unknown): unknown[] | null {
  if (obj === null || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    if (Array.isArray(value) && isProfilesArray(key, value)) {
      return value;
    }
    if (typeof value === 'object') {
      const found = findProfilesArray(value);
      if (found) return found;
    }
  }
  return null;
}

export function injectWebvttProfile(value: unknown): unknown {
  const profiles = findProfilesArray(value);
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
