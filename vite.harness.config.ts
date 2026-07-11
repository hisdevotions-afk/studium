import { defineConfig } from 'vite';

// Harness dev server: serves watch/sim.html (pathname starts with /watch so
// the content script's page gate passes) and transforms src/*.ts on the fly —
// editing source + F5 is the whole iteration loop, no build, no extension.
export default defineConfig({
  server: { port: 5199, strictPort: true },
});
