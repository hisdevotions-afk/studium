# Iterative Harness + MVP Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the built extension and the MVP spec, iterating against a local Netflix-free player simulator until the rubric score is ≥ 9.5, with exactly ONE final live-Netflix validation (one extension reload total).

**Architecture:** A local vite dev server serves `watch/sim.html` — a fake Netflix player page (canvas-stream `<video>`, fixture VTT files, fake `.player-timedtext`) that imports `src/content/content-script.ts` directly as a module. Because the harness loads *source*, iteration = edit file → F5 the page. No extension reload, no Netflix, no DRM. The real extension bundle is only reloaded once, at final validation.

**Tech Stack:** Vite (already installed), Vitest + jsdom (already installed), claude-in-chrome for driving the harness page. **No new dependencies.**

## Global Constraints

- Ponytail full: minimum diff, no new deps, no speculative abstraction.
- TDD on every logic change: failing test → minimal code → green.
- Backend (`/lookup`, freemium, cache server) is OUT OF SCOPE — the extension keeps the exact client contract (`LookupPayload`, 2.5s timeout fallback) against the stub in `src/lookup/explain-lookup.ts`.
- Page-bridge hooks must NEVER propagate an exception into Netflix's `JSON.*` callers (already enforced; keep it that way).
- UI copy is pt-BR, exact strings: `"idioma não disponível para este título"`, `"salvar"`, `"salvo ✓"`, `"continuar ▶"`, `"não consegui buscar isso agora."`, `"repetir"`.
- Netflix live testing happens ONLY in Task 10.

---

## Rubric — MVP (extension) vs built, 0–10

Score = sum of weighted criteria. Each criterion is verified by named evidence (test or harness step). Update this table after every task; **stop only at ≥ 9.5**.

| # | Criterion (MVP source) | Weight | Score now | Evidence required |
|---|---|---|---|---|
| A | Injection & robustness: works on SPA browse→play AND hard `/watch` load; never breaks Netflix (cycle-safe hooks, swallowed errors) | 1.5 | 1.5 | cycle tests green; Task 10 live check — DONE: fixed a real stack-overflow bug found live (see below), confirmed on real Netflix both the SPA `/browse`→play path and a hard `/watch/<id>` direct load attach without hanging |
| B | Dual subtitles synced, clean text (no VTT markup), target line tokenized & clickable (Flow 1.5) | 2.0 | 2.0 | markup-strip tests; harness visual — DONE; also confirmed live on real Netflix (The Office): `"I found it at Spencer Gifts." / "Eu achei na Spencer Gifts."` clean, no markup |
| C | Netflix's own subtitle renderer hidden while overlay active (Flow 1.6) | 0.5 | 0.5 | Task 3 test + harness visual — DONE, committed; confirmed live on real Netflix |
| D | Word click → instant `pause()` → popup with spec payload (`timestamp_bucket` = cue start) + 2.5s timeout fallback (Flow 2.2/2.3/2.7) | 1.5 | 1.5 | integration test; Task 7 timeout test — DONE, committed; confirmed live on real Netflix: clicking "Spencer" paused the video and showed the popup |
| E | Resume rules: never auto-resume; closing popup resumes (Flow 2.6) | 1.0 | 1.0 | Task 4 test + harness click-through — DONE, committed; confirmed live: `continuar ▶` resumed real playback |
| F | Save to vocabulary: capture `{word, sentence, videoId, timestamp, targetLang}` + lightweight confirmation (Flow 3) | 1.0 | 1.0 | Task 5 tests + harness click-through — DONE, committed; confirmed live: `salvar` → `salvo ✓` against real `chrome.storage.local` |
| G | Playback controls: speed + repeat-phrase looping current cue (Flow 4) | 1.5 | 1.5 | Task 6 tests + harness click-through — DONE, committed; harness could only PARTIALLY confirm (its `<video>` uses a live `canvas.captureStream()` source, and Chrome ignores `playbackRate`/`currentTime` writes on live MediaStream video — a harness limitation, not a code defect). **Confirmed live on real Netflix**: speed button cycled `video.playbackRate` 1→1.25→1 correctly; `repetir` correctly reset `currentTime` back to the cue's start when seeked past its end |
| H | Quality: all tests green, typecheck clean, no debug logs, toolbar button + popup present (user request) | 1.0 | 1.0 | Task 8/9 DONE, committed — 63/63 tests, typecheck clean, build clean, zero `console.log`/`[studium]` in src/. Console on real Netflix clean of anything from our extension (one unrelated Netflix-internal `ApolloError` from their own telemetry client). **CONFIRMED live 2026-07-12:** toolbar action popup opens showing the status line ("Ativo em netflix.com/watch: clique numa palavra da legenda para pausar e ver a explicação.") and "1 palavras salvas no vocabulário." — saved count = 1 (≥ 1), read from real `chrome.storage.local` |

