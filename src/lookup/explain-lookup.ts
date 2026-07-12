import type { LookupPayload, Explanation } from '../adapter/types';

const TIMEOUT_MS = 2500;
// ponytail: local dev backend; point this at the deployed URL later.
const LOOKUP_URL = 'http://localhost:8000/lookup';

// Flow 2.7: never block the UI on a slow backend.
const FALLBACK: Explanation = {
  translation: '',
  contextualExplanation: 'não consegui buscar isso agora.',
  isIdiom: false,
  morphologyNote: null,
};

async function fetchExplanation(payload: LookupPayload): Promise<Explanation> {
  const res = await fetch(LOOKUP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  return (await res.json()) as Explanation;
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
