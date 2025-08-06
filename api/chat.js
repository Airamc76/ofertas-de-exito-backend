import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PUERTO = process.env.PORT || 3000;

app.post('/api/chat', async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  try {
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres una IA llamada Sara, experta en redacción publicitaria, ventas, marketing digital y ofertas irresistibles. Tu estilo es conversacional, claro, persuasivo, cálido y profesional. Siempre ayudas a que el usuario mejore sus textos, ofertas o estrategias, sin divagar ni dar respuestas genéricas.',
          },
          {
            role: 'user',
            content: mensaje,
          }
        ],
        max_tokens: 800,
        temperature: 0.8,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    return res.json({
      fuente: 'openai',
      respuesta: openaiResponse.data.choices[0].message.content.trim()
    });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere como respaldo...');
  }

  // Fallback a Cohere
  try {
    const cohereResponse = await axios.post(
      'https://api.cohere.ai/v1/chat',
      {
        message: mensaje,
        connectors: [],
        chat_history: [],
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      fuente: 'cohere',
      respuesta: cohereResponse.data.text.trim()
    });
  } catch (err) {
    console.error('❌ Cohere también falló.', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PUERTO, () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
});