**Current: 10.0 / 10 — COMPLETE (2026-07-12).** All criteria at full weight with live evidence. Final two gaps closed on 2026-07-12: (1) `/watch` → `/browse` SPA back navigation on real Netflix tore down the overlay content + removed the `#sla-copilot-hide-native` style tag (empty inert shell divs persist, nothing visible) — row A; (2) toolbar action popup confirmed showing saved count = 1 ≥ 1 — row H.

**Bonus fix found during live validation (not in the original task list):** real Netflix on title 70210984 threw an uncaught `RangeError: Maximum call stack size exceeded` from the `page-bridge.ts` JSON.stringify hook — `findProfilesArray`'s recursive tree-walk overflowed on a real (deeply nested, non-cyclic) app-state object. Fixed by converting it to an iterative explicit-stack traversal; committed as `3cda658`. User confirmed the error is gone after reloading.

**Resume point (2026-07-11):** Tasks 1–9 implemented and committed. Only Task 10 (final live Netflix validation) remains — it requires the user's go-ahead for the one allowed extension reload, per Global Constraints. Once given, drive Netflix via claude-in-chrome per Task 10's steps, paying particular attention to verifying speed + repetir (the harness could only partially confirm these due to its live-stream video limitation).

## Iteration protocol (the loop)

1. Implement one task (TDD, below).
2. `npm run typecheck && npm test` — all green or fix before moving on.
3. Refresh `http://localhost:5199/watch/sim.html` (plain F5 via browser tools) and drive the affected flow visually.
4. Update the rubric table scores in THIS file with evidence.
5. Next task. **Never touch Netflix or ask for extension reload until Task 10.**

---

### Task 1: Player simulator harness ✅ DONE (committed fbf4f8d)

**Files:**
- Create: `vite.harness.config.ts`
- Create: `watch/sim.html`
- Create: `watch/fixtures/en.vtt`
- Create: `watch/fixtures/pt.vtt`
- Modify: `package.json` (add `harness` script)

**Interfaces:**
- Produces: dev server at `http://localhost:5199/watch/sim.html` where the real `content-script.ts` runs against a fake player. All later tasks use this page for visual verification.

- [ ] **Step 1: Write the harness vite config**

```ts
// vite.harness.config.ts
import { defineConfig } from 'vite';

// Harness dev server: serves watch/sim.html (pathname starts with /watch so
// the content script's page gate passes) and transforms src/*.ts on the fly —
// editing source + F5 is the whole iteration loop, no build, no extension.
export default defineConfig({
  server: { port: 5199, strictPort: true },
});
```

- [ ] **Step 2: Write the fixtures**

