import { describe, it, expect, beforeEach } from 'vitest';
import { saveVocabulary, listVocabulary } from '../src/lookup/vocabulary';

const entry = {
  word: 'into', sentence: 'be into someone', videoId: 99999,
  timestamp: 8.5, targetLang: 'en' as const, savedAt: '2026-07-11T12:00:00.000Z',
};

describe('vocabulary', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', async () => {
    expect(await listVocabulary()).toEqual([]);
  });

  it('persists saved entries in order', async () => {
    await saveVocabulary(entry);
    await saveVocabulary({ ...entry, word: 'hey' });
    const all = await listVocabulary();
    expect(all).toHaveLength(2);
    expect(all[0]!.word).toBe('into');
    expect(all[1]!.word).toBe('hey');
  });
});
