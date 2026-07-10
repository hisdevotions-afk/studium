import { describe, it, expect } from 'vitest';
import { tokenizeCueText } from '../src/overlay/tokenize';

describe('tokenizeCueText', () => {
  it('splits a sentence into words on whitespace', () => {
    expect(tokenizeCueText('be into someone')).toEqual(['be', 'into', 'someone']);
  });

  it('collapses multiple spaces', () => {
    expect(tokenizeCueText('hello   world')).toEqual(['hello', 'world']);
  });

  it('treats newlines (multi-line cues) as whitespace', () => {
    expect(tokenizeCueText('line one\nline two')).toEqual(['line', 'one', 'line', 'two']);
  });

  it('returns an empty array for empty or blank input', () => {
    expect(tokenizeCueText('')).toEqual([]);
    expect(tokenizeCueText('   ')).toEqual([]);
  });
});
