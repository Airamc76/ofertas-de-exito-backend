// src/prompts/loadPrompts.js (ENV -> archivos -> defaults)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cache = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRS = [
  path.join(process.cwd(), 'src', 'prompts'),
  path.join(process.cwd(), 'api', 'prompts'),
  __dirname
];

function readFirst(filename) {
  for (const d of DIRS) {
    const p = path.join(d, filename);
    if (existsSync(p)) {
      try { return readFileSync(p, 'utf8'); } catch {}
    }
  }
  return null;
}

export function loadPrompts() {
  if (cache) return cache;
  const env = (k) => process.env[k]?.trim?.();
  cache = {
    style:   env('PROMPT_STYLE')   || readFirst('alma-style.md')   || 'Eres Alma, una asistente clara y útil.',
    dialog:  env('PROMPT_DIALOG')  || readFirst('alma-dialog.md')  || 'Mantén el contexto y solicita datos faltantes.',
    output:  env('PROMPT_OUTPUT')  || readFirst('alma-output.md')  || 'Responde con pasos concretos y ejemplos.',
    fewshot: env('PROMPT_FEWSHOT') || readFirst('alma-fewshot.md') || null
  };
  return cache;
}