`watch/fixtures/en.vtt` (deliberately carries Netflix's real markup patterns):

```
WEBVTT

00:00:01.000 --> 00:00:04.000
<c.white><c.mono_sans>HEY, JIM.</c.mono_sans></c.white>

00:00:04.500 --> 00:00:08.000
<c.white><c.mono_sans>STANLEY IS BACK &amp; READY.</c.mono_sans></c.white>

00:00:08.500 --> 00:00:12.000
<i>I want to be into someone.</i>

00:00:12.500 --> 00:00:16.000
This plain line has no markup at all.

00:00:16.500 --> 00:00:20.000
<c.white>Final styled line for looping tests.</c.white>
```

`watch/fixtures/pt.vtt`:

```
WEBVTT

00:00:01.000 --> 00:00:04.000
Oi, Jim.

00:00:04.500 --> 00:00:08.000
Stanley voltou e está pronto.

00:00:08.500 --> 00:00:12.000
Quero estar a fim de alguém.

00:00:12.500 --> 00:00:16.000
Esta linha simples não tem marcação.

00:00:16.500 --> 00:00:20.000
Linha final estilizada para testes de loop.
```

- [ ] **Step 3: Write the simulator page**

```html
<!-- watch/sim.html -->
<!doctype html>
<meta charset="utf-8" />
<title>Studium — Player Simulator</title>
<style>
  body { background: #141414; margin: 0; font-family: monospace; }
  video { display: block; width: 100vw; height: 70vh; background: #000; }
  .player-timedtext {
    position: fixed; bottom: 4vh; left: 0; right: 0;
    text-align: center; color: yellow; font-size: 22px; z-index: 10;
  }
  #sim-status { color: #6f6; padding: 8px; }
</style>
<video id="v" muted autoplay></video>
<!-- Fake Netflix native subtitle renderer: MUST disappear when overlay attaches -->
<div class="player-timedtext">LEGENDA NATIVA DA NETFLIX (deve sumir)</div>
<div id="sim-status">carregando…</div>
<script type="module">
  // ---- fake Netflix player: real currentTime via canvas stream ----
  const v = document.getElementById('v');
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const ctx = c.getContext('2d');
  (function draw() {
    ctx.fillStyle = '#102030'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#fff'; ctx.font = '28px monospace';
    ctx.fillText('t = ' + v.currentTime.toFixed(1) + 's  rate=' + v.playbackRate + 'x  ' + (v.paused ? 'PAUSED' : 'PLAYING'), 20, 50);
    requestAnimationFrame(draw);
  })();
  v.srcObject = c.captureStream(30);
  document.body.dataset.videoid = '99999';

  // ---- load the REAL content script as source ----
  await import('/src/content/content-script.ts');

  // ---- broadcast tracks exactly like page-bridge does ----
  const track = (id, language, languageDescription, url) => ({
    id, language, languageDescription,
    isForcedNarrative: false, isNoneTrack: false, rawTrackType: 'subtitles',
    downloadables: { 'webvtt-lssdh-ios8': { urls: [{ url }] } },
  });
  window.postMessage({
    type: 'sla-copilot:tracks',
    movieId: 99999,
    textTracks: [
      track('en1', 'en', 'English', '/watch/fixtures/en.vtt'),
      track('pt1', 'pt-BR', 'Português', '/watch/fixtures/pt.vtt'),
    ],
  }, location.origin);
  document.getElementById('sim-status').textContent =
    'simulador ativo — movieId 99999, tracks en + pt-BR enviadas';
</script>
```

- [ ] **Step 4: Add the npm script**

In `package.json` scripts: `"harness": "vite --config vite.harness.config.ts"`.

- [ ] **Step 5: Verify**

Run: `npm run harness` (background). Open `http://localhost:5199/watch/sim.html` in the browser (claude-in-chrome), screenshot after ~3s.
Expected: canvas video playing, BOTH subtitle lines rendered by the overlay, English line WITHOUT `<c.white>` garbage, yellow fake-native line still visible (fixed in Task 3).

- [ ] **Step 6: Commit**

```bash
git add vite.harness.config.ts watch/ package.json
git commit -m "test: add local Netflix player simulator harness"
```

---

### Task 2: Content-script integration test (vitest) ✅ DONE (committed 21a6263)

**Files:**
- Create: `tests/content-script.test.ts`

**Interfaces:**
- Consumes: the side-effect module `src/content/content-script.ts`; `parseBridgeMessage` contract (`source === window`).
- Produces: regression net for the full wire: tracks message → attach → cuechange → token click → pause + popup. Later tasks extend this file.

- [ ] **Step 1: Write the failing integration test**

```ts
// tests/content-script.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const VTT = 'WEBVTT\n\n00:00.000 --> 00:02.000\nhello';

const track = (id: string, language: string, desc: string) => ({
  id, language, languageDescription: desc,
  isForcedNarrative: false, isNoneTrack: false, rawTrackType: 'subtitles',
  downloadables: { 'webvtt-lssdh-ios8': { urls: [{ url: `https://cdn.test/${id}.vtt` }] } },
});

function sendTracks(): void {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      type: 'sla-copilot:tracks', movieId: 99999,
      textTracks: [track('en1', 'en', 'English'), track('pt1', 'pt-BR', 'Português')],
    },
    source: window,
  }));
}

