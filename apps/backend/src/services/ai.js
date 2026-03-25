const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Usamos el cliente oficial de OpenAI apuntando a los endpoints de Groq
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const DEFAULT_MODEL = process.env.MODEL_OPENAI || 'llama-3.3-70b-versatile';

async function buildSystemPrompt() {
  const promptsDir = path.join(__dirname, '../../api/prompts');
  
  try {
    const style = fs.readFileSync(path.join(promptsDir, 'alma-style.md'), 'utf-8');
    const dialog = fs.readFileSync(path.join(promptsDir, 'alma-dialog.md'), 'utf-8');
    const fewshot = fs.readFileSync(path.join(promptsDir, 'alma-fewshot.md'), 'utf-8');
    const output = fs.readFileSync(path.join(promptsDir, 'alma-output.md'), 'utf-8');

    const today = new Date().toISOString().split('T')[0];

    return `
=== IDENTIDAD Y ESTILO ===
${style}

=== REGLAS DE DIÁLOGO ===
${dialog}

=== EJEMPLOS DE INTERACCIÓN ===
${fewshot}

=== FORMATO DE SALIDA ===
${output}

INFO ADICIONAL: La fecha de hoy es ${today}
`;
  } catch (err) {
    console.error("Error reading prompt files:", err);
    return "You are Alma, an AI assistant.";
  }
}

async function generateChatCompletion(messages) {
  const systemContent = await buildSystemPrompt();
  
  const formattedMessages = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: formattedMessages,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "Lo siento, ha habido un error generando mi respuesta.";
}

module.exports = {
  generateChatCompletion,
  buildSystemPrompt
};
