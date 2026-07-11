import { listVocabulary } from '../lookup/vocabulary';

void listVocabulary().then((all) => {
  document.getElementById('count')!.textContent = String(all.length);
});
