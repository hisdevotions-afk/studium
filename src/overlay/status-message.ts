export function renderStatusMessage(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const elem = document.createElement('div');
  elem.className = 'sla-copilot-status';
  elem.style.cssText =
    'display: inline-block; pointer-events: auto; color: #fff; text-shadow: 1px 1px 2px #000, -1px -1px 2px #000; font-size: 1.3vw; padding: 0 2px;';
  elem.textContent = message;
  container.appendChild(elem);
}