describe('content-script wiring', () => {
  let video: HTMLVideoElement;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: () => Promise.resolve(VTT) }));
    window.history.pushState({}, '', '/watch/99999');
    video = document.createElement('video');
    video.pause = vi.fn();
    video.play = vi.fn().mockResolvedValue(undefined);
    document.body.appendChild(video);
    await import('../src/content/content-script');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('attaches both tracks to the video after a tracks message', async () => {
    sendTracks();
    await vi.advanceTimersByTimeAsync(1100);
    expect(video.querySelectorAll('track')).toHaveLength(2);
  });

  it('renders clean clickable tokens on cuechange and pauses + pops up on click', async () => {
    const targetTrackElem = video.querySelectorAll('track')[0]!;
    Object.defineProperty(targetTrackElem.track, 'activeCues', {
      value: [{ text: '<c.white>BE INTO SOMEONE</c.white>', startTime: 8.5 }],
      configurable: true,
    });
    targetTrackElem.dispatchEvent(new Event('cuechange'));

    const tokens = document.querySelectorAll('#sla-copilot-overlay .sla-copilot-token');
    expect([...tokens].map((t) => t.textContent)).toEqual(['BE', 'INTO', 'SOMEONE']);

    (tokens[1] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);

    expect(video.pause).toHaveBeenCalled();
    const popup = document.querySelector('#sla-copilot-popup-container .sla-copilot-popup');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('INTO');
  });
});
```

- [ ] **Step 2: Run to verify it fails or passes for the RIGHT reason**

Run: `npx vitest run tests/content-script.test.ts`
Expected: PASS (this codifies current behavior). If it fails, the failure is a real wiring bug — fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add tests/content-script.test.ts
git commit -m "test: integration test for content-script wiring"
```

---

### Task 3: Hide Netflix's native subtitles while overlay is active ✅ DONE (committed 6d3eb54, 58938b4, 3dbee14)

**Files:**
- Modify: `src/content/content-script.ts`
- Test: `tests/content-script.test.ts` (extend)

**Interfaces:**
- Produces: `setNativeSubtitlesHidden(hidden: boolean): void` (module-private); a `<style id="sla-copilot-hide-native">` element present iff overlay attached.

- [ ] **Step 1: Write the failing test** (append to `tests/content-script.test.ts`)

```ts
  it('hides Netflix native subtitles while attached', () => {
    const style = document.getElementById('sla-copilot-hide-native');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('.player-timedtext');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/content-script.test.ts`
Expected: FAIL — style element is null.

- [ ] **Step 3: Implement** (in `src/content/content-script.ts`)

```ts
const NATIVE_SUB_STYLE_ID = 'sla-copilot-hide-native';

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
```

Call `setNativeSubtitlesHidden(true)` at the end of a successful `tryAttach` (after tracks are pushed), and `setNativeSubtitlesHidden(false)` in the poll's leave-`/watch` teardown branch.

- [ ] **Step 4: Run tests, verify pass; check harness visually (yellow fake-native line gone)**

- [ ] **Step 5: Commit**

```bash
git add src/content/content-script.ts tests/content-script.test.ts
git commit -m "feat: hide Netflix native subtitle renderer while overlay is active"
```

---

### Task 4: Cue end time + popup close/resume ✅ DONE (committed 8909666)

**Files:**
- Modify: `src/adapter/cue-listener.ts` (onCue gains `endTime`)
- Modify: `src/content/content-script.ts` (call sites; keep last cue window)
- Modify: `src/content/orchestrate-word-click.ts` (resume handler)
- Modify: `src/overlay/popup.ts` (close button)
- Test: `tests/cue-listener.test.ts`, `tests/popup.test.ts`

**Interfaces:**
- Produces: `onCue(cueText: string, startTime: number, endTime: number)`; `renderPopup(container, payload, explanation, onResume: () => void)` — close button labeled `continuar ▶` calls `onResume`; `handleWordClick(video, popupContainer, payload)` resumes via `video.play()` + clears container. Task 6 consumes the cue window.

- [ ] **Step 1: Failing test — cue-listener passes endTime** (adjust existing cuechange test)

```ts
    const fakeCue = { text: 'be into someone', startTime: 12.5, endTime: 15.0 };
    // ...
    expect(onCue).toHaveBeenCalledWith('be into someone', 12.5, 15.0);
```

- [ ] **Step 2: Run: FAIL. Implement:** in `cue-listener.ts`, cue cast gains `endTime: number`; call `onCue(stripVttMarkup(cue.text), cue.startTime, cue.endTime)`. Update the markup-strip test expectation to three args too. Run: PASS.

- [ ] **Step 3: Failing test — popup close button** (in `tests/popup.test.ts`)

```ts
  it('renders a continuar button that fires onResume', () => {
    const container = document.createElement('div');
    const onResume = vi.fn();
    renderPopup(container, samplePayload, sampleExplanation, onResume);
    const btn = container.querySelector('.sla-copilot-popup-resume') as HTMLElement;
    expect(btn.textContent).toBe('continuar ▶');
    btn.click();
    expect(onResume).toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run: FAIL. Implement:** `renderPopup(container, payload, explanation, onResume: () => void)` adds:

```ts
  const resumeButton = document.createElement('button');
  resumeButton.className = 'sla-copilot-popup-resume';
  resumeButton.style.cssText = 'cursor: pointer; padding: 6px 12px; margin-top: 4px; margin-left: 8px;';
  resumeButton.textContent = 'continuar ▶';
  resumeButton.addEventListener('click', onResume);
  popup.append(wordElem, explanationElem, saveButton, resumeButton);
