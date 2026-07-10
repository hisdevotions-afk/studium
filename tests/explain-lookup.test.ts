import { describe, it, expect } from 'vitest';
import { explainLookup } from '../src/lookup/explain-lookup';
import type { LookupPayload } from '../src/adapter/types';

describe('explainLookup', () => {
  it('resolves a placeholder explanation without any network call', async () => {
    const payload: LookupPayload = {
      videoId: 80192098,
      timestampBucket: 12.5,
      sentence: 'be into someone',
      clickedSpan: 'into',
      targetLang: 'en',
      nativeLang: 'pt-BR',
    };
    const result = await explainLookup(payload);
    expect(result.translation).toBe('into');
    expect(result.contextualExplanation).toContain('into');
    expect(result.isIdiom).toBe(false);
    expect(result.morphologyNote).toBeNull();
  });
});
