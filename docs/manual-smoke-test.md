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