```

And in `orchestrate-word-click.ts`:

```ts
  renderPopup(popupContainer, payload, explanation, () => {
    popupContainer.innerHTML = '';
    void video.play();
  });
```

Fix existing `renderPopup` test call sites (4th arg `() => {}`). Run: PASS. Never auto-resume stays guaranteed: `video.play()` has exactly this one caller.

- [ ] **Step 5: Full suite + typecheck + harness click-through (click word → pauses; continuar ▶ → resumes). Commit:**

```bash
git add src/adapter/cue-listener.ts src/content/ src/overlay/popup.ts tests/
git commit -m "feat: cue end time + popup continuar button resumes playback"
```

---

### Task 5: Save to vocabulary ✅ DONE (committed fc030e0)

**Files:**
- Create: `src/lookup/vocabulary.ts`
- Modify: `src/content/orchestrate-word-click.ts`, `src/overlay/popup.ts`
- Test: `tests/vocabulary.test.ts`, `tests/popup.test.ts`

**Interfaces:**
- Produces:
  - `interface VocabularyEntry { word: string; sentence: string; videoId: number; timestamp: number; targetLang: TargetLang; savedAt: string }`
  - `saveVocabulary(entry: VocabularyEntry): Promise<void>` / `listVocabulary(): Promise<VocabularyEntry[]>` — `chrome.storage.local` when available, `localStorage` fallback (harness/tests).
  - `renderPopup(container, payload, explanation, onResume, onSave: () => Promise<void>)` — save button flips to `salvo ✓` and disables after `onSave` resolves.
- Task 8 consumes `listVocabulary()`.

- [ ] **Step 1: Failing tests** (`tests/vocabulary.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { saveVocabulary, listVocabulary } from '../src/lookup/vocabulary';

const entry = {
  word: 'into', sentence: 'be into someone', videoId: 99999,
  timestamp: 8.5, targetLang: 'en' as const, savedAt: '2026-07-11T12:00:00.000Z',
};

describe('vocabulary', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', async () => {
    expect(await listVocabulary()).toEqual([]);
  });

  it('persists saved entries in order', async () => {
    await saveVocabulary(entry);
    await saveVocabulary({ ...entry, word: 'hey' });
    const all = await listVocabulary();
    expect(all).toHaveLength(2);
    expect(all[0]!.word).toBe('into');
    expect(all[1]!.word).toBe('hey');
  });
});
```

- [ ] **Step 2: Run: FAIL (module missing). Implement:**

```ts
// src/lookup/vocabulary.ts
import type { TargetLang } from '../adapter/types';

export interface VocabularyEntry {
  word: string;
  sentence: string;
  videoId: number;
  timestamp: number;
  targetLang: TargetLang;
  savedAt: string;
}

const KEY = 'sla-copilot-vocabulary';

// chrome.storage.local inside the real extension; localStorage in the
// harness page and in tests. Same shape either way: a single JSON array.
const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function listVocabulary(): Promise<VocabularyEntry[]> {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(KEY);
    return (data[KEY] as VocabularyEntry[]) ?? [];
  }
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

export async function saveVocabulary(entry: VocabularyEntry): Promise<void> {
  const all = [...(await listVocabulary()), entry];
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [KEY]: all });
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(all));
}
```

Run: PASS.

- [ ] **Step 3: Failing test — save button feedback** (`tests/popup.test.ts`)

```ts
  it('save button calls onSave and flips to salvo ✓', async () => {
    const container = document.createElement('div');
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderPopup(container, samplePayload, sampleExplanation, () => {}, onSave);
    const btn = container.querySelector('.sla-copilot-popup-save') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalled();
    expect(btn.textContent).toBe('salvo ✓');
    expect(btn.disabled).toBe(true);
  });
```

- [ ] **Step 4: Run: FAIL. Implement:** `renderPopup(..., onSave: () => Promise<void>)`:

```ts
  saveButton.addEventListener('click', () => {
    void onSave().then(() => {
      saveButton.textContent = 'salvo ✓';
      saveButton.disabled = true;
    });
  });
