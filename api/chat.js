import axios from 'axios';

export default async function handler(req, res) {
  // ✅ Cabeceras CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Manejo del método preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Validación de método
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  try {
    // ✅ Consulta principal a OpenAI
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en redacción publicitaria y ofertas irresistibles. Responde de forma conversacional, útil y natural.',
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

    return res.status(200).json({
      fuente: 'openai',
      respuesta: openaiResponse.data.choices[0].message.content,
    });

  } catch (error) {
    console.warn("Fallo OpenAI. Usando Cohere como respaldo.");

    try {
      // ✅ Respaldo con Cohere
      const cohereResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          message: message,
          connectors: [],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          },
        }
      );

      return res.status(200).json({
        fuente: 'cohere',
        respuesta: cohereResponse.data.text,
      });

    } catch (cohereError) {
      console.error("Fallo Cohere también:", cohereError.message);
      return res.status(500).json({ error: "Error al generar respuesta con IA" });
    }
  }
}
