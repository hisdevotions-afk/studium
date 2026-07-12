import { describe, it, expect, vi } from 'vitest';
import { explainLookup } from '../src/lookup/explain-lookup';
import type { LookupPayload, Explanation } from '../src/adapter/types';

const samplePayload: LookupPayload = {
  videoId: 80192098,
  timestampBucket: 12.5,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt',
};

describe('explainLookup', () => {
  it('POSTs the payload to the backend and returns its Explanation', async () => {
    const backend: Explanation = {
      translation: 'a fim de',
      contextualExplanation: 'aqui "into" indica interesse por alguém.',
      isIdiom: true,
      morphologyNote: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(backend) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await explainLookup(samplePayload);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/lookup');
    expect(JSON.parse(opts.body)).toMatchObject({ clickedSpan: 'into' });
    expect(result).toEqual(backend);
    vi.unstubAllGlobals();
  });

  it('routes through the background worker when chrome.runtime exists', async () => {
    const data: Explanation = {
      translation: 'a fim de',
      contextualExplanation: 'via worker',
      isIdiom: true,
      morphologyNote: null,
    };
    const sendMessage = vi.fn((_msg: unknown, cb: (r: unknown) => void) => cb({ ok: true, data }));
    vi.stubGlobal('chrome', { runtime: { sendMessage, lastError: undefined } });

    const result = await explainLookup(samplePayload);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect((sendMessage.mock.calls[0]![0] as { type: string }).type).toBe('sla-copilot:lookup');
    expect(result).toEqual(data);
    vi.unstubAllGlobals();
  });

  it('falls back when the backend responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const result = await explainLookup(samplePayload);
    expect(result.contextualExplanation).toBe('não consegui buscar isso agora.');
    vi.unstubAllGlobals();
  });

  it('falls back after the timeout if the lookup hangs', async () => {
    vi.useFakeTimers();
    const never = () => new Promise<Explanation>(() => {});
    const pending = explainLookup(samplePayload, never);
    await vi.advanceTimersByTimeAsync(6100);
    const result = await pending;
    expect(result.contextualExplanation).toBe('não consegui buscar isso agora.');
    vi.useRealTimers();
  });
});
