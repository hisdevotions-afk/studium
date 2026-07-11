import { parseBridgeMessage } from './bridge-messages';
import { extractUsableTracks, selectTracks } from '../adapter/track-selection';
import { attachCueListener } from '../adapter/cue-listener';
import { renderOverlayLine } from '../overlay/overlay';
import { renderStatusMessage } from '../overlay/status-message';
import { handleWordClick } from './orchestrate-word-click';
import type { RawNetflixTrack, SubtitleTrack, TargetLang, LookupPayload } from '../adapter/types';

const OVERLAY_CONTAINER_ID = 'sla-copilot-overlay';
const POPUP_CONTAINER_ID = 'sla-copilot-popup-container';
const POLL_INTERVAL_MS = 1000;

const CONTAINER_STYLES: Record<string, string> = {
  [OVERLAY_CONTAINER_ID]:
    'position: fixed; bottom: 8vh; left: 0; right: 0; z-index: 2147483647; text-align: center; pointer-events: none;',
  [POPUP_CONTAINER_ID]:
    'position: fixed; bottom: 20vh; left: 0; right: 0; z-index: 2147483647; text-align: center; pointer-events: none;',
};

function ensureContainer(id: string): HTMLElement {
  let elem = document.getElementById(id);
  if (!elem) {
    elem = document.createElement('div');
    elem.id = id;
    elem.style.cssText = CONTAINER_STYLES[id] ?? '';
    document.body.appendChild(elem);
  }
  return elem;
}

interface Selection {
  target: SubtitleTrack;
  native: SubtitleTrack | null;
  targetLang: TargetLang;
}

let currentVideoId: number | null = null;
let selection: Selection | null = null;
let attachedVideo: HTMLVideoElement | null = null;
let attachSeq = 0;
let activeTrackElements: HTMLTrackElement[] = [];

function clearTracks(): void {
  for (const trackElem of activeTrackElements) {
    trackElem.remove();
  }
  activeTrackElements = [];
}

// A tracks message tells us which subtitle files to use, but the <video>
// element it needs may not exist yet (Netflix mounts it after DRM/session
// negotiation) and can be torn down and recreated during a session. So we
// store the selection and let a poll (tryAttach) attach to whatever <video>
// is currently live, re-attaching if Netflix swaps the element.
function handleTracks(movieId: number, rawTracks: RawNetflixTrack[]): void {
  currentVideoId = movieId;
  const usable = extractUsableTracks(rawTracks);
  const { target, native } = selectTracks(usable);

  attachSeq++; // abandon any in-flight attach from a previous title
  attachedVideo = null;
  clearTracks();

  const overlayContainer = ensureContainer(OVERLAY_CONTAINER_ID);
  ensureContainer(POPUP_CONTAINER_ID);

  if (!target) {
    selection = null;
    renderStatusMessage(overlayContainer, 'idioma não disponível para este título');
    return;
  }

  selection = {
    target,
    native,
    targetLang: target.language.toLowerCase().startsWith('it') ? 'it' : 'en',
  };
  void tryAttach();
}

async function tryAttach(): Promise<void> {
  const sel = selection;
  if (!sel) return;
  const video = document.querySelector('video');
  if (!video || video === attachedVideo) return;

  const seq = ++attachSeq;
  attachedVideo = video; // optimistic: stops the poll from launching a duplicate attach
  clearTracks();

  const overlayContainer = ensureContainer(OVERLAY_CONTAINER_ID);
  const popupContainer = ensureContainer(POPUP_CONTAINER_ID);
  overlayContainer.innerHTML = '';
  const targetLine = document.createElement('div');
  const nativeLine = document.createElement('div');
  overlayContainer.append(targetLine, nativeLine);

  const targetTrackElem = await attachCueListener(video, sel.target, (cueText, startTime) => {
    renderOverlayLine(targetLine, cueText, (token, sentence) => {
      if (currentVideoId === null) return;
      const payload: LookupPayload = {
        videoId: currentVideoId,
        timestampBucket: startTime,
        sentence,
        clickedSpan: token,
        targetLang: sel.targetLang,
        nativeLang: 'pt-BR',
      };
      void handleWordClick(video, popupContainer, payload);
    });
  });
  if (seq !== attachSeq) {
    targetTrackElem.remove();
    return;
  }
  activeTrackElements.push(targetTrackElem);

  if (sel.native) {
    const nativeTrackElem = await attachCueListener(video, sel.native, (cueText) => {
      renderOverlayLine(nativeLine, cueText, () => {});
    });
    if (seq !== attachSeq) {
      nativeTrackElem.remove();
      return;
    }
    activeTrackElements.push(nativeTrackElem);
  }
}

// ponytail: naive 1s poll; a MutationObserver would be tighter if this ever
// shows up on the profiler, but a single querySelector per tick is cheap.
setInterval(() => void tryAttach(), POLL_INTERVAL_MS);

window.addEventListener('message', (event) => {
  const message = parseBridgeMessage(event, window);
  if (!message) return;

  if (message.type === 'sla-copilot:videoid') {
    currentVideoId = message.videoId;
    return;
  }

  if (message.type === 'sla-copilot:tracks') {
    handleTracks(message.movieId, message.textTracks);
  }
});
