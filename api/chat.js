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
            content: 'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma conversacional, útil y natural, como un especialista en marketing que asesora al usuario para vender más.',
          },
          {
            role: 'user',
            content: mensaje,
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

    return res.json({ fuente: 'openai', respuesta: openaiResponse.data.choices[0].message.content });
  } catch (error) {
    console.warn('Fallo OpenAI. Usando Cohere como respaldo.');
  }

  try {
    const cohereResponse = await axios.post(
      'https://api.cohere.ai/v1/chat',
      {
        message: mensaje,
        connectors: [],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({ fuente: 'cohere', respuesta: cohereResponse.data.text });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.listen(PUERTO, () => {
  console.log(`Servidor escuchando en puerto ${PUERTO}`);
});


