export function renderStatusMessage(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const elem = document.createElement('div');
  elem.className = 'sla-copilot-status';
  elem.textContent = message;
  container.appendChild(elem);
}
