import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/api/chat', async (req, res) => {
  const { mensaje, historial } = req.body;

  if (!mensaje || mensaje.trim() === '') {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  const mensajes = [
    {
      role: 'system',
      content: 'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma conversacional, útil y natural.'
    },
    ...(historial || []),
    {
      role: 'user',
      content: mensaje
    }
  ];

  try {
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: mensajes,
        max_tokens: 800
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    return res.json({
      fuente: 'openai',
      respuesta: openaiResponse.data.choices[0].message.content
    });
  } catch (error) {
    console.warn('Fallo OpenAI. Usando Cohere como respaldo.');

    try {
      const cohereResponse = await axios.post(
        'https://api.cohere.ai/chat',
        {
          message: mensaje,
          connectors: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`
          }
        }
      );

      return res.json({
        fuente: 'cohere',
        respuesta: cohereResponse.data.text
      });
    } catch (error2) {
      console.error('Error con ambos modelos IA');
      return res.status(500).json({ error: 'Error al procesar la solicitud.' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});

