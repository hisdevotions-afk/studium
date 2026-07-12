import { listVocabulary } from '../lookup/vocabulary';
import { isEnabled, setEnabled } from '../lookup/settings';

void listVocabulary().then((all) => {
  document.getElementById('count')!.textContent = String(all.length);
});

const toggle = document.getElementById('toggle') as HTMLInputElement;
void isEnabled().then((v) => {
  toggle.checked = v;
});
toggle.addEventListener('change', () => void setEnabled(toggle.checked));
