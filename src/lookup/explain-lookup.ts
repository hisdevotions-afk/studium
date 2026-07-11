import type { LookupPayload, Explanation } from '../adapter/types';

const TIMEOUT_MS = 2500;

// Flow 2.7: never block the UI on a slow backend.
const FALLBACK: Explanation = {
  translation: '',
  contextualExplanation: 'não consegui buscar isso agora.',
  isIdiom: false,
  morphologyNote: null,
};

// ponytail: stub until the backend exists; the payload contract and the
// timeout behavior are the real deliverables here.
function fetchExplanation(payload: LookupPayload): Promise<Explanation> {
  return Promise.resolve({
    translation: payload.clickedSpan,
    contextualExplanation: `(stub) explicação de "${payload.clickedSpan}" ainda não conectada ao backend.`,
    isIdiom: false,
    morphologyNote: null,
  });
}

export function explainLookup(
  payload: LookupPayload,
  impl: (p: LookupPayload) => Promise<Explanation> = fetchExplanation
): Promise<Explanation> {
  return Promise.race([
    impl(payload).catch(() => FALLBACK),
    new Promise<Explanation>((resolve) => setTimeout(() => resolve(FALLBACK), TIMEOUT_MS)),
  ]);
}
