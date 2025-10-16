// src/prompts/loadPrompts.js
import fs from 'node:fs';
import path from 'node:path';

let cache = null;
export function loadPrompts() {
  if (cache) return cache;

  const tryBase = (parts) => path.join(process.cwd(), ...parts);
  const srcBase = tryBase(['src', 'prompts']);
  const apiBase = tryBase(['api', 'prompts']);

  const base = fs.existsSync(srcBase) ? srcBase : apiBase;
  const read = (f) => fs.readFileSync(path.join(base, f), 'utf8');

  cache = {
    style:   read('alma-style.md'),
    dialog:  read('alma-dialog.md'),
    output:  read('alma-output.md'),
    fewshot: fs.existsSync(path.join(base, 'alma-fewshot.md'))
      ? read('alma-fewshot.md')
      : null,
  };
  return cache;
}
