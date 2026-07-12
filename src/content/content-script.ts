import { parseBridgeMessage } from './bridge-messages';
import { extractUsableTracks, selectTracks } from '../adapter/track-selection';
import { attachCueListener } from '../adapter/cue-listener';
import { renderOverlayLine } from '../overlay/overlay';
import { renderControls } from '../overlay/controls';
import { renderStatusMessage } from '../overlay/status-message';
import { handleWordClick } from './orchestrate-word-click';
import {
  isEnabled,
  getLanguages,
  ENABLED_KEY,
  NATIVE_LANG_KEY,
  TARGET_LANG_KEY,
} from '../lookup/settings';
import type {
  RawNetflixTrack,
  SubtitleTrack,
  TargetLang,
  NativeLang,
  LookupPayload,
} from '../adapter/types';

const OVERLAY_CONTAINER_ID = 'sla-copilot-overlay';
const POPUP_CONTAINER_ID = 'sla-copilot-popup-container';
const CONTROLS_CONTAINER_ID = 'sla-copilot-controls';
const NATIVE_SUB_STYLE_ID = 'sla-copilot-hide-native';
const POLL_INTERVAL_MS = 1000;

const CONTAINER_STYLES: Record<string, string> = {
  [OVERLAY_CONTAINER_ID]:
    'position: fixed; bottom: 8vh; left: 0; right: 0; z-index: 2147483647; text-align: center; pointer-events: none;',
  [POPUP_CONTAINER_ID]:
    'position: fixed; bottom: 20vh; left: 0; right: 0; z-index: 2147483647; text-align: center; pointer-events: none;',
  // Own container above the subtitles and clear of Netflix's bottom control
  // bar, so the speed/repeat buttons stay clickable.
  [CONTROLS_CONTAINER_ID]:
    'position: fixed; bottom: 16vh; left: 0; right: 0; z-index: 2147483647; text-align: center; pointer-events: none;',
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

// Flow 1.6: our overlay replaces Netflix's subtitle renderer; both visible at
// once is double text on screen.
function setNativeSubtitlesHidden(hidden: boolean): void {
  const existing = document.getElementById(NATIVE_SUB_STYLE_ID);
  if (hidden && !existing) {
    const style = document.createElement('style');
    style.id = NATIVE_SUB_STYLE_ID;
    style.textContent = '.player-timedtext { display: none !important; }';
    document.head.appendChild(style);
  }
  if (!hidden) existing?.remove();
}

interface Selection {
  target: SubtitleTrack;
  native: SubtitleTrack | null;
  targetLang: TargetLang;
}

// User's on/off toggle (toolbar popup). Synced from storage on load and kept
// live via chrome.storage.onChanged so flipping the switch takes effect
// immediately. Starts optimistically true so a fast player load isn't blocked
// waiting on the async read; the init below corrects it if actually disabled.
let enabled = true;
// Chosen study + native languages (toolbar popup). Synced on load and kept live
// via chrome.storage.onChanged; a change re-runs selection on the cached tracks.
let targetLangPref: TargetLang = 'en';
let nativeLangPref: NativeLang = 'pt';
let lastRawTracks: RawNetflixTrack[] | null = null;
let lastMovieId: number | null = null;
let currentVideoId: number | null = null;
let selection: Selection | null = null;
let attachedVideo: HTMLVideoElement | null = null;
let attachSeq = 0;
let activeTrackElements: HTMLTrackElement[] = [];
// The target-track cue window currently on screen. Task 6's repeat-phrase
// control reads this to know where to loop back to.
let currentCueWindow: { start: number; end: number } | null = null;

function clearTracks(): void {
  for (const trackElem of activeTrackElements) {
    trackElem.remove();
  }
  activeTrackElements = [];
}

// Full teardown: unhide Netflix's own subs and wipe our overlay/popup. Shared
// by the leave-/watch poll branch and the disable toggle.
function teardownOverlay(): void {
  setNativeSubtitlesHidden(false);
  if (attachedVideo) {
    attachedVideo = null;
    clearTracks();
    document.getElementById(OVERLAY_CONTAINER_ID)?.replaceChildren();
    document.getElementById(POPUP_CONTAINER_ID)?.replaceChildren();
    document.getElementById(CONTROLS_CONTAINER_ID)?.replaceChildren();
  }
}

// A tracks message tells us which subtitle files to use, but the <video>
// element it needs may not exist yet (Netflix mounts it after DRM/session
// negotiation) and can be torn down and recreated during a session. So we
// store the selection and let a poll (tryAttach) attach to whatever <video>
// is currently live, re-attaching if Netflix swaps the element.
function handleTracks(movieId: number, rawTracks: RawNetflixTrack[]): void {
  currentVideoId = movieId;
  // Cache so a language change can re-select without waiting for a new manifest.
  lastMovieId = movieId;
  lastRawTracks = rawTracks;
  if (!enabled) return;
  const usable = extractUsableTracks(rawTracks);
  const { target, native } = selectTracks(usable, targetLangPref, nativeLangPref);

  attachSeq++; // abandon any in-flight attach from a previous title
  attachedVideo = null;
  clearTracks();

  const overlayContainer = ensureContainer(OVERLAY_CONTAINER_ID);
  ensureContainer(POPUP_CONTAINER_ID);

  if (!target) {
    selection = null;
    // A previous title may have hidden native subs and this one has no
    // usable target track, so nothing else will re-hide them. Only unhide
    // here — a successful target on this path re-hides itself at the end of
    // tryAttach(), so unhiding unconditionally at the top would flash
    // Netflix's native subs during every ordinary title-to-title switch.
    setNativeSubtitlesHidden(false);
    // Trailers on /browse also produce manifests; don't paint status text
    // over the browse UI.
    if (onWatchPage()) {
      renderStatusMessage(overlayContainer, 'idioma não disponível para este título');
    }
    return;
  }

  selection = { target, native, targetLang: targetLangPref };
  void tryAttach();
}

function onWatchPage(): boolean {
  return location.pathname.startsWith('/watch');
}

async function tryAttach(): Promise<void> {
  if (!enabled) return;
  // Only attach on the player page — /browse has hover-preview <video>s we
  // must never decorate.
  if (!onWatchPage()) return;
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
  const controlsContainer = ensureContainer(CONTROLS_CONTAINER_ID);
  renderControls(controlsContainer, video, () => currentCueWindow);

  const targetTrackElem = await attachCueListener(video, sel.target, (cueText, startTime, endTime) => {
    currentCueWindow = { start: startTime, end: endTime };
    renderOverlayLine(targetLine, cueText, (token, sentence) => {
      if (currentVideoId === null) return;
      const payload: LookupPayload = {
        videoId: currentVideoId,
        timestampBucket: startTime,
        sentence,
        clickedSpan: token,
        targetLang: sel.targetLang,
        nativeLang: nativeLangPref,
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

  setNativeSubtitlesHidden(true);
}

// ponytail: naive 1s poll; a MutationObserver would be tighter if this ever
// shows up on the profiler, but a single querySelector per tick is cheap.
setInterval(() => {
  if (!onWatchPage()) {
    // SPA-navigated away from the player: drop tracks and wipe the fixed
    // overlay so the last subtitle line doesn't linger over /browse. Unhide
    // unconditionally — attachedVideo may already be null (e.g. the title
    // had no usable track) while native subs are still hidden from an
    // earlier title.
    teardownOverlay();
    return;
  }
  void tryAttach();
}, POLL_INTERVAL_MS);

// Re-run selection on the last-seen manifest — used when the user changes the
// enabled flag or the languages without re-navigating.
function reselect(): void {
  if (lastRawTracks && lastMovieId !== null) handleTracks(lastMovieId, lastRawTracks);
}

// Sync toggle + languages from storage on load, then keep them live: flipping
// the switch or changing a language in the toolbar popup takes effect at once.
void isEnabled().then((v) => {
  enabled = v;
  if (!enabled) teardownOverlay();
});
void getLanguages().then(({ native, target }) => {
  nativeLangPref = native;
  targetLangPref = target;
  reselect();
});
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes) => {
    if (ENABLED_KEY in changes) {
      enabled = changes[ENABLED_KEY]!.newValue !== false;
      if (!enabled) teardownOverlay();
      else reselect();
    }
    if (NATIVE_LANG_KEY in changes || TARGET_LANG_KEY in changes) {
      if (NATIVE_LANG_KEY in changes) nativeLangPref = changes[NATIVE_LANG_KEY]!.newValue as NativeLang;
      if (TARGET_LANG_KEY in changes) targetLangPref = changes[TARGET_LANG_KEY]!.newValue as TargetLang;
      reselect();
    }
  });
}

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
