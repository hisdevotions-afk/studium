import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Studium',
  version: '0.1.0',
  description: 'Pause qualquer cena da Netflix, clique numa palavra, e receba uma explicação de verdade.',
  host_permissions: ['https://*.nflxvideo.net/*'],
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
