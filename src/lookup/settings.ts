// On/off switch for the whole overlay. Stored in chrome.storage.local (shared
// between the toolbar popup that writes it and the content script that reads +
// reacts via chrome.storage.onChanged); localStorage fallback for the harness.
export const ENABLED_KEY = 'sla-copilot-enabled';

const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function isEnabled(): Promise<boolean> {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(ENABLED_KEY);
    return data[ENABLED_KEY] !== false; // default on
  }
  return localStorage.getItem(ENABLED_KEY) !== 'false';
}

export async function setEnabled(enabled: boolean): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    return;
  }
  localStorage.setItem(ENABLED_KEY, String(enabled));
}
