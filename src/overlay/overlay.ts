import { tokenizeCueText } from './tokenize';

export function renderOverlayLine(
  container: HTMLElement,
  cueText: string,
  onTokenClick: (token: string, sentence: string) => void
): void {
  container.innerHTML = '';
  const tokens = tokenizeCueText(cueText);
  for (const token of tokens) {
    const span = document.createElement('span');
    span.className = 'sla-copilot-token';
    span.style.cssText =
      'cursor: pointer; pointer-events: auto; color: #fff; text-shadow: 1px 1px 2px #000, -1px -1px 2px #000; font-size: 1.3vw; padding: 0 2px;';
    span.textContent = token;
    span.addEventListener('click', () => onTokenClick(token, cueText));
    container.appendChild(span);
    container.appendChild(document.createTextNode(' '));
  }
}
