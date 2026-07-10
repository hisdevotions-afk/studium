import { parseBridgeMessage } from './bridge-messages';
import { extractUsableTracks, selectTracks } from '../adapter/track-selection';
import { attachCueListener } from '../adapter/cue-listener';
import { renderOverlayLine } from '../overlay/overlay';
import { renderStatusMessage } from '../overlay/status-message';
import { handleWordClick } from './orchestrate-word-click';
import type { RawNetflixTrack, LookupPayload } from '../adapter/types';

const OVERLAY_CONTAINER_ID = 'sla-copilot-overlay';
const POPUP_CONTAINER_ID = 'sla-copilot-popup-container';

function ensureContainer(id: string): HTMLElement {
  let elem = document.getElementById(id);
  if (!elem) {
    elem = document.createElement('div');
    elem.id = id;
    document.body.appendChild(elem);
  }
  return elem;
}

let currentVideoId: number | null = null;
let activeTrackElements: HTMLTrackElement[] = [];

function handleTracks(rawTracks: RawNetflixTrack[]): void {
  for (const trackElem of activeTrackElements) {
    trackElem.remove();
  }
  activeTrackElements = [];

  const overlayContainer = ensureContainer(OVERLAY_CONTAINER_ID);
  const popupContainer = ensureContainer(POPUP_CONTAINER_ID);

  const usable = extractUsableTracks(rawTracks);
  const { target, native } = selectTracks(usable);

  if (!target) {
    renderStatusMessage(overlayContainer, 'idioma não disponível para este título');
    return;
  }

  const video = document.querySelector('video');
  if (!video) {
    renderStatusMessage(overlayContainer, 'temporariamente limitado');
    return;
  }

  overlayContainer.innerHTML = '';
  const targetLine = document.createElement('div');
  const nativeLine = document.createElement('div');
  overlayContainer.append(targetLine, nativeLine);

  activeTrackElements.push(
    attachCueListener(video, target, (cueText, startTime) => {
      renderOverlayLine(targetLine, cueText, (token, sentence) => {
        if (currentVideoId === null) return;
        const payload: LookupPayload = {
          videoId: currentVideoId,
          timestampBucket: startTime,
          sentence,
          clickedSpan: token,
          targetLang: target.language.toLowerCase().startsWith('it') ? 'it' : 'en',
          nativeLang: 'pt-BR',
        };
        void handleWordClick(video, popupContainer, payload);
      });
    })
  );

  if (native) {
    activeTrackElements.push(
      attachCueListener(video, native, (cueText) => {
        renderOverlayLine(nativeLine, cueText, () => {});
      })
    );
  }
}

window.addEventListener('message', (event) => {
  const message = parseBridgeMessage(event, window);
  if (!message) return;

  if (message.type === 'sla-copilot:videoid') {
    currentVideoId = message.videoId;
    return;
  }

  if (message.type === 'sla-copilot:tracks') {
    handleTracks(message.textTracks);
  }
});
