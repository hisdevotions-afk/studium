import type { LookupPayload, Explanation } from '../adapter/types';

export function renderPopup(container: HTMLElement, payload: LookupPayload, explanation: Explanation): HTMLElement {
  container.innerHTML = '';
  const popup = document.createElement('div');
  popup.className = 'sla-copilot-popup';
  popup.style.cssText =
    'display: inline-block; pointer-events: auto; background: rgba(0,0,0,0.9); color: #fff; padding: 12px 16px; border-radius: 8px; max-width: 60vw; text-align: left;';

  const wordElem = document.createElement('div');
  wordElem.className = 'sla-copilot-popup-word';
  wordElem.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
  wordElem.textContent = payload.clickedSpan;

  const explanationElem = document.createElement('div');
  explanationElem.className = 'sla-copilot-popup-explanation';
  explanationElem.style.cssText = 'margin-bottom: 8px;';
  explanationElem.textContent = explanation.contextualExplanation;

  const saveButton = document.createElement('button');
  saveButton.className = 'sla-copilot-popup-save';
  saveButton.style.cssText = 'cursor: pointer; padding: 6px 12px; margin-top: 4px;';
  saveButton.textContent = 'salvar';

  popup.append(wordElem, explanationElem, saveButton);
  container.appendChild(popup);
  return popup;
}
