import type { LookupPayload, Explanation } from '../adapter/types';

export function renderPopup(container: HTMLElement, payload: LookupPayload, explanation: Explanation): HTMLElement {
  container.innerHTML = '';
  const popup = document.createElement('div');
  popup.className = 'sla-copilot-popup';

  const wordElem = document.createElement('div');
  wordElem.className = 'sla-copilot-popup-word';
  wordElem.textContent = payload.clickedSpan;

  const explanationElem = document.createElement('div');
  explanationElem.className = 'sla-copilot-popup-explanation';
  explanationElem.textContent = explanation.contextualExplanation;

  const saveButton = document.createElement('button');
  saveButton.className = 'sla-copilot-popup-save';
  saveButton.textContent = 'salvar';

  popup.append(wordElem, explanationElem, saveButton);
  container.appendChild(popup);
  return popup;
}
