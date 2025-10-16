// src/prompts/loadPrompts.js (ENV -> inline defaults)
import { STYLE_DEFAULT, DIALOG_DEFAULT, OUTPUT_DEFAULT, FEWSHOT_DEFAULT } from './texts.js';

let cache = null;

const envOr = (key, fallback) => {
  const v = process.env[key];
  return (typeof v === 'string' && v.trim().length) ? v.trim() : fallback;
};

export function loadPrompts() {
  if (cache) return cache;
  const style   = envOr('PROMPT_STYLE',   STYLE_DEFAULT);
  const dialog  = envOr('PROMPT_DIALOG',  DIALOG_DEFAULT);
  const output  = envOr('PROMPT_OUTPUT',  OUTPUT_DEFAULT);
  const fewshot = envOr('PROMPT_FEWSHOT', FEWSHOT_DEFAULT);

  try {
    console.log('[prompts] sources', {
      style:   style === STYLE_DEFAULT   ? 'inline' : 'env',
      dialog:  dialog === DIALOG_DEFAULT ? 'inline' : 'env',
      output:  output === OUTPUT_DEFAULT ? 'inline' : 'env',
      fewshot: fewshot === FEWSHOT_DEFAULT ? 'inline' : (fewshot ? 'env' : 'none'),
    });
  } catch {}

  cache = { style, dialog, output, fewshot };
  return cache;
}
