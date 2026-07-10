# SLA Copilot — MVP System Overview

A Netflix-only Chrome extension that pauses the video when you click a
subtitle word and explains what it actually means in that scene — in
natural Brazilian Portuguese, calibrated for common pt-BR speaker mistakes.
MVP target languages: **English** and **Italian**.

Built as a bootstrapped, solo-developer product. Free tier + premium
subscription (~R$20–30/month via Pix) funds LLM token costs — not a
venture-backed startup, so every decision in this doc set is filtered
through "can one person build and afford this," not "is this defensible
against a funded clone."

## Why Netflix-only, why these two languages

Every platform integration is a separate reverse-engineered adapter with
its own maintenance burden (see `execution/sla-copilot_spec.md` §5). One
platform, well-executed, beats five platforms held together by fragile
scrapers. English and Italian were chosen as the first two of the eventual
five-language roadmap (Portuguese-BR native, + English, Italian, French,
Spanish as targets) to prove the model before expanding.

## Positioning

The target user has tried Duolingo, maybe heard of Language Reactor, and
nothing else. The bar to feel novel is lower than in the mature US/EU
market — the product doesn't need to out-feature Trancy or Linglass, it
needs to feel like a clear step up from disconnected app sentences and a
stagnant, literal dictionary popup. See `directives/sla-copilot.md` §4 for
the exact positioning rules (never "translate Netflix" — sell the habit
conversion, not the utility).

## Document Set

| File | Purpose |
|---|---|
| `directives/sla-copilot.md` | Goal, scope, rules, edge cases, voice — read this first |
| `orchestrator/sla-copilot_plan.md` | Step-by-step flows: subtitle injection, click-to-pause-to-explain, saving, playback control, cost-control logic |
| `execution/sla-copilot_spec.md` | Extension architecture, backend API, data model, LLM integration, Netflix adapter isolation strategy |

## Core MVP Feature Set

- Dual subtitles (target + native), word-clickable
- Click word → auto-pause → contextual, idiom-aware AI explanation
- Explanations calibrated for pt-BR speaker error patterns (false
  cognates, verb tense, preposition transfer)
- Fine playback control (speed, seek, phrase repeat)
- Vocabulary saving (sentence + word + timestamp, no SRS yet)
- Aggressive lookup caching to control LLM cost

## Explicitly deferred (not rejected — just not MVP)

Audio/video clip mining, SRS/spaced repetition, mobile app, voice roleplay,
any platform beyond Netflix, Portuguese/French/Spanish as additional
targets, predictive "i+1" content recommendation engine. Full reasoning for
each cut is in the Directive §3.

## Building This in Claude Code (Superpowers)

This doc set is designed to feed directly into the Superpowers workflow —
see `orchestrator/sla-copilot_plan.md` for the exact sequence
(`brainstorming` → `writing-plans` → `subagent-driven-development`/
`executing-plans`, with TDD enforced especially on the caching layer and
Netflix adapter). Don't skip the brainstorming pass even though this spec
is fairly detailed — Netflix's exact subtitle-track extraction mechanics
and the caching schema are intentionally left for that session to nail
down against the live DOM, since that's the part most likely to have
shifted since this doc was written.
