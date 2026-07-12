import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Studium',
  version: '0.1.0',
  description: 'Pause qualquer cena da Netflix, clique numa palavra, e receba uma explicação de verdade.',
  host_permissions: ['https://*.nflxvideo.net/*', 'http://localhost:8000/*'],
  permissions: ['storage'],
  action: {
    default_title: 'Studium',
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [
    // Netflix is an SPA: clicking play on /browse swaps the URL to /watch
    // without a page load, so a /watch/* match never injects on the normal
    // flow. Match the whole site and let the scripts gate on the pathname.
    {
      matches: ['https://www.netflix.com/*'],
      js: ['src/content/page-bridge.ts'],
      world: 'MAIN',
      run_at: 'document_start',
    },
    {
      matches: ['https://www.netflix.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
});