```

And in `orchestrate-word-click.ts`:

```ts
import { saveVocabulary } from '../lookup/vocabulary';
// inside handleWordClick, as the onSave argument:
  () => saveVocabulary({
    word: payload.clickedSpan,
    sentence: payload.sentence,
    videoId: payload.videoId,
    timestamp: payload.timestampBucket,
    targetLang: payload.targetLang,
    savedAt: new Date().toISOString(),
  })
```

Fix existing renderPopup call sites/tests (5th arg). Run: PASS.

- [ ] **Step 5: Full suite + harness click-through (salvar → salvo ✓). Commit:**

```bash
git add src/lookup/vocabulary.ts src/content/orchestrate-word-click.ts src/overlay/popup.ts tests/
git commit -m "feat: save word to vocabulary with salvo confirmation"
```

---

### Task 6: Playback controls — speed + repeat phrase ✅ DONE (committed 0f55f3a) — see rubric row G caveat on harness live-stream limitation

**Files:**
- Create: `src/overlay/controls.ts`
- Modify: `src/content/content-script.ts` (track current cue window; mount controls)
- Test: `tests/controls.test.ts`

**Interfaces:**
- Consumes: cue window from Task 4 (`onCue(..., startTime, endTime)`).
- Produces: `renderControls(container: HTMLElement, video: HTMLVideoElement, getCurrentCue: () => { start: number; end: number } | null): void` — a speed button cycling `1 → 1.25 → 1.5 → 0.75 → 1` (label `1x` etc.) and a `repetir` toggle that loops `currentTime` inside the current cue window via `timeupdate` until clicked again.

- [ ] **Step 1: Failing tests** (`tests/controls.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { renderControls } from '../src/overlay/controls';

function setup(cue: { start: number; end: number } | null = { start: 8.5, end: 12.0 }) {
  const container = document.createElement('div');
  const video = document.createElement('video');
  renderControls(container, video, () => cue);
  return { container, video };
}

describe('renderControls', () => {
  it('speed button cycles playbackRate 1 → 1.25 → 1.5 → 0.75 → 1', () => {
    const { container, video } = setup();
    const btn = container.querySelector('.sla-copilot-speed') as HTMLElement;
    expect(btn.textContent).toBe('1x');
    btn.click();
    expect(video.playbackRate).toBe(1.25);
    expect(btn.textContent).toBe('1.25x');
    btn.click(); btn.click(); btn.click();
    expect(video.playbackRate).toBe(1);
    expect(btn.textContent).toBe('1x');
  });

  it('repetir loops currentTime back to cue start while active, stops when toggled off', () => {
    const { container, video } = setup();
    const btn = container.querySelector('.sla-copilot-repeat') as HTMLElement;
    btn.click(); // enable
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(8.5);
    btn.click(); // disable
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(12.3);
  });

  it('repetir does nothing when there is no current cue', () => {
    const { container, video } = setup(null);
    (container.querySelector('.sla-copilot-repeat') as HTMLElement).click();
    video.currentTime = 12.3;
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBe(12.3);
  });
});
```

- [ ] **Step 2: Run: FAIL. Implement:**

```ts
// src/overlay/controls.ts
const SPEEDS = [1, 1.25, 1.5, 0.75];
const BTN_STYLE =
  'cursor: pointer; pointer-events: auto; margin: 0 4px; padding: 2px 10px; ' +
  'background: rgba(0,0,0,0.75); color: #fff; border: 1px solid #666; border-radius: 4px;';

