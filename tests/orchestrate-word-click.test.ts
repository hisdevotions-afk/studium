import { describe, it, expect, vi } from 'vitest';
import { handleWordClick } from '../src/content/orchestrate-word-click';
import type { LookupPayload } from '../src/adapter/types';

const payload: LookupPayload = {
  videoId: 1,
  timestampBucket: 12.5,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt-BR',
};

describe('handleWordClick', () => {
  it('pauses the video immediately and then renders the popup', async () => {
    const video = document.createElement('video');
    const pauseSpy = vi.spyOn(video, 'pause');
    const container = document.createElement('div');

    await handleWordClick(video, container, payload);

    expect(pauseSpy).toHaveBeenCalled();
    expect(container.querySelector('.sla-copilot-popup-word')?.textContent).toBe('into');
  });
});
