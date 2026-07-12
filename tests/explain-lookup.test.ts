import { describe, it, expect, vi } from 'vitest';
import { explainLookup } from '../src/lookup/explain-lookup';
import type { LookupPayload, Explanation } from '../src/adapter/types';

const samplePayload: LookupPayload = {
  videoId: 80192098,
  timestampBucket: 12.5,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt-BR',
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

  it('falls back when the backend responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const result = await explainLookup(samplePayload);
    expect(result.contextualExplanation).toBe('não consegui buscar isso agora.');
    vi.unstubAllGlobals();
  });

  it('falls back after 2.5s if the lookup hangs', async () => {
    vi.useFakeTimers();
    const never = () => new Promise<Explanation>(() => {});
    const pending = explainLookup(samplePayload, never);
    await vi.advanceTimersByTimeAsync(2600);
    const result = await pending;
    expect(result.contextualExplanation).toBe('não consegui buscar isso agora.');
    vi.useRealTimers();
  });
});
