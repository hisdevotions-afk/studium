# Directive: SLA Copilot (Netflix Language Acquisition Copilot) — MVP

## 1. Goal

Build a Chrome extension (Manifest V3) that turns Netflix binge-watching into
compressible-input language acquisition for Brazilian Portuguese speakers,
starting with **English** and **Italian** as the only target languages in the
MVP. Native/UI language is Brazilian Portuguese (pt-BR).

Core promise to the user: *"Pause any scene, click a word, and get a real
explanation — not a dictionary, not Google Translate."*

This is not being built as a venture-funded startup. It is a solo-built,
bootstrapped product intended to sustain itself via a freemium subscription
(target price band: R$20–30/month via Pix), where the paid tier primarily
funds LLM token costs. Every architecture decision must be evaluated first
against "can one developer run and afford this," not "does this scale to
millions of users" or "is this defensible against a funded competitor."

## 2. Target User

Brazilian adults (18–35, classes A/B/C) who already subscribe to Netflix,
have tried Duolingo and/or (at most) heard of Language Reactor, and never
built a habit of pausing video to actively study a word. They are not
language-learning power users — they don't know what Anki is, don't want to
configure anything, and will abandon the product if the first 2 minutes of
use don't produce an "aha" moment.

This shapes priority: onboarding clarity and first-session delight matter
more than feature depth. Assume zero familiarity with dual-subtitle tools.

## 3. Scope (MVP)

**In scope:**
- Platform: Netflix only (web player, desktop browser)
- Target languages: English, Italian
- Native language: Brazilian Portuguese (UI and explanations)
- Dual subtitles (target + native) rendered as an overlay, word-tokenized
- Click a word → video auto-pauses → contextual AI explanation appears
- Explanation is **idiom-and-meaning-aware**, not literal word-for-word
  (e.g. "be into someone" → "estar interessado em alguém," flagged as a
  fixed expression, not translated word by word)
- Explanations calibrated for common pt-BR → EN/IT error patterns: false
  cognates (actually/atualmente, pretend/pretender), verb tense mapping
  differences, preposition transfer errors
- Fine playback control: speed, seek, and phrase repeat (loop between two
  subtitle timestamps)
- Vocabulary saving: word + full sentence + timestamp + video reference,
  stored per user (no SRS scheduling yet — just capture)
- Aggressive caching of AI lookups to control token cost

**Explicitly out of scope for MVP** (defer to later phases, not because
they're bad ideas, but because they don't survive a solo-developer cost/risk
filter yet):
- Any platform beyond Netflix (YouTube, Disney+, Prime Video, arbitrary
  video/streaming sites) — each platform is a separate reverse-engineered
  integration with its own maintenance burden
- Audio/video clip mining (capturing actual video/audio snippets for
  flashcards) — DRM circumvention risk and copyright exposure are not worth
  it for a solo builder; text-only vocabulary capture instead
- Spaced Repetition System (SRS) / scheduled review — capture data now,
  build the review engine once there's a real corpus of saved words from
  real users
- Mobile app / native roleplay voice agent
- Portuguese, French, Spanish as target languages (planned for post-MVP
  expansion, per the original 5-language ambition)
- The "i+1 knowledge graph" / predictive content recommendation engine
  described in early research — this requires months of behavioral data
  and is a V3+ feature, not a differentiator to chase now
- eBook/text reading mode, standalone TTS reader

## 4. Positioning & Rules

- Marketing language must NOT say "translate Netflix." Message: turning a
  habit the user already has (bingeing) into the fastest way their brain
  acquires the language — contrast against Duolingo's disconnected
  sentences ("o urso bebe leite") and Language Reactor's stagnant, literal
  dictionary lookups.
- Never claim clinical/neuroscience authority beyond what's defensible in
  casual marketing copy. Reference SLA concepts (comprehensible input,
  noticing) loosely, never as medical/scientific guarantees.
- All explanations must be written in natural, conversational Brazilian
  Portuguese — no machine-translation stiffness.
- Never silently replace the user's native Netflix subtitles without a
  clear toggle — this was a common user complaint about competitors
  (Trancy). Always give the user a visible way to fall back to native
  subtitles.

## 5. Decision Criteria (build vs. defer)

Before adding any feature beyond MVP scope, it must pass all three:
1. Can it be built and maintained by one developer using Claude Code?
2. Does it reduce LLM cost or improve retention more than it adds token
   spend or engineering risk?
3. Does it require touching DRM-protected video/audio streams? If yes,
   defer indefinitely regardless of value — this is a hard rule, not a
   judgment call per feature.

## 6. Edge Cases to Design For

- Netflix changes its player DOM structure (happens periodically) →
  extension must fail gracefully (fall back to native subtitles, show a
  "temporarily limited" notice) rather than break the page
- Title has no subtitle track in the target language → show a clear message,
  don't silently fail
- User clicks a word mid-sentence that's part of a multi-word idiom → the
  explanation must resolve to the full chunk, not the isolated word (this
  is the single most common complaint about competitor tools — do not
  regress on it)
- Free tier lookup quota reached → clear, non-punitive upgrade prompt, not
  a broken feature
- LLM call fails or times out → fall back to a cached/simpler dictionary
  response rather than leaving the user with a spinner

## 7. Style & Voice for AI-Generated Explanations

- Short, direct, conversational pt-BR — write like explaining to a friend,
  not like a grammar textbook
- Always show: (1) contextual meaning in the sentence, (2) whether it's an
  idiom/fixed expression, (3) one line on why literal translation would be
  wrong, when relevant
- Never explain more than 3–4 sentences per lookup — this is a quick
  in-context aid, not a lesson
