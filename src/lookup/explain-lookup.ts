import type { LookupPayload, Explanation } from '../adapter/types';

export function explainLookup(payload: LookupPayload): Promise<Explanation> {
  return Promise.resolve({
    translation: payload.clickedSpan,
    contextualExplanation: `(stub) explicação de "${payload.clickedSpan}" ainda não conectada ao backend.`,
    isIdiom: false,
    morphologyNote: null,
  });
}
