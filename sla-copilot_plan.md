# Orchestrator Plan: SLA Copilot MVP

This describes the decision logic that coordinates the Execution layer. The
"orchestrator" here is split between two runtimes: (a) the Chrome extension's
content script, which handles real-time UI/player events, and (b) the
backend API, which handles anything involving cost, state, or AI. This split
exists specifically to survive Manifest V3 constraints (see Directive §6 and
Execution §5) — the extension must stay a thin, mostly-stateless view layer.

## Flow 1 — Player Load & Subtitle Injection

1. Content script detects a Netflix player has loaded (URL pattern +
   player DOM node present).
2. Extract the current `video_id` from the Netflix URL/player state.
3. Request available subtitle tracks for that title from Netflix's player
   API surface. If neither English nor Italian track exists → show
   "idioma não disponível para este título" and stop (do not proceed to
   step 4).
4. Request the Portuguese (native) track the same way. If unavailable,
   proceed target-language-only with an explanation-only fallback (native
   line is generated via cached/AI translation of the target line instead
   of Netflix's own pt-BR track).
5. Render both subtitle lines as an overlay (target on top, native below,
   or per user's display preference), with the target line tokenized into
   clickable word/phrase spans.
6. Sync overlay timing to the video's `timeupdate` event, not to Netflix's
   own subtitle renderer (which should be hidden/disabled while the
   overlay is active, per user's original-subtitle toggle setting).

## Flow 2 — Word Click → Pause → Explanation

1. User clicks a token (word or pre-grouped phrase) in the target-language
   subtitle line.
2. Content script immediately calls `video.pause()` — this must feel
   instant, no waiting on network.
3. Content script sends `{video_id, timestamp_bucket, sentence, clicked_span,
   target_lang: "en"|"it", native_lang: "pt-BR"}` to the backend `/lookup`
   endpoint. `timestamp_bucket` is rounded to the nearest subtitle cue
   start time, not the exact click time, to maximize cache hits across
   different users watching the same scene.
4. Backend checks cache first (see Execution §2). Cache hit → return
   immediately. Cache miss → call LLM, store result, return.
5. Content script renders the explanation popup near the clicked word:
   contextual meaning, idiom flag if applicable, one-line "why not literal"
   note when relevant (per Directive §7 style rules).
6. Video remains paused until the user explicitly resumes (click video,
   press space, or close the popup) — never auto-resume, the pause is the
   point of the feature.
7. If the backend call fails or exceeds ~2.5s, show a lightweight fallback
   (last-resort dictionary lookup, or "não consegui buscar isso agora")
   rather than blocking the UI indefinitely.

## Flow 3 — Save to Vocabulary

1. From the explanation popup, user taps "salvar."
2. Content script sends `{user_id, word/phrase, sentence, video_id,
   timestamp, target_lang}` to `/vocabulary`.
3. No SRS scheduling happens yet (out of MVP scope) — this is pure capture
   for now. Confirm save with a lightweight toast, don't interrupt playback.

## Flow 4 — Playback Controls

1. Speed control and phrase repeat are pure client-side operations on the
   `<video>` element — no backend call needed.
2. "Repeat phrase" = loop between the start of the current subtitle cue and
   its end timestamp, N times or until user cancels. This works identically
   for both target languages since it only depends on subtitle cue timing,
   not language-specific logic.

## Flow 5 — Freemium Gating

1. Backend tracks daily lookup count per `user_id` (reset at midnight
   America/Sao_Paulo).
2. On each `/lookup` call, check quota before hitting the LLM. If exceeded
   and user is on the free plan → return an "upgrade" response type instead
   of an explanation; content script renders the upgrade prompt instead of
   the popup.
3. Paid-tier users skip the quota check entirely.

## Cost-Control Decision Logic (applies to every `/lookup` call)

1. Check cache by `(video_id, timestamp_bucket, clicked_span, target_lang)`.
   Cache hit → serve, no LLM call, no cost.
2. Cache miss → default to the cheap/fast model tier for the lookup.
3. Only escalate to a stronger model if the user explicitly requests a
   deeper explanation (a secondary "explica melhor" action in the popup —
   this is the only path that should hit the more expensive model).
4. Every LLM response is written back to cache before being returned,
   regardless of which model tier served it.

## Implementation Note — Using Superpowers in Claude Code

This Directive + Orchestrator + Execution set is the input for Claude Code's
`brainstorming` skill (Superpowers), not a replacement for it. Recommended
sequence in Claude Code:

1. Open a session in the project repo, paste or reference these three docs,
   and let `brainstorming` interrogate any gaps before code starts —
   especially around Netflix subtitle-track extraction specifics and the
   exact caching schema, which are intentionally left at spec-level here.
2. Once the design is confirmed, let `writing-plans` break Execution §1–4
   below into 2–5 minute tasks with exact file paths.
3. Use `subagent-driven-development` (or `executing-plans`) to implement
   with TDD per task — this project benefits from strict red-green-refactor
   discipline specifically on the caching layer and the freemium quota
   logic, since silent bugs there directly cost money or block paying
   users.
4. Treat the Netflix DOM/subtitle-extraction layer as the most volatile
   part of the codebase — isolate it behind a single adapter module so a
   Netflix player update only requires touching one file, per Directive §6.
