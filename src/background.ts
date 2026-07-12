import type { Explanation, LookupPayload } from './adapter/types';

// MV3: content scripts fetch as the page origin (netflix.com) and are blocked
// from reaching http://localhost by same-origin + Private Network Access. The
// service worker isn't — with host_permissions it can call the local backend.
// So the content script messages us and we do the fetch.
const LOOKUP_URL = 'http://localhost:8000/lookup';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'sla-copilot:lookup') return undefined;
  fetch(LOOKUP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message.payload as LookupPayload),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`lookup ${res.status}`))))
    .then((data: Explanation) => sendResponse({ ok: true, data }))
    .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the channel open for the async sendResponse
});
