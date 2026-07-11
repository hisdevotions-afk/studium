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
  it('resolves a placeholder explanation without any network call', async () => {
    const result = await explainLookup(samplePayload);
    expect(result.translation).toBe('into');
    expect(result.contextualExplanation).toContain('into');
    expect(result.isIdiom).toBe(false);
    expect(result.morphologyNote).toBeNull();
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
