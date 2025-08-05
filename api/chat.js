import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { historial } = req.body;

  if (!historial || !Array.isArray(historial) || historial.length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  try {
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma conversacional, útil y natural.',
          },
          ...historial,
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

    const respuesta = openaiResponse.data.choices[0].message.content;
    return res.status(200).json({ fuente: 'openai', respuesta });
  } catch (error) {
    console.warn('Fallo OpenAI. Usando Cohere como respaldo.');

    try {
      const ultimoMensaje = historial[historial.length - 1].content;
      const cohereResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          message: ultimoMensaje,
          connectors: [],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const respuesta = cohereResponse.data.text;
      return res.status(200).json({ fuente: 'cohere', respuesta });
    } catch (err) {
      console.error('Fallo Cohere:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
