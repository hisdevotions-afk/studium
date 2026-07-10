# Design: Netflix Adapter & Dual-Subtitle Overlay (Studium — slice 1)

## Context

Studium (working name in the founding doc set: "SLA Copilot" — see `README.md`,
`sla-copilot.md`, `sla-copilot_spec.md`, `sla-copilot_plan.md`) is a Chrome
extension that turns Netflix into a language-learning tool for Brazilian
Portuguese speakers. Full product scope is documented in those four files.

That scope spans a Chrome extension, a FastAPI backend, LLM integration,
auth, and freemium billing — too large for one implementation plan. This
spec covers only the **first vertical slice**: the Netflix adapter and dual
subtitle overlay, with no backend. It corresponds to Execution §1 (content
script) and Plan Flow 1 (player load & subtitle injection) plus the
UI-only portion of Flow 2 (word click → pause → popup), stubbed instead of
wired to a real `/lookup` call.

## Scope of this slice

**In scope:**
- Detect a Netflix watch page and extract the current `video_id`
- Extract available subtitle tracks and their WebVTT URLs
- Select target-language (EN/IT) and native (pt-BR) tracks
- Render a dual-subtitle overlay, synced to playback, with the target line
  tokenized into clickable word spans
- On word click: pause the video immediately, show a stub explanation
  popup with the click payload (no network call)
- Graceful fallback when a title has no target-language track, or when
  Netflix's manifest shape no longer parses as expected
- Automated unit tests for the adapter's parsing/selection logic, plus a
  manual smoke-test checklist for the live Netflix DOM

**Explicitly out of scope for this slice** (deferred to later slices):
- Backend, `/lookup` endpoint, real LLM explanations, caching
- Auth, freemium quota, vocabulary saving
- Fine playback controls (speed, seek, phrase repeat) — Plan Flow 4
- AI-generated native-line fallback when no pt-BR track exists — this
  slice simply omits the native line in that case
- Multi-word idiom chunk grouping — target line tokenizes on whitespace
  only (Execution §1 explicitly allows this as a fast-follow)

## How Netflix subtitle extraction works

The browser continuously downloads structured subtitle files (VTT/DFXP)
during playback, the same way tools like Language Reactor read them. There
is no public, stable API for this, so extraction happens in two parts:

1. **Discovering track metadata (languages, URLs).** Netflix's own
   page-context JavaScript calls `JSON.parse` on the response from its
   `/manifest` endpoint, which contains `{result: {movieId, textTracks}}`.
   We monkey-patch `JSON.parse` (and `JSON.stringify`, to inject the
   `webvtt-lssdh-ios8` profile into the outgoing request so Netflix
   responds with WebVTT instead of a TTML/DFXP-like format) — but this
   only works running in the **page's own JS context**, not a MV3 isolated
   content script. Manifest V3 (Chrome 111+) supports this natively via
   `"world": "MAIN"` on a content script entry, so no manual `<script>`
   tag injection is needed.
2. **Downloading the subtitle file.** Once we know a track's WebVTT URL
   from step 1, we `fetch()` it directly — an ordinary network request for
   a `.vtt` file, same category of operation the browser does natively for
   `<track>` elements.

Field names inside the manifest response are Netflix-internal and have
changed before. Rather than hardcode key names, the parser searches the
decoded object for an array containing known Netflix profile strings
(`isSubtitlesProperty` — content-based detection, not key-based), which is
more resilient to renames.

### Rejected approaches

- **`chrome.debugger` / CDP network body interception** — reads response
  bodies without monkey-patching, but requires the `debugger` permission,
  which shows Chrome's "this extension is debugging your browser" banner.
  Unacceptable for a consumer product.
- **Replicating Netflix's private manifest API ourselves** (own headers,
  session/auth handshake) instead of piggybacking on the page's own
  authenticated request — far larger reverse-engineering surface for a
  solo developer, with no durability advantage over approach chosen above.

## Architecture

