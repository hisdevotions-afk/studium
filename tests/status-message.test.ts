import { describe, it, expect } from 'vitest';
import { renderStatusMessage } from '../src/overlay/status-message';

describe('renderStatusMessage', () => {
  it('renders the message text', () => {
    const container = document.createElement('div');
    renderStatusMessage(container, 'idioma não disponível para este título');
    expect(container.querySelector('.sla-copilot-status')?.textContent).toBe(
      'idioma não disponível para este título'
    );
  });

  it('clears previous content on re-render', () => {
    const container = document.createElement('div');
    renderStatusMessage(container, 'first');
    renderStatusMessage(container, 'second');
    expect(container.querySelectorAll('.sla-copilot-status')).toHaveLength(1);
    expect(container.textContent).toBe('second');
  });
});
