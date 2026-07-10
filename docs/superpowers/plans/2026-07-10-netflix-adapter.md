# Netflix Adapter & Dual-Subtitle Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chrome extension (Manifest V3) that detects a Netflix watch page, extracts subtitle tracks, renders a dual-subtitle overlay synced to playback with clickable words, and pauses the video on word click showing a stub explanation popup — no backend yet.

**Architecture:** Two content scripts. A `MAIN`-world `page-bridge.ts` is the only file that touches Netflix's internals (monkey-patches `JSON.parse`/`JSON.stringify` to intercept manifest data, polls `data-videoid`) and relays raw data via `window.postMessage`. An `ISOLATED`-world `content-script.ts` owns all product logic: track selection, cue-driven overlay rendering, and word-click handling. Every non-trivial piece of logic is a small, pure, independently tested function; the two content-script files are thin wiring on top of them.

**Tech Stack:** TypeScript, Vite + `@crxjs/vite-plugin`, Vitest + jsdom for tests.

## Global Constraints

- Manifest V3 only; extension is a thin view layer — no caching, no LLM calls, no business logic beyond this slice's stub (Execution §1).
- `page-bridge.ts` is the only file allowed to touch `JSON.parse`/`JSON.stringify` patching, `window.postMessage`, or any Netflix-internal object — every other file talks only to the adapter's stable interface (Execution §5).
- Target-language tokenization is naive whitespace splitting only — no multi-word phrase grouping in this slice (Execution §1).
- Video must never auto-resume after a word-click pause — only explicit user action resumes it (Directive §6).
- No network calls beyond fetching a track's own WebVTT file — no `/lookup` backend call exists yet; `explainLookup` is a stub (spec: Explicitly out of scope).
- Manual smoke test only for the live Netflix DOM — no live-Netflix CI (spec: Testing).

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.config.ts`
- Create: `src/content/page-bridge.ts` (placeholder)
- Create: `src/content/content-script.ts` (placeholder)

**Interfaces:**
- Produces: a working `npm run build` that emits `dist/manifest.json` with two content script entries on `https://www.netflix.com/watch/*`, and a working `npm test` runner (Vitest + jsdom) that later tasks add specs to.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "studium",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@types/chrome": "^0.0.270",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome"]
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `manifest.config.ts`**

```typescript
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Studium',
  version: '0.1.0',
  description: 'Pause qualquer cena da Netflix, clique numa palavra, e receba uma explicação de verdade.',
  content_scripts: [
    {
      matches: ['https://www.netflix.com/watch/*'],
      js: ['src/content/page-bridge.ts'],
      world: 'MAIN',
      run_at: 'document_start',
    },
    {
      matches: ['https://www.netflix.com/watch/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
});
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

- [ ] **Step 6: Create placeholder content scripts**

`src/content/page-bridge.ts`:

```typescript
console.log('[studium] page-bridge loaded');
```

`src/content/content-script.ts`:

```typescript
console.log('[studium] content-script loaded');
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: exits 0, creates `dist/manifest.json`. Verify with:
`grep -c "netflix.com/watch" dist/manifest.json`
Expected output: `2` (both content script entries reference the match pattern).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts manifest.config.ts src/content/page-bridge.ts src/content/content-script.ts .gitignore
git commit -m "chore: scaffold Vite + CRXJS extension project"
```

Before committing, create `.gitignore` with at least `node_modules/` and `dist/`.

---

## Task 2: Shared types and Netflix profile constants

**Files:**
- Create: `src/adapter/types.ts`
- Create: `src/adapter/netflix-profiles.ts`

**Interfaces:**
- Produces:
  - `RawNetflixTrack`, `RawManifestResult`, `SubtitleTrack`, `SelectedTracks`, `TargetLang`, `LookupPayload`, `Explanation` (types, `src/adapter/types.ts`)
  - `WEBVTT_FMT: string`, `NETFLIX_PROFILES: string[]` (`src/adapter/netflix-profiles.ts`)

This task is pure type/constant declarations with no branching logic, so there is nothing for a unit test to exercise — verification is `tsc --noEmit` compiling cleanly, checked at the end of Task 15 and CI-equivalent to a test for this file.

- [ ] **Step 1: Create `src/adapter/types.ts`**

```typescript
export interface RawNetflixTrack {
  id: string;
  language: string;
  languageDescription: string;
  isForcedNarrative: boolean;
  isNoneTrack: boolean;
  rawTrackType: string;
  downloadables?: Record<string, { urls: { url: string }[] }>;
}

export interface RawManifestResult {
  movieId: number;
  textTracks: RawNetflixTrack[];
}

export interface SubtitleTrack {
  id: string;
  language: string;
  languageDescription: string;
  webvttUrl: string;
  isClosedCaptions: boolean;
}

export interface SelectedTracks {
  target: SubtitleTrack | null;
  native: SubtitleTrack | null;
}

export type TargetLang = 'en' | 'it';

export interface LookupPayload {
  videoId: number;
  timestampBucket: number;
  sentence: string;
  clickedSpan: string;
  targetLang: TargetLang;
  nativeLang: 'pt-BR';
}

