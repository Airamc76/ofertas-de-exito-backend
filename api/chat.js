import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { mensaje, historial } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma conversacional, útil y natural.'
        },
        ...(historial || []),
        {
          role: 'user',
          content: mensaje
        }
      ],
      max_tokens: 800
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    const respuesta = response.data.choices[0].message.content;
    res.json({ fuente: 'openai', respuesta });

  } catch (error) {
    console.warn('Fallo OpenAI:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
