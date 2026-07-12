import type { LookupPayload, Explanation } from '../adapter/types';

// Headroom over the ~1.5s LLM round-trip; the "buscando…" popup covers the wait
// and this only fires as a safety net if the backend truly hangs.
const TIMEOUT_MS = 6000;
// ponytail: local dev backend; point this at the deployed URL later.
const LOOKUP_URL = 'http://localhost:8000/lookup';

// Flow 2.7: never block the UI on a slow backend.
const FALLBACK: Explanation = {
  translation: '',
  contextualExplanation: 'não consegui buscar isso agora.',
  isIdiom: false,
  morphologyNote: null,
};

// In the real extension the fetch must run in the service worker (content-script
// fetch to localhost is blocked by MV3 + Private Network Access), so message it.
// Harness/tests have no chrome.runtime and fetch localhost directly.
async function fetchExplanation(payload: LookupPayload): Promise<Explanation> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise<Explanation>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'sla-copilot:lookup', payload }, (resp) => {
        if (chrome.runtime.lastError || !resp?.ok) {
          reject(new Error(resp?.error ?? chrome.runtime.lastError?.message ?? 'lookup failed'));
        } else {
          resolve(resp.data as Explanation);
        }
      });
    });
  }
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
