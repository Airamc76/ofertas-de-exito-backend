import fs from 'fs';
import path from 'path';

// Cargador de prompts con caché
class PromptManager {
  constructor() {
    this.prompts = {};
    this.promptsDir = path.join(process.cwd(), 'api', 'prompts');
    this.initializePrompts();
  }

  initializePrompts() {
    try {
      // Cargar todos los archivos .md de la carpeta de prompts
      const promptFiles = fs.readdirSync(this.promptsDir)
        .filter(file => file.endsWith('.md') && file !== 'README.md');
      
      promptFiles.forEach(file => {
        try {
          const name = path.basename(file, '.md');
          const content = fs.readFileSync(path.join(this.promptsDir, file), 'utf8');
          this.prompts[name] = content;
          console.log(`[PromptManager] Cargado: ${file} (${content.length} caracteres)`);
        } catch (error) {
          console.error(`[PromptManager] Error cargando ${file}:`, error.message);
        }
      });

      // Validar que los prompts requeridos estén presentes
      this.validateRequiredPrompts();
      
    } catch (error) {
      console.error('[PromptManager] Error inicializando prompts:', error.message);
      throw new Error('No se pudieron cargar los prompts');
    }
  }

  validateRequiredPrompts() {
    const required = ['alma-style', 'alma-dialog', 'alma-fewshot', 'alma-output'];
    const missing = required.filter(name => !this.prompts[name]);
    
    if (missing.length > 0) {
      console.error('[PromptManager] Faltan prompts requeridos:', missing);
      throw new Error(`Faltan los siguientes prompts requeridos: ${missing.join(', ')}`);
    }
  }

  getPrompt(name) {
    const prompt = this.prompts[name];
    if (!prompt) {
      console.warn(`[PromptManager] El prompt '${name}' no existe`);
      return '';
    }
    return prompt;
  }

  getFullContext() {
    const context = `# CONTEXTO Y ESTILO\n${this.getPrompt('alma-style')}\n\n` +
      `# GUÍA DE DIÁLOGO\n${this.getPrompt('alma-dialog')}\n\n` +
      `# EJEMPLOS DE RESPUESTA\n${this.getPrompt('alma-fewshot')}\n\n` +
      `# FORMATO DE SALIDA\n${this.getPrompt('alma-output')}\n\n` +
      `# REGLAS OBLIGATORIAS\n` +
      `- Cualquier precio, descuento, fecha o cupo es "EJEMPLO" o "personalizable".\n` +
      `- No fijes importes definitivos a menos que el usuario los provea explícitamente.\n` +
      `- Usa micro-decisiones (CTA breve) al final de cada bloque cuando aporte claridad.\n` +
      `- Mantén el tono: claro, persuasivo, sin relleno, útil para conversión.\n\n` +
      `# INSTRUCCIONES FINALES\n` +
      `- Responde siempre en español.\n` +
      `- Usa emojis relevantes para hacer la conversación más amigable.\n` +
      `- Estructura tus respuestas con títulos claros y bullets.\n` +
      `- Siempre ofrece un siguiente paso claro (CTA).`;

    console.log(`[PromptManager] Contexto generado (${context.length} caracteres)`);
    return context;
  }
}

// Exportar una instancia singleton
const promptManager = new PromptManager();
export default promptManager;
