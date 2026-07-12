import type { LookupPayload, Explanation } from '../adapter/types';

export function renderPopup(
  container: HTMLElement,
  payload: LookupPayload,
  explanation: Explanation,
  onResume: () => void,
  onSave: () => Promise<void>,
  onClose: () => void = () => {}
): HTMLElement {
  container.innerHTML = '';
  const popup = document.createElement('div');
  popup.className = 'sla-copilot-popup';
  popup.style.cssText =
    'position: relative; display: inline-block; pointer-events: auto; background: rgba(0,0,0,0.9); color: #fff; padding: 12px 32px 12px 16px; border-radius: 8px; max-width: 60vw; text-align: left;';

  const closeButton = document.createElement('button');
  closeButton.className = 'sla-copilot-popup-close';
  closeButton.style.cssText =
    'position: absolute; top: 6px; right: 8px; cursor: pointer; pointer-events: auto; background: transparent; border: none; color: #fff; font-size: 16px; line-height: 1; padding: 0;';
  closeButton.setAttribute('aria-label', 'fechar');
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', onClose);

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
  saveButton.addEventListener('click', () => {
    void onSave().then(() => {
      saveButton.textContent = 'salvo ✓';
      saveButton.disabled = true;
    });
  });

  const resumeButton = document.createElement('button');
  resumeButton.className = 'sla-copilot-popup-resume';
  resumeButton.style.cssText = 'cursor: pointer; padding: 6px 12px; margin-top: 4px; margin-left: 8px;';
  resumeButton.textContent = 'continuar ▶';
  resumeButton.addEventListener('click', onResume);

  popup.append(closeButton, wordElem, explanationElem, saveButton, resumeButton);
  container.appendChild(popup);
  return popup;
}