```
extension/
  manifest.config.ts        # CRXJS config: two content script entries on
                             # netflix.com/watch/* (one MAIN world, one ISOLATED)
  src/
    content/
      page-bridge.ts        # world: "MAIN" — the only file touching Netflix
                             # internals (JSON monkey-patch, data-videoid poll)
      content-script.ts     # world: "ISOLATED" — entrypoint, orchestrates
                             # adapter, overlay, and click handling
    adapter/
      netflix-adapter.ts    # stable interface: getVideoId(), getSubtitleTracks(),
                             # attachCueListener(track, video, cb)
      types.ts
    overlay/
      overlay.ts            # tokenizes cue.text into clickable spans, renders
                             # target + native lines over the player
      popup.ts              # explanation popup (stub content this slice)
    lookup/
      explain-lookup.ts     # explainLookup(payload): Promise<Explanation> —
                             # resolves a placeholder now; real fetch() to
                             # /lookup plugs in here in the next slice, same
                             # call site
  tests/
    adapter.test.ts         # Vitest, mocked manifest fixtures
    fixtures/manifest-sample.json
  docs/manual-smoke-test.md
```

`page-bridge.ts` is the single volatility boundary required by Execution
§5: if Netflix changes its manifest shape or DOM, only this file and the
fixture-driven parser tests should need updates. Nothing else in the
extension touches `window.postMessage`, `JSON.parse`/`stringify`
patching, or Netflix's internal objects directly.

Bridge messages are namespaced (`sla-copilot:tracks`, `sla-copilot:videoid`)
and validated with `event.source === window` on receipt, since `MAIN`-world
`postMessage` broadcasts within the page's own origin and any other script
on the page could otherwise send spoofed messages.

## Data flow

1. `page-bridge` starts polling `document.querySelector('*[data-videoid]')`
   (500ms interval) and installs the `JSON.parse`/`stringify` patches.
2. User plays a title. Netflix's own JS parses the manifest response →
   bridge intercepts, extracts `{movieId, textTracks}`, posts a message.
3. `netflix-adapter` (isolated world) receives it, filters usable tracks
   (drops forced-narrative/none tracks, tracks without a WebVTT
   downloadable), and selects the target track (EN or IT, per the video's
   available tracks) and the native (pt-BR) track if present.
   - No target-language track → show "idioma não disponível para este
     título" and stop (Directive §6).
   - No pt-BR track → proceed with target-only overlay (no native line).
4. Adapter creates one hidden `<track>` element per selected subtitle,
   appended to the `<video>`, `mode = "hidden"` (loads and fires
   `cuechange` without Netflix-style native rendering), and fetches each
   track's WebVTT file to populate it.
5. On `cuechange` for the target track, `overlay.ts` tokenizes
   `cue.text` on whitespace into clickable `<span>`s and renders both
   lines (target + native, native line updated independently from its own
   `cuechange`) over the player.
6. Click on a token → `video.pause()` synchronously, then
   `explainLookup({video_id, timestamp_bucket: activeCue.startTime,
   sentence: cue.text, clicked_span: token, target_lang, native_lang:
   "pt-BR"})` resolves a stub explanation → popup renders near the word.
   Video stays paused until the user explicitly resumes.

## Error handling

- Netflix DOM/manifest shape no longer matches what the parser expects →
  adapter functions return `null`/`[]` rather than throwing; content
  script shows a "temporariamente limitado" notice and leaves Netflix's
  native subtitles untouched, never breaks the page (Directive §6).
- WebVTT fetch fails for a track → same notice, scoped to that track only.
- These are the only failure paths in this slice — no LLM/network calls
  exist yet beyond the WebVTT fetch itself.

## Testing

- **Vitest unit tests** (`tests/adapter.test.ts`) against a manifest
  fixture captured once from a real session
  (`tests/fixtures/manifest-sample.json`): profile-injection into
  `JSON.stringify`, track extraction from `JSON.parse` interception,
  target/native track selection (including the no-target-track and
  no-native-track cases), and cue tokenization. No live Netflix session
  needed.
- **Manual smoke test** (`docs/manual-smoke-test.md`): a checklist run
  locally by the developer against a real, known Netflix title before any
  release touching the adapter — load the title, confirm `video_id`
  extraction, both subtitle lines render, and clicking a word pauses the
  video and shows the stub popup. Not run in CI (requires an
  authenticated Netflix session with a real subscription; CI credentials
  for this are out of scope and disproportionate for a solo-developer
  MVP).
