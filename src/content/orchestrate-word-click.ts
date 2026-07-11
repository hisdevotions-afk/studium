import { explainLookup } from '../lookup/explain-lookup';
import { renderPopup } from '../overlay/popup';
import { saveVocabulary } from '../lookup/vocabulary';
import type { LookupPayload } from '../adapter/types';

export async function handleWordClick(
  video: HTMLVideoElement,
  popupContainer: HTMLElement,
  payload: LookupPayload
): Promise<void> {
  video.pause();
  const explanation = await explainLookup(payload);
  renderPopup(
    popupContainer,
    payload,
    explanation,
    () => {
      popupContainer.innerHTML = '';
      void video.play();
    },
    () =>
      saveVocabulary({
        word: payload.clickedSpan,
        sentence: payload.sentence,
        videoId: payload.videoId,
        timestamp: payload.timestampBucket,
        targetLang: payload.targetLang,
        savedAt: new Date().toISOString(),
      })
  );
}
