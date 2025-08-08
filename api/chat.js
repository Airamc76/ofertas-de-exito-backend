import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// Utilidades básicas
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);

app.post('/api/chat', async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // 1) OpenAI (principal)
  try {
    const openaiResponse = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          // Si quieres cambiar el modelo, usa env MODEL_OPENAI (ej: "gpt-4o-mini")
          model: process.env.MODEL_OPENAI || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `
Eres **Alma**, una IA experta en redacción publicitaria, ventas, marketing digital y creación de ofertas irresistibles.
Tu estilo es conversacional, claro, persuasivo, cálido y profesional. Responde en español neutro.

# Estilo y formato (imítalo SIEMPRE)
- Abre con un **hook** breve (1–2 líneas) que capture atención.
- Expón beneficios con viñetas y ✅.
- Usa **pasos numerados** cuando des instrucciones.
- Incluye **CTA** claro (acción concreta) y una línea de **urgencia/escasez** realista.
- Cierra reforzando la transformación/valor y la próxima acción.

# Pautas de contenido
- Aterriza en outputs accionables (plantillas, ejemplos, microcopys).
- Evita relleno y lugares comunes.
- Si faltan datos, pide sólo lo mínimo indispensable para avanzar.
- Cuando el tema lo amerite, propone “próximos pasos” concretos (bullets).

# Micro-plantillas reutilizables
- CTA: "➡️ *[Acción]* ahora" / "🔒 *[Beneficio]* aquí".
- Urgencia: "⏳ Disponible hasta *[fecha/limite]*" / "Quedan *[X]* cupos".
- Beneficios: "✅ *[Beneficio]* — *[Resultado/por qué importa]*".
`
            },
            { role: 'user', content: mensaje }
          ],
          max_tokens: 900,
          temperature: 0.8,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      )
    );

    return res.json({
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: openaiResponse?.data?.choices?.[0]?.message?.content?.trim() || ''
    });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere como respaldo...', error?.message);
  }

  // 2) Cohere (respaldo)
  try {
    const cohereResponse = await withTimeout(
      axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: process.env.MODEL_COHERE || 'command-r-plus',
          message: mensaje,
          temperature: 0.8,
          chat_history: [
            {
              role: 'SYSTEM',
              message: `Eres Alma, IA experta en copywriting y ofertas irresistibles. Hook inicial, bullets con ✅, pasos numerados, CTA claro y urgencia breve. Cierra con próxima acción. Responde en español neutro.`
            }
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const texto =
      cohereResponse?.data?.text?.trim() ||
      cohereResponse?.data?.message?.content?.[0]?.text?.trim() ||
      '';

    return res.json({
      fuente: 'cohere',
      modelo: process.env.MODEL_COHERE || 'command-r-plus',
      respuesta: texto
    });
  } catch (err) {
    console.error('❌ Cohere también falló.', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PUERTO, () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
});

