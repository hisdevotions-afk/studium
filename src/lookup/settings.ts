import type { NativeLang, TargetLang } from '../adapter/types';

// Extension settings, stored in chrome.storage.local (shared between the
// toolbar popup that writes them and the content script that reads + reacts via
// chrome.storage.onChanged); localStorage fallback for the harness/tests.
export const ENABLED_KEY = 'sla-copilot-enabled';
export const NATIVE_LANG_KEY = 'sla-copilot-native-lang';
export const TARGET_LANG_KEY = 'sla-copilot-target-lang';

const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function getRaw(key: string): Promise<unknown> {
  if (hasChromeStorage()) return (await chrome.storage.local.get(key))[key];
  const v = localStorage.getItem(key);
  return v === null ? undefined : v;
}

async function setRaw(key: string, value: string): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function isEnabled(): Promise<boolean> {
  const v = await getRaw(ENABLED_KEY);
  return v !== false && v !== 'false'; // default on; chrome stores bool, localStorage string
}

export async function setEnabled(enabled: boolean): Promise<void> {
  // Keep a real boolean in chrome.storage so onChanged newValue is `false`.
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    return;
  }
  localStorage.setItem(ENABLED_KEY, String(enabled));
}

export async function getLanguages(): Promise<{ native: NativeLang; target: TargetLang }> {
  const native = (await getRaw(NATIVE_LANG_KEY)) as NativeLang | undefined;
  const target = (await getRaw(TARGET_LANG_KEY)) as TargetLang | undefined;
  return { native: native ?? 'pt', target: target ?? 'en' };
}

export async function setLanguages(native: NativeLang, target: TargetLang): Promise<void> {
  await setRaw(NATIVE_LANG_KEY, native);
  await setRaw(TARGET_LANG_KEY, target);
}
