import type { TargetLang } from '../adapter/types';

export interface VocabularyEntry {
  word: string;
  sentence: string;
  videoId: number;
  timestamp: number;
  targetLang: TargetLang;
  savedAt: string;
}

const KEY = 'sla-copilot-vocabulary';

// chrome.storage.local inside the real extension; localStorage in the
// harness page and in tests. Same shape either way: a single JSON array.
const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function listVocabulary(): Promise<VocabularyEntry[]> {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(KEY);
    return (data[KEY] as VocabularyEntry[]) ?? [];
  }
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

export async function saveVocabulary(entry: VocabularyEntry): Promise<void> {
  const all = [...(await listVocabulary()), entry];
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [KEY]: all });
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(all));
}
