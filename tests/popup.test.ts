import { describe, it, expect, vi } from 'vitest';
import { renderPopup } from '../src/overlay/popup';
import type { LookupPayload, Explanation } from '../src/adapter/types';

const payload: LookupPayload = {
  videoId: 1,
  timestampBucket: 0,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt-BR',
};

const explanation: Explanation = {
  translation: 'into',
  contextualExplanation: '(stub) explicação de "into"',
  isIdiom: false,
  morphologyNote: null,
};

describe('renderPopup', () => {
  it('renders the clicked word and explanation text', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation, () => {});
    expect(container.querySelector('.sla-copilot-popup-word')?.textContent).toBe('into');
    expect(container.querySelector('.sla-copilot-popup-explanation')?.textContent).toBe(
      '(stub) explicação de "into"'
    );
  });

  it('includes a save button', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation, () => {});
    expect(container.querySelector('.sla-copilot-popup-save')).not.toBeNull();
  });

  it('clears previous popup content on re-render', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation, () => {});
    renderPopup(container, payload, explanation, () => {});
    expect(container.querySelectorAll('.sla-copilot-popup')).toHaveLength(1);
  });

  it('renders a continuar button that fires onResume', () => {
    const container = document.createElement('div');
    const onResume = vi.fn();
    renderPopup(container, payload, explanation, onResume);
    const btn = container.querySelector('.sla-copilot-popup-resume') as HTMLElement;
    expect(btn.textContent).toBe('continuar ▶');
    btn.click();
    expect(onResume).toHaveBeenCalled();
  });
});
