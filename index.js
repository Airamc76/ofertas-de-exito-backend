import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

  try {
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en copywriting y ofertas irresistibles. Responde de forma conversacional, útil y natural.',
          },
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 800,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    return res.json({ source: 'openai', response: openaiResponse.data.choices[0].message.content });
  } catch (error) {
    console.warn('Fallo OpenAI. Usando Cohere como respaldo.');

    try {
      const cohereResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          message,
          connectors: [],
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return res.json({ source: 'cohere', response: cohereResponse.data.text });
    } catch (fallbackError) {
      console.error('Error también en Cohere', fallbackError.message);
      return res.status(500).json({ error: 'No se pudo generar una respuesta con ninguna IA.' });
    }
  }
});

app.get('/', (_, res) => res.send('🧠 Backend Ofertas de Éxito funcionando'));

app.listen(PORT, () => console.log(`✅ Backend escuchando en el puerto ${PORT}`));