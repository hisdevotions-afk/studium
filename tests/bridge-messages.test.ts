import { describe, it, expect } from 'vitest';
import { parseBridgeMessage } from '../src/content/bridge-messages';

function makeEvent(data: unknown, source: unknown): MessageEvent {
  return { data, source } as MessageEvent;
}

describe('parseBridgeMessage', () => {
  it('parses a valid tracks message from the expected window', () => {
    const msg = parseBridgeMessage(
      makeEvent({ type: 'sla-copilot:tracks', movieId: 42, textTracks: [] }, window),
      window
    );
    expect(msg).toEqual({ type: 'sla-copilot:tracks', movieId: 42, textTracks: [] });
  });

  it('parses a valid videoid message', () => {
    const msg = parseBridgeMessage(makeEvent({ type: 'sla-copilot:videoid', videoId: 7 }, window), window);
    expect(msg).toEqual({ type: 'sla-copilot:videoid', videoId: 7 });
  });

  it('rejects a message from an unexpected source', () => {
    const otherWindow = {} as Window;
    const msg = parseBridgeMessage(makeEvent({ type: 'sla-copilot:videoid', videoId: 7 }, otherWindow), window);
    expect(msg).toBeNull();
  });

  it('rejects a message with an unknown type', () => {
    const msg = parseBridgeMessage(makeEvent({ type: 'other:thing' }, window), window);
    expect(msg).toBeNull();
  });

  it('rejects malformed data', () => {
    expect(parseBridgeMessage(makeEvent(null, window), window)).toBeNull();
    expect(parseBridgeMessage(makeEvent('a string', window), window)).toBeNull();
  });
});
