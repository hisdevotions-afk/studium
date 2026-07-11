import { describe, it, expect } from 'vitest';
import { waitForVideoElement } from '../src/content/wait-for-video';

describe('waitForVideoElement', () => {
  it('resolves immediately when a video element already exists', async () => {
    document.body.innerHTML = '<video></video>';
    const video = await waitForVideoElement(document, 50, 10);
    expect(video).not.toBeNull();
    expect(video?.tagName).toBe('VIDEO');
  });

  it('resolves once a video element appears after a short delay', async () => {
    document.body.innerHTML = '';
    setTimeout(() => {
      document.body.innerHTML = '<video></video>';
    }, 20);
    const video = await waitForVideoElement(document, 200, 10);
    expect(video).not.toBeNull();
  });

  it('resolves null when no video element appears before the timeout', async () => {
    document.body.innerHTML = '';
    const video = await waitForVideoElement(document, 30, 10);
    expect(video).toBeNull();
  });
});
