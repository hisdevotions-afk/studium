import { beforeAll } from 'vitest';

beforeAll(() => {
  // Initialize TextTrack API for jsdom
  if (typeof window !== 'undefined' && !window.TextTrack) {
    // Create a minimal TextTrackCueList implementation
    class TextTrackCueList {
      private cues: Array<{ text: string; startTime: number }> = [];

      get length() {
        return this.cues.length;
      }

      constructor(cues?: Array<{ text: string; startTime: number }>) {
        if (cues) this.cues = cues;
      }

      [Symbol.iterator]() {
        return this.cues[Symbol.iterator]();
      }

      item(index: number) {
        return this.cues[index] || null;
      }
    }

    (window as any).TextTrackCueList = TextTrackCueList;

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
              activeCues: new TextTrackCueList(),
              cues: new TextTrackCueList(),
            };
          }
          return this._track;
        },
        configurable: true,
      });
    }
  }
});
