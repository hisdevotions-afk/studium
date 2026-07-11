import { describe, it, expect } from 'vitest';
import { renderControls } from '../src/overlay/controls';

function setup(cue: { start: number; end: number } | null = { start: 8.5, end: 12.0 }) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  renderControls(container, video, () => cue);
  return { container, video };
}

describe('renderControls', () => {
  it('speed button cycles playbackRate 1 → 1.25 → 1.5 → 0.75 → 1', () => {
    const { container, video } = setup();
    const btn = container.querySelector('.sla-copilot-speed') as HTMLElement;
    expect(btn.textContent).toBe('1x');
    btn.click();
    expect(video.playbackRate).toBe(1.25);
    expect(btn.textContent).toBe('1.25x');
    btn.click(); btn.click(); btn.click();
    expect(video.playbackRate).toBe(1);
    expect(btn.textContent).toBe('1x');
  });

  it('repetir loops currentTime back to cue start while active, stops when toggled off', () => {
    const { container, video } = setup();
    const btn = container.querySelector('.sla-copilot-repeat') as HTMLElement;
    btn.click(); // enable
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(8.5);
    btn.click(); // disable
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(12.3);
  });

  it('repetir does nothing when there is no current cue', () => {
    const { container, video } = setup(null);
    (container.querySelector('.sla-copilot-repeat') as HTMLElement).click();
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(12.3);
  });
});
