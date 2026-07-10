import { describe, it, expect, vi } from 'vitest';
import { renderOverlayLine } from '../src/overlay/overlay';

describe('renderOverlayLine', () => {
  it('renders one clickable span per token', () => {
    const container = document.createElement('div');
    renderOverlayLine(container, 'be into someone', () => {});
    const spans = container.querySelectorAll('span.sla-copilot-token');
    expect(spans).toHaveLength(3);
    expect(spans[1].textContent).toBe('into');
  });

  it('calls onTokenClick with the clicked token and full sentence', () => {
    const container = document.createElement('div');
    const onTokenClick = vi.fn();
    renderOverlayLine(container, 'be into someone', onTokenClick);
    const spans = container.querySelectorAll('span.sla-copilot-token');
    (spans[1] as HTMLElement).click();
    expect(onTokenClick).toHaveBeenCalledWith('into', 'be into someone');
  });

  it('clears previous content on re-render', () => {
    const container = document.createElement('div');
    renderOverlayLine(container, 'first line', () => {});
    renderOverlayLine(container, 'second', () => {});
    expect(container.querySelectorAll('span.sla-copilot-token')).toHaveLength(1);
  });
});
