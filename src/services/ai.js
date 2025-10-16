// src/services/ai.js
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callModel({ messages }){
  const resp = await client.chat.completions.create({
    model: process.env.MODEL_OPENAI || 'gpt-4o-mini',
    messages,
    temperature: 0.7,
  });
  const text = resp.choices?.[0]?.message?.content || '…';
  return { text };
}