export function renderControls(
  container: HTMLElement,
  video: HTMLVideoElement,
  getCurrentCue: () => { start: number; end: number } | null
): void {
  container.innerHTML = '';

  const speedButton = document.createElement('button');
  speedButton.className = 'sla-copilot-speed';
  speedButton.style.cssText = BTN_STYLE;
  let speedIdx = 0;
  speedButton.textContent = `${SPEEDS[speedIdx]}x`;
  speedButton.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    video.playbackRate = SPEEDS[speedIdx]!;
    speedButton.textContent = `${SPEEDS[speedIdx]}x`;
  });

  const repeatButton = document.createElement('button');
  repeatButton.className = 'sla-copilot-repeat';
  repeatButton.style.cssText = BTN_STYLE;
  repeatButton.textContent = 'repetir';
  let loop: { start: number; end: number } | null = null;
  repeatButton.addEventListener('click', () => {
    loop = loop ? null : getCurrentCue();
    repeatButton.style.borderColor = loop ? '#e50914' : '#666';
  });
  video.addEventListener('timeupdate', () => {
    if (loop && video.currentTime >= loop.end) video.currentTime = loop.start;
  });

  container.append(speedButton, repeatButton);
}
```

Run: PASS.

- [ ] **Step 3: Mount in content-script:** keep `let lastCue: { start: number; end: number } | null = null;` updated inside the target-track `onCue` callback (`lastCue = { start: startTime, end: endTime }`); add a third `controlsLine` div (`pointer-events: none` container already; buttons opt back in) appended after `nativeLine`; call `renderControls(controlsLine, video, () => lastCue)` in `tryAttach`. Extend integration test: controls exist after attach.

- [ ] **Step 4: Full suite + harness click-through (speed changes canvas label; repetir loops the cue). Commit:**

```bash
git add src/overlay/controls.ts src/content/content-script.ts tests/
git commit -m "feat: playback controls — speed cycle and repeat phrase"
```

---

### Task 7: Lookup timeout fallback (Flow 2.7) ✅ DONE (committed 738226f)

**Files:**
- Modify: `src/lookup/explain-lookup.ts`
- Test: `tests/explain-lookup.test.ts`

**Interfaces:**
- Produces: `explainLookup(payload, impl?)` — same signature for callers; resolves the fallback `Explanation` (`contextualExplanation: 'não consegui buscar isso agora.'`) if `impl` takes > 2500 ms.

- [ ] **Step 1: Failing test** (append)

```ts
  it('falls back after 2.5s if the lookup hangs', async () => {
    vi.useFakeTimers();
    const never = () => new Promise<Explanation>(() => {});
    const pending = explainLookup(samplePayload, never);
    await vi.advanceTimersByTimeAsync(2600);
    const result = await pending;
    expect(result.contextualExplanation).toBe('não consegui buscar isso agora.');
    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run: FAIL. Implement:**

```ts
import type { LookupPayload, Explanation } from '../adapter/types';

const TIMEOUT_MS = 2500;

// Flow 2.7: never block the UI on a slow backend.
const FALLBACK: Explanation = {
  translation: '',
  contextualExplanation: 'não consegui buscar isso agora.',
  isIdiom: false,
  morphologyNote: null,
};

// ponytail: stub until the backend exists; the payload contract and the
// timeout behavior are the real deliverables here.
function fetchExplanation(payload: LookupPayload): Promise<Explanation> {
  return Promise.resolve({
    translation: payload.clickedSpan,
    contextualExplanation: `(stub) explicação de "${payload.clickedSpan}" ainda não conectada ao backend.`,
    isIdiom: false,
    morphologyNote: null,
  });
}

export function explainLookup(
  payload: LookupPayload,
  impl: (p: LookupPayload) => Promise<Explanation> = fetchExplanation
): Promise<Explanation> {
  return Promise.race([
    impl(payload).catch(() => FALLBACK),
    new Promise<Explanation>((resolve) => setTimeout(() => resolve(FALLBACK), TIMEOUT_MS)),
  ]);
}
```

Run: PASS (existing stub tests must stay green).

- [ ] **Step 3: Commit**

```bash
git add src/lookup/explain-lookup.ts tests/explain-lookup.test.ts
git commit -m "feat: 2.5s timeout fallback on lookup"
```

---

### Task 8: Toolbar button + popup (user request) ✅ DONE (committed e632135)

**Files:**
- Modify: `manifest.config.ts` (`action` + `permissions: ['storage']`)
- Create: `src/popup/index.html`
- Create: `src/popup/popup.ts`

**Interfaces:**
- Consumes: `listVocabulary()` from Task 5.
- Produces: toolbar button (Chrome default letter icon — no icon assets, YAGNI) opening a popup that shows status + saved-word count.

- [ ] **Step 1: Manifest:**

```ts
  permissions: ['storage'],
  action: {
    default_title: 'Studium',
    default_popup: 'src/popup/index.html',
  },
```

- [ ] **Step 2: Popup page:**

```html
<!-- src/popup/index.html -->
<!doctype html>
<meta charset="utf-8" />
<style>
  body { width: 260px; font-family: system-ui; background: #141414; color: #fff; padding: 12px; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  p { margin: 4px 0; font-size: 13px; color: #bbb; }
  #count { color: #fff; font-weight: bold; }
</style>
<h1>Studium</h1>
<p>Ativo em <b>netflix.com/watch</b>: clique numa palavra da legenda para pausar e ver a explicação.</p>
<p><span id="count">…</span> palavras salvas no vocabulário.</p>
<script type="module" src="./popup.ts"></script>
```

```ts
// src/popup/popup.ts
import { listVocabulary } from '../lookup/vocabulary';

void listVocabulary().then((all) => {
  document.getElementById('count')!.textContent = String(all.length);
});
```

- [ ] **Step 3: Verify:** `npm run build` succeeds and `dist/manifest.json` contains `action` + `storage`. (Visual check happens once, in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add manifest.config.ts src/popup/
git commit -m "feat: toolbar action popup with vocabulary count"
```

---

### Task 9: Strip debug logs + full verification ✅ DONE (committed 84d6dfa)

**Files:**
- Modify: `src/adapter/cue-listener.ts`, `src/content/content-script.ts`

- [ ] **Step 1:** Remove every `console.log('[studium] …')` added during debugging (keep the silent catch comments). The harness + integration tests now cover what the logs were for.
- [ ] **Step 2:** Run: `npm run typecheck && npm test && npm run build` — all green.
- [ ] **Step 3:** Harness full pass: subs clean, native hidden, click → pause → popup, salvar → salvo ✓, continuar ▶ resumes, speed + repetir work. Update rubric table (expect ≈ 9.0 pending live evidence for A/B).
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove debug logging"
```

---

### Task 10: Final live Netflix validation (the ONLY extension reload)

**Files:** none (verification only).

- [x] **Step 1:** Ask the user for ONE extension reload in `chrome://extensions` (manifest changed in Task 8 — this is the single reload of the whole plan). DONE — user reloaded; hit an unrelated live bug (see rubric "Bonus fix" note) which is now fixed and confirmed gone.
- [x] **Step 2:** Drive Netflix via claude-in-chrome: `/browse` → click a Continue Watching title (SPA path). Screenshot: dual subs, clean text, Netflix native subs hidden. DONE on "The Office" — confirmed via screenshot + DOM read.
- [x] **Step 3:** Click a subtitle word: video pauses, popup shows. Click `salvar` → `salvo ✓`. Click `continuar ▶` → resumes. DONE — clicked "Spencer", all confirmed live.
- [x] **Step 4:** Test speed + repetir buttons. Check console: zero errors, zero `[studium]` logs. DONE — both controls work correctly on real (MSE) video; console has zero errors from our code (one unrelated Netflix-internal `ApolloError`).
- [x] **Step 5:** Toolbar button → popup opens with saved count ≥ 1. **DONE (2026-07-12)** — user clicked the toolbar icon; popup opened showing the status line and "1 palavras salvas no vocabulário." (count = 1 ≥ 1).
- [x] **Step 6:** Hard-load a `/watch` URL directly: still attaches (no spinner hang). Navigate back to `/browse`: overlay wiped, native style tag removed. **DONE** — hard-load-attaches confirmed earlier (dual subs + controls after a full page navigation to `/watch/70210984`). Teardown confirmed live on 2026-07-12: with the overlay attached on `/watch/70210984` (11 tokens, `#sla-copilot-hide-native` present, video `readyState=4`), an SPA `history.back()` to `/browse` ran the poll's leave-`/watch` teardown branch — result: `#sla-copilot-hide-native` removed, overlay emptied (0 tokens, 0 children, 0 height, `pointer-events:none`), speed/`repetir` controls gone, popup container empty. Screenshot of `/browse` shows no Studium artifacts. (The overlay + popup container divs persist as inert empty shells — standard create-once/clear-contents pattern, nothing visible or clickable.)
- [x] **Step 7:** Score the rubric with live evidence. **DONE (2026-07-12) — final score 10.0/10 ≥ 9.5 → plan complete.** All criteria at full weight, all live checks passed. Nothing left to fix.

---

## Self-Review

- **Spec coverage:** Flow 1 (1.5 tokenize ✓ built; 1.6 hide native → Task 3), Flow 2 (2.2 pause ✓; 2.3 payload ✓; 2.5 popup ✓; 2.6 resume → Task 4; 2.7 timeout → Task 7), Flow 3 (→ Task 5), Flow 4 (→ Task 6), Flow 5 + cost control: backend, out of scope per Global Constraints. Toolbar+popup (user request) → Task 8. Netflix-free iteration → Task 1/2. Gaps: none client-side; native-track AI-translation fallback (Flow 1.4) is backend-dependent → explicitly not scored (target-only display already works).
- **Placeholder scan:** none — every step carries code or an exact command.
- **Type consistency:** `onCue(text, startTime, endTime)` defined Task 4, consumed Task 6; `renderPopup(container, payload, explanation, onResume, onSave)` grows in Tasks 4→5 in order; `VocabularyEntry`/`listVocabulary` defined Task 5, consumed Task 8. Consistent.
