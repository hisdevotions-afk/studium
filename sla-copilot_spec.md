# Execution Spec: SLA Copilot MVP

## 1. Chrome Extension (Manifest V3)

**Principle:** the extension is a thin view layer. No caching, no LLM calls,
no business logic lives here — only DOM interaction, player control, and
rendering. This is a direct response to Manifest V3 background-script
limitations (Directive/Report §9) and keeps the extension easy to patch
when Netflix changes its player.

### content-script (runs on netflix.com watch pages)
- **Input:** Netflix player DOM, `<video>` element, subtitle track data
- **Output:** rendered dual-subtitle overlay, word-click events forwarded
  to background/backend
- **Responsibilities:**
  - Detect player load / title change
  - Extract `video_id` and available subtitle tracks
  - Disable native Netflix subtitle rendering when overlay is active
    (behind user toggle)
  - Tokenize target-language subtitle line into clickable spans (word or
    pre-identified multi-word chunk — chunk boundaries can initially be
    naive whitespace splitting; phrase-level grouping is a fast-follow,
    not MVP-blocking, since the LLM lookup receives the full sentence as
    context regardless and can correct for it in the explanation)
  - On click: `video.pause()`, then call `background` messaging bridge with
    lookup payload
  - Render explanation popup, vocabulary-save button, "explica melhor"
    escalation button
  - Playback controls: speed slider, phrase-repeat toggle, seek

### background service worker
- **Input:** messages from content script
- **Output:** relayed HTTP calls to backend, response passed back
- **Responsibilities:** stateless relay only — auth token attachment,
  network calls to backend API. No caching or logic here (Manifest V3
  service workers are ephemeral; don't rely on in-memory state surviving).

### popup UI (extension toolbar icon)
- Login/auth status, plan tier display, quick link to saved vocabulary list,
  toggle for original-subtitle fallback

## 2. Backend API (FastAPI, matching existing stack conventions)

Reuse the same stack pattern as prior production work: FastAPI + PostgreSQL
+ asyncpg, deployed on Railway. No need to introduce Celery/Redis for MVP —
lookup latency requirements (sub-2.5s) are handled synchronously; revisit
if volume demands a queue later.

### `POST /lookup`
- **Input:** `{video_id, timestamp_bucket, sentence, clicked_span,
  target_lang: "en"|"it", native_lang: "pt-BR", user_id}`
- **Logic:**
  1. Check `lookup_cache` table for matching
     `(video_id, timestamp_bucket, clicked_span, target_lang)`
  2. If found → return cached response
  3. If not found → check user's daily quota (skip if paid tier)
     - Quota exceeded → return `{type: "upgrade_required"}`
  4. Call LLM (see §4) with sentence + clicked_span + target/native lang +
     pt-BR error-pattern system prompt
  5. Write response to `lookup_cache`
  6. Return `{translation, contextual_explanation, is_idiom, morphology_note}`
- **Output:** JSON per above

### `POST /lookup/deep` (the "explica melhor" escalation path)
- Same input shape, routes to the stronger LLM tier, not cached the same
  way (or cached separately) since it's a deliberate, lower-volume action

### `POST /vocabulary`
- **Input:** `{user_id, word_or_phrase, sentence, video_id, timestamp,
  target_lang}`
- **Logic:** insert into `saved_vocabulary` table
- **Output:** `{success: true}`

### `GET /vocabulary?user_id=`
- Returns the user's saved list, most recent first — needed for the popup
  UI's "saved words" view even without SRS scheduling yet

### Auth
- Reuse existing JWT pattern from prior FastAPI projects. Extension stores
  token after login; background worker attaches it to every request.

## 3. Data Model (PostgreSQL)

```
lookup_cache
  id, video_id, timestamp_bucket, clicked_span, target_lang,
  translation, contextual_explanation, is_idiom, morphology_note,
  created_at

saved_vocabulary
  id, user_id, word_or_phrase, sentence, video_id, timestamp,
  target_lang, created_at

users
  id, email, plan_tier ("free" | "premium"), created_at

daily_lookup_counts
  user_id, date, count
```

## 4. LLM Integration

- **Default model (cache-miss, standard lookup):** cheapest/fastest tier
  available (e.g. Claude Haiku) — this call happens on every cache miss, so
  cost discipline here is what makes the R$20–30/month price viable.
- **Escalated model (`/lookup/deep` only):** stronger tier, used
  deliberately and infrequently.
- **System prompt requirements:**
  - Respond only in natural, conversational Brazilian Portuguese
  - Given: full sentence, the clicked word/phrase, target language
  - Must identify if the span is part of a larger idiom/fixed expression
    and resolve to the full chunk's meaning, not a literal word gloss
  - Must include a short note on common pt-BR-speaker confusion for that
    specific word/pattern when relevant (false cognates, tense mapping,
    preposition transfer — see Directive §3) — this is the calibration
    layer that differentiates the product from a generic translation API
    call, and should be maintained as a living reference (a curated list
    of known pt-BR ↔ EN and pt-BR ↔ IT confusion patterns) fed into the
    system prompt or retrieved via a lightweight lookup table, not
    reinvented by the model on every call
  - Max output length enforced (3–4 sentences, per Directive §7)

## 5. Netflix Integration Notes (volatility isolation)

Isolate all Netflix-specific DOM/player interaction behind a single adapter
module (e.g. `netflix-adapter.ts`) with a stable internal interface
(`getVideoId()`, `getSubtitleTracks()`, `getCurrentCue()`, etc.). Every other
part of the extension talks to this interface, never to Netflix's DOM
directly. When Netflix updates its player (which happens periodically per
public reports from existing tools in this space), only this file should
need changes. Include an automated smoke test that loads a known Netflix
title and asserts the adapter can still extract a video ID and subtitle
track list — this is the single highest-value test in the whole project
for long-term maintenance cost, and should be treated as such under the
TDD workflow.

## 6. Out of Scope — Explicit Non-Goals for This Spec

- No audio/video capture or clip export (Directive §3)
- No integration with any platform other than Netflix
- No SRS scheduling engine
- No mobile companion app
