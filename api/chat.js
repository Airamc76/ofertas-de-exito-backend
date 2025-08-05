import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message } = req.body;
  if (!message) {
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
            content: 'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma útil, natural y conversacional.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 800
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    return res.status(200).json({ fuente: 'openai', response: openaiResponse.data.choices[0].message.content });
  } catch (error) {
    console.warn('Fallo OpenAI. Intentando Cohere como respaldo.');

    try {
      const cohereResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          message,
          connectors: []
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return res.status(200).json({ fuente: 'cohere', response: cohereResponse.data.text });
    } catch (fallbackError) {
      console.error('Fallo Cohere:', fallbackError);
      return res.status(500).json({ error: 'Error de IA con ambos proveedores' });
    }
  }
}