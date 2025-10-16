// src/prompts/loadPrompts.js (ENV-first)
let cache = null;

export function loadPrompts() {
  if (cache) return cache;
  const env = (k, fallback) => (process.env[k]?.trim?.() || fallback);
  cache = {
    style:   env('PROMPT_STYLE',   'Eres Alma, una asistente clara, amable y accionable.'),
    dialog:  env('PROMPT_DIALOG',  'Mantén el contexto; pide datos faltantes sin ambigüedad.'),
    output:  env('PROMPT_OUTPUT',  'Responde con pasos y ejemplos. Evita jerga innecesaria.'),
    fewshot: env('PROMPT_FEWSHOT', null)
  };
  return cache;
}
