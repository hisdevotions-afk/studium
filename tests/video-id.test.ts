import { describe, it, expect } from 'vitest';
import { readVideoIdFromDom } from '../src/content/video-id';

describe('readVideoIdFromDom', () => {
  it('reads a numeric video id from a data-videoid attribute', () => {
    document.body.innerHTML = '<div data-videoid="80192098"></div>';
    expect(readVideoIdFromDom(document)).toBe(80192098);
  });

  it('returns null when no element has data-videoid', () => {
    document.body.innerHTML = '<div></div>';
    expect(readVideoIdFromDom(document)).toBeNull();
  });

  it('returns null when the attribute is not a valid number', () => {
    document.body.innerHTML = '<div data-videoid="not-a-number"></div>';
    expect(readVideoIdFromDom(document)).toBeNull();
  });
});
