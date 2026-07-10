export function tokenizeCueText(text: string): string[] {
  return text
    .replace(/\n/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}