export interface Explanation {
  translation: string;
  contextualExplanation: string;
  isIdiom: boolean;
  morphologyNote: string | null;
}
```

- [ ] **Step 2: Create `src/adapter/netflix-profiles.ts`**

```typescript
export const WEBVTT_FMT = 'webvtt-lssdh-ios8';

export const NETFLIX_PROFILES = [
  'heaac-2-dash',
  'heaac-2hq-dash',
  'playready-h264mpl30-dash',
  'playready-h264mpl31-dash',
  'playready-h264hpl30-dash',
  'playready-h264hpl31-dash',
  'vp9-profile0-L30-dash-cenc',
  'vp9-profile0-L31-dash-cenc',
  'dfxp-ls-sdh',
  'simplesdh',
  'nflx-cmisc',
  'BIF240',
  'BIF320',
];
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/adapter/types.ts src/adapter/netflix-profiles.ts
git commit -m "feat: add adapter types and Netflix profile constants"
```

---

## Task 3: Manifest response parsing (page-bridge pure logic)

**Files:**
- Create: `src/content/manifest-parsing.ts`
- Test: `tests/manifest-parsing.test.ts`

**Interfaces:**
- Consumes: `WEBVTT_FMT`, `NETFLIX_PROFILES` (`src/adapter/netflix-profiles.ts`); `RawManifestResult` (`src/adapter/types.ts`)
- Produces: `injectWebvttProfile(value: unknown): unknown`, `extractManifestPayload(value: unknown): RawManifestResult | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/manifest-parsing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { injectWebvttProfile, extractManifestPayload } from '../src/content/manifest-parsing';

describe('injectWebvttProfile', () => {
  it('adds webvtt-lssdh-ios8 to a profiles array found by key name', () => {
    const value = { params: { profiles: ['heaac-2-dash', 'simplesdh'] } };
    injectWebvttProfile(value);
    expect(value.params.profiles).toContain('webvtt-lssdh-ios8');
  });

  it('finds a profiles array by content when the key is not literally "profiles"', () => {
    const value = { req: { renamedProfiles: ['dfxp-ls-sdh', 'BIF240'] } };
    injectWebvttProfile(value);
    expect(value.req.renamedProfiles).toContain('webvtt-lssdh-ios8');
  });

  it('does not add a duplicate if already present', () => {
    const value = { profiles: ['webvtt-lssdh-ios8', 'simplesdh'] };
    injectWebvttProfile(value);
    expect(value.profiles.filter((p) => p === 'webvtt-lssdh-ios8')).toHaveLength(1);
  });

  it('leaves the value unchanged when no profiles array exists', () => {
    const value = { unrelated: 'data' };
    const result = injectWebvttProfile(value);
    expect(result).toEqual({ unrelated: 'data' });
  });
});

