import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWordClick } from '../src/content/orchestrate-word-click';
import { listVocabulary } from '../src/lookup/vocabulary';
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
  beforeEach(() => localStorage.clear());

  it('pauses the video immediately and then renders the popup', async () => {
    const video = document.createElement('video');
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {});
    const container = document.createElement('div');

    await handleWordClick(video, container, payload);

    expect(pauseSpy).toHaveBeenCalled();
    expect(container.querySelector('.sla-copilot-popup-word')?.textContent).toBe('into');
  });

  it('resumes playback and clears the popup when continuar is clicked', async () => {
    const video = document.createElement('video');
    vi.spyOn(video, 'pause').mockImplementation(() => {});
    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const container = document.createElement('div');

    await handleWordClick(video, container, payload);
    const resumeBtn = container.querySelector('.sla-copilot-popup-resume') as HTMLElement;
    resumeBtn.click();

    expect(playSpy).toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });

  it('saves the clicked word to vocabulary when salvar is clicked', async () => {
    const video = document.createElement('video');
    vi.spyOn(video, 'pause').mockImplementation(() => {});
    const container = document.createElement('div');

    await handleWordClick(video, container, payload);
    const saveBtn = container.querySelector('.sla-copilot-popup-save') as HTMLElement;
    saveBtn.click();
    await Promise.resolve();

    const all = await listVocabulary();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      word: 'into',
      sentence: 'be into someone',
      videoId: 1,
      timestamp: 12.5,
      targetLang: 'en',
    });
  });
});
