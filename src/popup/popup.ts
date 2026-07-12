import { listVocabulary } from '../lookup/vocabulary';
import { isEnabled, setEnabled, getLanguages, setLanguages } from '../lookup/settings';
import type { NativeLang, TargetLang } from '../adapter/types';

void listVocabulary().then((all) => {
  document.getElementById('count')!.textContent = String(all.length);
});

const toggle = document.getElementById('toggle') as HTMLInputElement;
const langs = document.getElementById('langs') as HTMLElement;
const targetSel = document.getElementById('target') as HTMLSelectElement;
const nativeSel = document.getElementById('native') as HTMLSelectElement;

// Language pickers appear only while the extension is on ("ao ativar").
const showLangs = (on: boolean): void => {
  langs.style.display = on ? 'flex' : 'none';
};

void isEnabled().then((v) => {
  toggle.checked = v;
  showLangs(v);
});
void getLanguages().then(({ native, target }) => {
  nativeSel.value = native;
  targetSel.value = target;
});

toggle.addEventListener('change', () => {
  void setEnabled(toggle.checked);
  showLangs(toggle.checked);
});

const saveLangs = (): void => {
  void setLanguages(nativeSel.value as NativeLang, targetSel.value as TargetLang);
};
nativeSel.addEventListener('change', saveLangs);
targetSel.addEventListener('change', saveLangs);