describe('extractManifestPayload', () => {
  it('extracts movieId and textTracks when present', () => {
    const value = { result: { movieId: 12345, textTracks: [{ id: 't1' }] } };
    expect(extractManifestPayload(value)).toEqual({ movieId: 12345, textTracks: [{ id: 't1' }] });
  });

  it('returns null when result is missing', () => {
    expect(extractManifestPayload({ somethingElse: true })).toBeNull();
  });

  it('returns null when textTracks is missing', () => {
    expect(extractManifestPayload({ result: { movieId: 1 } })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(extractManifestPayload(null)).toBeNull();
    expect(extractManifestPayload('string')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/manifest-parsing.test.ts`
Expected: FAIL — `Cannot find module '../src/content/manifest-parsing'`.

- [ ] **Step 3: Implement `src/content/manifest-parsing.ts`**

```typescript
import { NETFLIX_PROFILES, WEBVTT_FMT } from '../adapter/netflix-profiles';
import type { RawManifestResult } from '../adapter/types';

function isProfilesArray(key: string, value: unknown[]): boolean {
  return key === 'profiles' || value.some((item) => NETFLIX_PROFILES.includes(item as string));
}

function findProfilesArray(obj: unknown): unknown[] | null {
  if (obj === null || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    if (Array.isArray(value) && isProfilesArray(key, value)) {
      return value;
    }
    if (typeof value === 'object') {
      const found = findProfilesArray(value);
      if (found) return found;
    }
  }
  return null;
}

export function injectWebvttProfile(value: unknown): unknown {
  const profiles = findProfilesArray(value);
  if (profiles && !profiles.includes(WEBVTT_FMT)) {
    profiles.unshift(WEBVTT_FMT);
  }
  return value;
}

export function extractManifestPayload(value: unknown): RawManifestResult | null {
  if (value === null || typeof value !== 'object') return null;
  const result = (value as Record<string, unknown>).result;
  if (
    result &&
    typeof result === 'object' &&
    typeof (result as Record<string, unknown>).movieId === 'number' &&
    Array.isArray((result as Record<string, unknown>).textTracks)
  ) {
    return result as unknown as RawManifestResult;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/manifest-parsing.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/content/manifest-parsing.ts tests/manifest-parsing.test.ts
git commit -m "feat: add Netflix manifest parsing (profile injection + track extraction)"
```

---

## Task 4: Video ID extraction from the DOM

**Files:**
- Create: `src/content/video-id.ts`
- Test: `tests/video-id.test.ts`

**Interfaces:**
- Produces: `readVideoIdFromDom(doc: Document): number | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/video-id.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readVideoIdFromDom } from '../src/content/video-id';

describe('readVideoIdFromDom', () => {
  it('reads a numeric video id from a data-videoid attribute', () => {
    document.body.innerHTML = '<div data-videoid="80192098"></div>';
    expect(readVideoIdFromDom(document)).toBe(80192098);
  });

  it('returns null when no element has data-videoid', () => {
    document.body.innerHTML = '<div></div>';
    expect(readVideoIdFromDom(document)).toBeNull();
  });

  it('returns null when the attribute is not a valid number', () => {
    document.body.innerHTML = '<div data-videoid="not-a-number"></div>';
    expect(readVideoIdFromDom(document)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/video-id.test.ts`
Expected: FAIL — `Cannot find module '../src/content/video-id'`.

- [ ] **Step 3: Implement `src/content/video-id.ts`**

```typescript
export function readVideoIdFromDom(doc: Document): number | null {
  const elem = doc.querySelector('*[data-videoid]');
  if (!elem) return null;
  const raw = (elem as HTMLElement).dataset.videoid;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/video-id.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/content/video-id.ts tests/video-id.test.ts
git commit -m "feat: add video id extraction from data-videoid attribute"
```

---

## Task 5: Bridge message parsing (isolated-world side)

**Files:**
- Create: `src/content/bridge-messages.ts`
- Test: `tests/bridge-messages.test.ts`

**Interfaces:**
- Consumes: `RawNetflixTrack` (`src/adapter/types.ts`)
- Produces: `BridgeMessage` (type), `parseBridgeMessage(event: MessageEvent, expectedWindow: Window): BridgeMessage | null`

- [ ] **Step 1: Write the failing tests**

Create `tests/bridge-messages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseBridgeMessage } from '../src/content/bridge-messages';

function makeEvent(data: unknown, source: unknown): MessageEvent {
  return { data, source } as MessageEvent;
}

describe('parseBridgeMessage', () => {
  it('parses a valid tracks message from the expected window', () => {
    const msg = parseBridgeMessage(
      makeEvent({ type: 'sla-copilot:tracks', movieId: 42, textTracks: [] }, window),
      window
    );
    expect(msg).toEqual({ type: 'sla-copilot:tracks', movieId: 42, textTracks: [] });
  });

  it('parses a valid videoid message', () => {
    const msg = parseBridgeMessage(makeEvent({ type: 'sla-copilot:videoid', videoId: 7 }, window), window);
    expect(msg).toEqual({ type: 'sla-copilot:videoid', videoId: 7 });
  });

  it('rejects a message from an unexpected source', () => {
    const otherWindow = {} as Window;
    const msg = parseBridgeMessage(makeEvent({ type: 'sla-copilot:videoid', videoId: 7 }, otherWindow), window);
    expect(msg).toBeNull();
  });

  it('rejects a message with an unknown type', () => {
    const msg = parseBridgeMessage(makeEvent({ type: 'other:thing' }, window), window);
    expect(msg).toBeNull();
  });

  it('rejects malformed data', () => {
    expect(parseBridgeMessage(makeEvent(null, window), window)).toBeNull();
    expect(parseBridgeMessage(makeEvent('a string', window), window)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bridge-messages.test.ts`
Expected: FAIL — `Cannot find module '../src/content/bridge-messages'`.

- [ ] **Step 3: Implement `src/content/bridge-messages.ts`**

```typescript
import type { RawNetflixTrack } from '../adapter/types';

export type BridgeMessage =
  | { type: 'sla-copilot:tracks'; movieId: number; textTracks: RawNetflixTrack[] }
  | { type: 'sla-copilot:videoid'; videoId: number | null };

export function parseBridgeMessage(event: MessageEvent, expectedWindow: Window): BridgeMessage | null {
  if (event.source !== expectedWindow) return null;
  const data = event.data;
  if (!data || typeof data !== 'object') return null;

  if (data.type === 'sla-copilot:tracks' && typeof data.movieId === 'number' && Array.isArray(data.textTracks)) {
    return { type: 'sla-copilot:tracks', movieId: data.movieId, textTracks: data.textTracks };
  }
  if (data.type === 'sla-copilot:videoid' && (typeof data.videoId === 'number' || data.videoId === null)) {
    return { type: 'sla-copilot:videoid', videoId: data.videoId };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bridge-messages.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/content/bridge-messages.ts tests/bridge-messages.test.ts
git commit -m "feat: add bridge message parsing with source validation"
```

---

## Task 6: Track extraction and selection

**Files:**
- Create: `src/adapter/track-selection.ts`
- Create: `tests/fixtures/manifest-sample.json`
- Test: `tests/track-selection.test.ts`

**Interfaces:**
- Consumes: `WEBVTT_FMT` (`src/adapter/netflix-profiles.ts`); `RawNetflixTrack`, `SubtitleTrack`, `SelectedTracks` (`src/adapter/types.ts`)
- Produces: `extractUsableTracks(rawTracks: RawNetflixTrack[]): SubtitleTrack[]`, `selectTracks(tracks: SubtitleTrack[]): SelectedTracks`

- [ ] **Step 1: Create the manifest fixture**

Create `tests/fixtures/manifest-sample.json`:

```json
{
  "movieId": 80192098,
  "textTracks": [
    {
      "id": "track-en",
      "language": "en",
      "languageDescription": "English",
      "isForcedNarrative": false,
      "isNoneTrack": false,
      "rawTrackType": "subtitles",
      "downloadables": {
        "webvtt-lssdh-ios8": { "urls": [{ "url": "https://example.com/en.vtt" }] }
      }
    },
    {
      "id": "track-it",
      "language": "it",
      "languageDescription": "Italian",
      "isForcedNarrative": false,
      "isNoneTrack": false,
      "rawTrackType": "subtitles",
      "downloadables": {
        "webvtt-lssdh-ios8": { "urls": [{ "url": "https://example.com/it.vtt" }] }
      }
    },
    {
      "id": "track-ptbr",
      "language": "pt-BR",
      "languageDescription": "Portuguese (Brazil)",
      "isForcedNarrative": false,
      "isNoneTrack": false,
      "rawTrackType": "subtitles",
      "downloadables": {
        "webvtt-lssdh-ios8": { "urls": [{ "url": "https://example.com/pt-br.vtt" }] }
      }
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/track-selection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractUsableTracks, selectTracks } from '../src/adapter/track-selection';
import type { RawNetflixTrack } from '../src/adapter/types';
import fixture from './fixtures/manifest-sample.json';

describe('extractUsableTracks', () => {
  it('extracts every track that has a webvtt downloadable', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    expect(tracks.map((t) => t.language)).toEqual(['en', 'it', 'pt-BR']);
  });

  it('drops forced-narrative and none tracks', () => {
    const raw: RawNetflixTrack[] = [
      {
        id: 'forced',
        language: 'en',
        languageDescription: 'English [Forced]',
        isForcedNarrative: true,
        isNoneTrack: false,
        rawTrackType: 'subtitles',
        downloadables: { 'webvtt-lssdh-ios8': { urls: [{ url: 'https://x/forced.vtt' }] } },
      },
      {
        id: 'none',
        language: 'none',
        languageDescription: 'Off',
        isForcedNarrative: false,
        isNoneTrack: true,
        rawTrackType: 'subtitles',
      },
    ];
    expect(extractUsableTracks(raw)).toEqual([]);
  });

  it('drops tracks without a webvtt downloadable', () => {
    const raw: RawNetflixTrack[] = [
      {
        id: 'ttml-only',
        language: 'fr',
        languageDescription: 'French',
        isForcedNarrative: false,
        isNoneTrack: false,
        rawTrackType: 'subtitles',
        downloadables: { 'dfxp-ls-sdh': { urls: [{ url: 'https://x/fr.dfxp' }] } },
      },
    ];
    expect(extractUsableTracks(raw)).toEqual([]);
  });
});

describe('selectTracks', () => {
  it('prefers English over Italian when both are available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]);
    const selected = selectTracks(tracks);
    expect(selected.target?.language).toBe('en');
    expect(selected.native?.language).toBe('pt-BR');
  });

  it('falls back to Italian when English is unavailable', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter((t) => t.language !== 'en');
    expect(selectTracks(tracks).target?.language).toBe('it');
  });

  it('returns a null target when neither English nor Italian is available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter(
      (t) => t.language !== 'en' && t.language !== 'it'
    );
    expect(selectTracks(tracks).target).toBeNull();
  });

  it('returns a null native track when no Portuguese track is available', () => {
    const tracks = extractUsableTracks(fixture.textTracks as RawNetflixTrack[]).filter((t) => t.language !== 'pt-BR');
    expect(selectTracks(tracks).native).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/track-selection.test.ts`
Expected: FAIL — `Cannot find module '../src/adapter/track-selection'`.

- [ ] **Step 4: Implement `src/adapter/track-selection.ts`**

```typescript
import { WEBVTT_FMT } from './netflix-profiles';
import type { RawNetflixTrack, SubtitleTrack, SelectedTracks, TargetLang } from './types';

const TARGET_LANG_PREFERENCE: TargetLang[] = ['en', 'it'];

export function extractUsableTracks(rawTracks: RawNetflixTrack[]): SubtitleTrack[] {
  const usable: SubtitleTrack[] = [];
  for (const track of rawTracks) {
    if (track.isForcedNarrative || track.isNoneTrack) continue;
    if (!track.downloadables) continue;
    const webvtt = track.downloadables[WEBVTT_FMT];
    if (!webvtt || !webvtt.urls || !webvtt.urls[0] || !webvtt.urls[0].url) continue;

    usable.push({
      id: track.id,
      language: track.language,
      languageDescription: track.languageDescription,
      webvttUrl: webvtt.urls[0].url,
      isClosedCaptions: track.rawTrackType === 'closedcaptions',
    });
  }
  return usable;
}

function findByLanguagePrefix(tracks: SubtitleTrack[], prefix: string): SubtitleTrack | null {
  return tracks.find((t) => t.language.toLowerCase().startsWith(prefix)) ?? null;
}

export function selectTracks(tracks: SubtitleTrack[]): SelectedTracks {
  let target: SubtitleTrack | null = null;
  for (const lang of TARGET_LANG_PREFERENCE) {
    target = findByLanguagePrefix(tracks, lang);
    if (target) break;
  }
  return {
    target,
    native: findByLanguagePrefix(tracks, 'pt'),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/track-selection.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/adapter/track-selection.ts tests/track-selection.test.ts tests/fixtures/manifest-sample.json
git commit -m "feat: add subtitle track extraction and target/native selection"
```

---

## Task 7: Cue text tokenization

**Files:**
- Create: `src/overlay/tokenize.ts`
- Test: `tests/tokenize.test.ts`

**Interfaces:**
- Produces: `tokenizeCueText(text: string): string[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokenize.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tokenize.test.ts`
Expected: FAIL — `Cannot find module '../src/overlay/tokenize'`.

- [ ] **Step 3: Implement `src/overlay/tokenize.ts`**

```typescript
export function tokenizeCueText(text: string): string[] {
  return text
    .replace(/\n/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tokenize.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/overlay/tokenize.ts tests/tokenize.test.ts
git commit -m "feat: add naive whitespace cue tokenization"
```

---

## Task 8: Overlay line rendering

**Files:**
- Create: `src/overlay/overlay.ts`
- Test: `tests/overlay.test.ts`

**Interfaces:**
- Consumes: `tokenizeCueText(text: string): string[]` (`src/overlay/tokenize.ts`)
- Produces: `renderOverlayLine(container: HTMLElement, cueText: string, onTokenClick: (token: string, sentence: string) => void): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/overlay.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderOverlayLine } from '../src/overlay/overlay';

describe('renderOverlayLine', () => {
  it('renders one clickable span per token', () => {
    const container = document.createElement('div');
    renderOverlayLine(container, 'be into someone', () => {});
    const spans = container.querySelectorAll('span.sla-copilot-token');
    expect(spans).toHaveLength(3);
    expect(spans[1].textContent).toBe('into');
  });

  it('calls onTokenClick with the clicked token and full sentence', () => {
    const container = document.createElement('div');
    const onTokenClick = vi.fn();
    renderOverlayLine(container, 'be into someone', onTokenClick);
    const spans = container.querySelectorAll('span.sla-copilot-token');
    (spans[1] as HTMLElement).click();
    expect(onTokenClick).toHaveBeenCalledWith('into', 'be into someone');
  });

  it('clears previous content on re-render', () => {
    const container = document.createElement('div');
    renderOverlayLine(container, 'first line', () => {});
    renderOverlayLine(container, 'second', () => {});
    expect(container.querySelectorAll('span.sla-copilot-token')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/overlay.test.ts`
Expected: FAIL — `Cannot find module '../src/overlay/overlay'`.

- [ ] **Step 3: Implement `src/overlay/overlay.ts`**

```typescript
import { tokenizeCueText } from './tokenize';

export function renderOverlayLine(
  container: HTMLElement,
  cueText: string,
  onTokenClick: (token: string, sentence: string) => void
): void {
  container.innerHTML = '';
  const tokens = tokenizeCueText(cueText);
  for (const token of tokens) {
    const span = document.createElement('span');
    span.className = 'sla-copilot-token';
    span.textContent = token;
    span.addEventListener('click', () => onTokenClick(token, cueText));
    container.appendChild(span);
    container.appendChild(document.createTextNode(' '));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/overlay.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/overlay/overlay.ts tests/overlay.test.ts
git commit -m "feat: render subtitle line as clickable word spans"
```

---

## Task 9: Stub explanation lookup

**Files:**
- Create: `src/lookup/explain-lookup.ts`
- Test: `tests/explain-lookup.test.ts`

**Interfaces:**
- Consumes: `LookupPayload`, `Explanation` (`src/adapter/types.ts`)
- Produces: `explainLookup(payload: LookupPayload): Promise<Explanation>`

- [ ] **Step 1: Write the failing test**

Create `tests/explain-lookup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { explainLookup } from '../src/lookup/explain-lookup';
import type { LookupPayload } from '../src/adapter/types';

describe('explainLookup', () => {
  it('resolves a placeholder explanation without any network call', async () => {
    const payload: LookupPayload = {
      videoId: 80192098,
      timestampBucket: 12.5,
      sentence: 'be into someone',
      clickedSpan: 'into',
      targetLang: 'en',
      nativeLang: 'pt-BR',
    };
    const result = await explainLookup(payload);
    expect(result.translation).toBe('into');
    expect(result.contextualExplanation).toContain('into');
    expect(result.isIdiom).toBe(false);
    expect(result.morphologyNote).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explain-lookup.test.ts`
Expected: FAIL — `Cannot find module '../src/lookup/explain-lookup'`.

- [ ] **Step 3: Implement `src/lookup/explain-lookup.ts`**

```typescript
import type { LookupPayload, Explanation } from '../adapter/types';

export function explainLookup(payload: LookupPayload): Promise<Explanation> {
  return Promise.resolve({
    translation: payload.clickedSpan,
    contextualExplanation: `(stub) explicação de "${payload.clickedSpan}" ainda não conectada ao backend.`,
    isIdiom: false,
    morphologyNote: null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explain-lookup.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/lookup/explain-lookup.ts tests/explain-lookup.test.ts
git commit -m "feat: add stub explanation lookup (no backend yet)"
```

---

## Task 10: Popup and status message rendering

**Files:**
- Create: `src/overlay/popup.ts`
- Create: `src/overlay/status-message.ts`
- Test: `tests/popup.test.ts`
- Test: `tests/status-message.test.ts`

**Interfaces:**
- Consumes: `LookupPayload`, `Explanation` (`src/adapter/types.ts`)
- Produces: `renderPopup(container: HTMLElement, payload: LookupPayload, explanation: Explanation): HTMLElement`, `renderStatusMessage(container: HTMLElement, message: string): void`

- [ ] **Step 1: Write the failing popup test**

Create `tests/popup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderPopup } from '../src/overlay/popup';
import type { LookupPayload, Explanation } from '../src/adapter/types';

const payload: LookupPayload = {
  videoId: 1,
  timestampBucket: 0,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt-BR',
};

const explanation: Explanation = {
  translation: 'into',
  contextualExplanation: '(stub) explicação de "into"',
  isIdiom: false,
  morphologyNote: null,
};

describe('renderPopup', () => {
  it('renders the clicked word and explanation text', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation);
    expect(container.querySelector('.sla-copilot-popup-word')?.textContent).toBe('into');
    expect(container.querySelector('.sla-copilot-popup-explanation')?.textContent).toBe(
      '(stub) explicação de "into"'
    );
  });

  it('includes a save button', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation);
    expect(container.querySelector('.sla-copilot-popup-save')).not.toBeNull();
  });

  it('clears previous popup content on re-render', () => {
    const container = document.createElement('div');
    renderPopup(container, payload, explanation);
    renderPopup(container, payload, explanation);
    expect(container.querySelectorAll('.sla-copilot-popup')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Write the failing status message test**

Create `tests/status-message.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderStatusMessage } from '../src/overlay/status-message';

describe('renderStatusMessage', () => {
  it('renders the message text', () => {
    const container = document.createElement('div');
    renderStatusMessage(container, 'idioma não disponível para este título');
    expect(container.querySelector('.sla-copilot-status')?.textContent).toBe(
      'idioma não disponível para este título'
    );
  });

  it('clears previous content on re-render', () => {
    const container = document.createElement('div');
    renderStatusMessage(container, 'first');
    renderStatusMessage(container, 'second');
    expect(container.querySelectorAll('.sla-copilot-status')).toHaveLength(1);
    expect(container.textContent).toBe('second');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/popup.test.ts tests/status-message.test.ts`
Expected: FAIL — both modules missing.

- [ ] **Step 4: Implement `src/overlay/popup.ts`**

```typescript
import type { LookupPayload, Explanation } from '../adapter/types';

export function renderPopup(container: HTMLElement, payload: LookupPayload, explanation: Explanation): HTMLElement {
  container.innerHTML = '';
  const popup = document.createElement('div');
  popup.className = 'sla-copilot-popup';

  const wordElem = document.createElement('div');
  wordElem.className = 'sla-copilot-popup-word';
  wordElem.textContent = payload.clickedSpan;

  const explanationElem = document.createElement('div');
  explanationElem.className = 'sla-copilot-popup-explanation';
  explanationElem.textContent = explanation.contextualExplanation;

  const saveButton = document.createElement('button');
  saveButton.className = 'sla-copilot-popup-save';
  saveButton.textContent = 'salvar';

  popup.append(wordElem, explanationElem, saveButton);
  container.appendChild(popup);
  return popup;
}
```

- [ ] **Step 5: Implement `src/overlay/status-message.ts`**

```typescript
export function renderStatusMessage(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const elem = document.createElement('div');
  elem.className = 'sla-copilot-status';
  elem.textContent = message;
  container.appendChild(elem);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/popup.test.ts tests/status-message.test.ts`
Expected: PASS, 5 tests total.

- [ ] **Step 7: Commit**

```bash
git add src/overlay/popup.ts src/overlay/status-message.ts tests/popup.test.ts tests/status-message.test.ts
git commit -m "feat: render explanation popup and status/fallback messages"
```

---

## Task 11: Cue listener (native `<track>` as timing engine)

**Files:**
- Create: `src/adapter/cue-listener.ts`
- Test: `tests/cue-listener.test.ts`

**Interfaces:**
- Consumes: `SubtitleTrack` (`src/adapter/types.ts`)
- Produces: `attachCueListener(video: HTMLVideoElement, track: SubtitleTrack, onCue: (cueText: string, startTime: number) => void): HTMLTrackElement`

- [ ] **Step 1: Write the failing tests**

Create `tests/cue-listener.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { attachCueListener } from '../src/adapter/cue-listener';
import type { SubtitleTrack } from '../src/adapter/types';

const sampleTrack: SubtitleTrack = {
  id: 'track-en',
  language: 'en',
  languageDescription: 'English',
  webvttUrl: 'https://example.com/en.vtt',
  isClosedCaptions: false,
};

describe('attachCueListener', () => {
  it('creates a hidden track element with the track URL and appends it to the video', () => {
    const video = document.createElement('video');
    const trackElem = attachCueListener(video, sampleTrack, () => {});
    expect(trackElem.tagName).toBe('TRACK');
    expect(trackElem.src).toBe(sampleTrack.webvttUrl);
    expect(trackElem.srclang).toBe('en');
    expect(trackElem.track.mode).toBe('hidden');
    expect(video.contains(trackElem)).toBe(true);
  });

  it('calls onCue with the active cue text and start time on cuechange', () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = attachCueListener(video, sampleTrack, onCue);

    const fakeCue = { text: 'be into someone', startTime: 12.5 };
    Object.defineProperty(trackElem.track, 'activeCues', {
      value: [fakeCue],
      configurable: true,
    });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).toHaveBeenCalledWith('be into someone', 12.5);
  });

  it('does not call onCue when there are no active cues', () => {
    const video = document.createElement('video');
    const onCue = vi.fn();
    const trackElem = attachCueListener(video, sampleTrack, onCue);

    Object.defineProperty(trackElem.track, 'activeCues', { value: [], configurable: true });
    trackElem.dispatchEvent(new Event('cuechange'));

    expect(onCue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cue-listener.test.ts`
Expected: FAIL — `Cannot find module '../src/adapter/cue-listener'`.

- [ ] **Step 3: Implement `src/adapter/cue-listener.ts`**

```typescript
import type { SubtitleTrack } from './types';

export function attachCueListener(
  video: HTMLVideoElement,
  track: SubtitleTrack,
  onCue: (cueText: string, startTime: number) => void
): HTMLTrackElement {
  const trackElem = document.createElement('track');
  trackElem.kind = 'subtitles';
  trackElem.src = track.webvttUrl;
  trackElem.srclang = track.language;
  trackElem.label = track.languageDescription;
  video.appendChild(trackElem);
  trackElem.track.mode = 'hidden';

  trackElem.addEventListener('cuechange', () => {
    const activeCues = trackElem.track.activeCues;
    if (!activeCues || activeCues.length === 0) return;
    const cue = activeCues[0] as unknown as { text: string; startTime: number };
    onCue(cue.text, cue.startTime);
  });

  return trackElem;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cue-listener.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapter/cue-listener.ts tests/cue-listener.test.ts
git commit -m "feat: attach hidden native track as cue timing engine"
```

---

## Task 12: Word-click orchestration

**Files:**
- Create: `src/content/orchestrate-word-click.ts`
- Test: `tests/orchestrate-word-click.test.ts`

**Interfaces:**
- Consumes: `explainLookup` (`src/lookup/explain-lookup.ts`), `renderPopup` (`src/overlay/popup.ts`), `LookupPayload` (`src/adapter/types.ts`)
- Produces: `handleWordClick(video: HTMLVideoElement, popupContainer: HTMLElement, payload: LookupPayload): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `tests/orchestrate-word-click.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleWordClick } from '../src/content/orchestrate-word-click';
import type { LookupPayload } from '../src/adapter/types';

const payload: LookupPayload = {
  videoId: 1,
  timestampBucket: 12.5,
  sentence: 'be into someone',
  clickedSpan: 'into',
  targetLang: 'en',
  nativeLang: 'pt-BR',
};

describe('handleWordClick', () => {
  it('pauses the video immediately and then renders the popup', async () => {
    const video = document.createElement('video');
    const pauseSpy = vi.spyOn(video, 'pause');
    const container = document.createElement('div');

    await handleWordClick(video, container, payload);

    expect(pauseSpy).toHaveBeenCalled();
    expect(container.querySelector('.sla-copilot-popup-word')?.textContent).toBe('into');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/orchestrate-word-click.test.ts`
Expected: FAIL — `Cannot find module '../src/content/orchestrate-word-click'`.

- [ ] **Step 3: Implement `src/content/orchestrate-word-click.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/orchestrate-word-click.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/content/orchestrate-word-click.ts tests/orchestrate-word-click.test.ts
git commit -m "feat: orchestrate pause-then-explain on word click"
```

---

## Task 13: Wire the MAIN-world page bridge

**Files:**
- Modify: `src/content/page-bridge.ts`

**Interfaces:**
- Consumes: `injectWebvttProfile`, `extractManifestPayload` (`src/content/manifest-parsing.ts`); `readVideoIdFromDom` (`src/content/video-id.ts`)
- Produces: side effects only (patched `JSON.parse`/`JSON.stringify`, periodic `window.postMessage` of `sla-copilot:tracks` / `sla-copilot:videoid`) — no exported functions, so no unit test. Verified via build + the manual smoke test in Task 15.

- [ ] **Step 1: Replace the placeholder with the real bridge**

Replace the full contents of `src/content/page-bridge.ts`:

```typescript
import { injectWebvttProfile, extractManifestPayload } from './manifest-parsing';
import { readVideoIdFromDom } from './video-id';

const POLL_INTERVAL_MS = 500;

const originalStringify = JSON.stringify;
JSON.stringify = function stringify(...args: Parameters<typeof JSON.stringify>) {
  if (args[0] !== undefined) {
    injectWebvttProfile(args[0]);
  }
  return originalStringify.apply(this, args);
} as typeof JSON.stringify;

const originalParse = JSON.parse;
JSON.parse = function parse(...args: Parameters<typeof JSON.parse>) {
  const value = originalParse.apply(this, args);
  const manifest = extractManifestPayload(value);
  if (manifest) {
    window.postMessage(
      { type: 'sla-copilot:tracks', movieId: manifest.movieId, textTracks: manifest.textTracks },
      window.location.origin
    );
  }
  return value;
} as typeof JSON.parse;

let lastVideoId: number | null = null;
setInterval(() => {
  const videoId = readVideoIdFromDom(document);
  if (videoId !== lastVideoId) {
    lastVideoId = videoId;
    window.postMessage({ type: 'sla-copilot:videoid', videoId }, window.location.origin);
  }
}, POLL_INTERVAL_MS);
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/content/page-bridge.ts
git commit -m "feat: wire page-bridge to intercept Netflix manifest and video id"
```

---

## Task 14: Wire the ISOLATED-world content script

**Files:**
- Modify: `src/content/content-script.ts`

**Interfaces:**
- Consumes: `parseBridgeMessage` (`src/content/bridge-messages.ts`); `extractUsableTracks`, `selectTracks` (`src/adapter/track-selection.ts`); `attachCueListener` (`src/adapter/cue-listener.ts`); `renderOverlayLine` (`src/overlay/overlay.ts`); `renderStatusMessage` (`src/overlay/status-message.ts`); `handleWordClick` (`src/content/orchestrate-word-click.ts`); `RawNetflixTrack`, `LookupPayload` (`src/adapter/types.ts`)
- Produces: side effects only (DOM overlay + popup containers, `message` event listener) — no exported functions, so no unit test. Verified via build + the manual smoke test in Task 15.

- [ ] **Step 1: Replace the placeholder with the real content script**

Replace the full contents of `src/content/content-script.ts`:

```typescript
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

function handleTracks(rawTracks: RawNetflixTrack[]): void {
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
  });

  if (native) {
    attachCueListener(video, native, (cueText) => {
      renderOverlayLine(nativeLine, cueText, () => {});
    });
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
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests across every task pass (37 tests: 8 manifest-parsing + 3 video-id + 5 bridge-messages + 7 track-selection + 4 tokenize + 3 overlay + 1 explain-lookup + 3 popup + 2 status-message + 3 cue-listener + 1 orchestrate-word-click).

- [ ] **Step 4: Commit**

```bash
git add src/content/content-script.ts
git commit -m "feat: wire content script — track selection, overlay, word-click handling"
```

---

## Task 15: Manual smoke test checklist

**Files:**
- Create: `docs/manual-smoke-test.md`

**Interfaces:**
- Produces: a documented manual verification procedure. No automated test — this is the explicit substitute for live-Netflix CI coverage per the spec's Testing section.

- [ ] **Step 1: Create `docs/manual-smoke-test.md`**

```markdown
# Manual Smoke Test — Netflix Adapter

Run this against a real Netflix account before any release that touches
`src/content/`, `src/adapter/`, or `manifest.config.ts`. Not run in CI —
requires an authenticated Netflix session.

## Setup

1. `npm run build`
2. Load `dist/` as an unpacked extension in Chrome (`chrome://extensions` →
   Developer mode → "Load unpacked").
3. Open DevTools console on `netflix.com` and confirm no errors from
   `page-bridge.ts` or `content-script.ts` at page load.

## Checklist

- [ ] Open a title known to have English (or Italian) and Portuguese (Brazil)
      subtitle tracks. Confirm the console logs no uncaught exceptions.
- [ ] Confirm the target-language line (top) and native pt-BR line (bottom)
      both render over the player and update as the video plays.
- [ ] Click a word in the target line. Confirm the video pauses
      immediately (no visible delay) and a popup appears near the word
      showing the clicked word and a stub explanation.
- [ ] Confirm the video does **not** resume on its own — only resumes when
      you explicitly click the video or press space.
- [ ] Open a title with no English or Italian subtitle track available.
      Confirm the overlay shows "idioma não disponível para este título"
      and no clickable overlay appears.
- [ ] Reload the page mid-playback and confirm the overlay re-attaches to
      the new title without a stale overlay from the previous one.
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-smoke-test.md
git commit -m "docs: add manual smoke test checklist for the Netflix adapter"
```

---

## Definition of Done

- `npm run typecheck`, `npm test`, and `npm run build` all pass.
- A developer can load `dist/` as an unpacked extension, open a Netflix
  title, see dual clickable subtitles, click a word, see the video pause
  and a stub popup appear — verified via `docs/manual-smoke-test.md`.
- No file outside `src/content/page-bridge.ts` touches `JSON.parse`,
  `JSON.stringify`, or `window.postMessage` to/from the page's `MAIN`
  world.
