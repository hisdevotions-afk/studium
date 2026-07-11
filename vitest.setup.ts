import { beforeAll } from 'vitest';

// TextTrack polyfill for jsdom: provides HTMLTrackElement.track property
// jsdom 25's HTMLTrackElement implementation lacks real TextTrack/track support.
// This polyfill fills the gap by adding a track getter to HTMLTrackElement.prototype
// that returns a simple track object with activeCues and cues as plain arrays.
// This file runs before every test (via vitest.config.ts setupFiles), not just for
// cue-listener.test.ts — so changes here affect the entire test suite.

beforeAll(() => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL. A fake
  // "blob:<counter>" string is enough for tests that only check the src
  // was set to a blob URL, not that it's a real, resolvable resource.
  if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    URL.createObjectURL = () => `blob:mock-${++counter}`;
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = () => {};
  }

  if (typeof window !== 'undefined' && !window.TextTrack) {
    // Extend HTMLTrackElement to add track property
    const originalGetTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track');
    if (!originalGetTrack) {
      Object.defineProperty(HTMLTrackElement.prototype, 'track', {
        get() {
          if (!this._track) {
            this._track = {
              kind: this.kind || 'subtitles',
              label: this.label || '',
              language: this.srclang || '',
              mode: 'hidden',
              activeCues: [],
              cues: [],
            };
          }
          return this._track;
        },
        configurable: true,
      });
    }
  }
});
