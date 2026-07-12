import { explainLookup } from '../lookup/explain-lookup';
import { renderPopup } from '../overlay/popup';
import { saveVocabulary } from '../lookup/vocabulary';
import type { LookupPayload, Explanation } from '../adapter/types';

const LOADING: Explanation = {
  translation: '',
  contextualExplanation: 'buscando explicação…',
  isIdiom: false,
  morphologyNote: null,
};

export async function handleWordClick(
  video: HTMLVideoElement,
  popupContainer: HTMLElement,
  payload: LookupPayload
): Promise<void> {
  video.pause();

  let dismissed = false;
  const dismiss = (): void => {
    dismissed = true;
    popupContainer.innerHTML = '';
  };
  const onResume = (): void => {
    dismiss();
    void video.play();
  };
  const onSave = (): Promise<void> =>
    saveVocabulary({
      word: payload.clickedSpan,
      sentence: payload.sentence,
      videoId: payload.videoId,
      timestamp: payload.timestampBucket,
      targetLang: payload.targetLang,
      savedAt: new Date().toISOString(),
    });

  // Show the popup instantly so the paused video doesn't just look frozen while
  // the lookup runs; fill in the real explanation when it resolves.
  renderPopup(popupContainer, payload, LOADING, onResume, onSave, dismiss);
  const explanation = await explainLookup(payload);
  if (!dismissed) renderPopup(popupContainer, payload, explanation, onResume, onSave, dismiss);
}
