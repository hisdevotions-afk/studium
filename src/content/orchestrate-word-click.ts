import { explainLookup } from '../lookup/explain-lookup';
import { renderPopup } from '../overlay/popup';
import type { LookupPayload } from '../adapter/types';

export async function handleWordClick(
  video: HTMLVideoElement,
  popupContainer: HTMLElement,
  payload: LookupPayload
): Promise<void> {
  video.pause();
  const explanation = await explainLookup(payload);
  renderPopup(popupContainer, payload, explanation);
}
