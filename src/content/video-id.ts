export function readVideoIdFromDom(doc: Document): number | null {
  const elem = doc.querySelector('*[data-videoid]');
  if (!elem) return null;
  const raw = (elem as HTMLElement).dataset.videoid;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
