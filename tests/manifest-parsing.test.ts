import { describe, it, expect } from 'vitest';
import { injectWebvttProfile, extractManifestPayload } from '../src/content/manifest-parsing';

describe('injectWebvttProfile', () => {
  it('adds webvtt-lssdh-ios8 to a profiles array found by key name', () => {
    const value = { params: { profiles: ['heaac-2-dash', 'simplesdh'] } };
    injectWebvttProfile(value);
    expect(value.params.profiles).toContain('webvtt-lssdh-ios8');
  });

  it('finds a profiles array by content when the key is not literally "profiles"', () => {
    const value = { req: { renamedProfiles: ['dfxp-ls-sdh', 'BIF240'] } };
    injectWebvttProfile(value);
    expect(value.req.renamedProfiles).toContain('webvtt-lssdh-ios8');
  });

  it('does not add a duplicate if already present', () => {
    const value = { profiles: ['webvtt-lssdh-ios8', 'simplesdh'] };
    injectWebvttProfile(value);
    expect(value.profiles.filter((p) => p === 'webvtt-lssdh-ios8')).toHaveLength(1);
  });

  it('leaves the value unchanged when no profiles array exists', () => {
    const value = { unrelated: 'data' };
    const result = injectWebvttProfile(value);
    expect(result).toEqual({ unrelated: 'data' });
  });

  it('does not overflow on circular objects (Netflix stringifies cyclic app state)', () => {
    const value: Record<string, unknown> = { state: {} };
    (value.state as Record<string, unknown>).back = value; // cycle
    expect(() => injectWebvttProfile(value)).not.toThrow();
  });

  it('still finds a profiles array in an object that also contains a cycle', () => {
    const value: Record<string, unknown> = { profiles: ['simplesdh'] };
    value.self = value; // cycle alongside the real payload
    injectWebvttProfile(value);
    expect(value.profiles).toContain('webvtt-lssdh-ios8');
  });
});

describe('extractManifestPayload', () => {
  it('extracts movieId and textTracks when present', () => {
    const value = { result: { movieId: 12345, textTracks: [{ id: 't1' }] } };
    expect(extractManifestPayload(value)).toEqual({ movieId: 12345, textTracks: [{ id: 't1' }] });
  });

  it('returns null when result is missing', () => {
    expect(extractManifestPayload({ somethingElse: true })).toBeNull();
  });

  it('returns null when textTracks is missing', () => {
    expect(extractManifestPayload({ result: { movieId: 1 } })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(extractManifestPayload(null)).toBeNull();
    expect(extractManifestPayload('string')).toBeNull();
  });
});
