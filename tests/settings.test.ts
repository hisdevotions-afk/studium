import { describe, it, expect, beforeEach } from 'vitest';
import { isEnabled, setEnabled, getLanguages, setLanguages } from '../src/lookup/settings';

describe('settings enabled flag', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to enabled when never set', async () => {
    expect(await isEnabled()).toBe(true);
  });

  it('persists off and back on', async () => {
    await setEnabled(false);
    expect(await isEnabled()).toBe(false);
    await setEnabled(true);
    expect(await isEnabled()).toBe(true);
  });
});

describe('settings languages', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to pt native + en target', async () => {
    expect(await getLanguages()).toEqual({ native: 'pt', target: 'en' });
  });

  it('persists chosen languages', async () => {
    await setLanguages('es', 'it');
    expect(await getLanguages()).toEqual({ native: 'es', target: 'it' });
  });
});
