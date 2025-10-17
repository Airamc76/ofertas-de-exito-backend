// src/store/supaStore.js
import { createClient } from '@supabase/supabase-js';

export const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const supaStore = {
  async ensureClient(clientId) {
    await supa.from('clients').upsert({ id: clientId }).select('id').single();
  },

  async createConversation(clientId, convId, title = 'Nueva conversación') {
    await this.ensureClient(clientId);
    const { error } = await supa.from('conversations')
      .insert({ id: convId, client_id: clientId, title });
    if (error) throw error;
    return { id: convId, title };
  },

  async ensureConversation(id, clientId, title = 'Nueva conversación') {
    await this.ensureClient(clientId);
    const { error } = await supa
      .from('conversations')
      .upsert({ id, client_id: clientId, title }, { onConflict: 'id' });
    if (error) throw error;
    return { id, title };
  },

  async listConversations(clientId, limit = 20) {
    const { data, error } = await supa.from('conversations')
      .select('id, title, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async appendMessage(conversationId, role, content, extra = {}) {
    const { error } = await supa.from('messages')
      .insert({ conversation_id: conversationId, role, content, ...extra });
    if (error) throw error;
  },

  async getHistory(conversationId, limit = 40) {
    const { data, error } = await supa
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

// --- Helpers/export nombrados ---
export async function ensureConversation(id, clientId, title = 'Nueva conversación') {
  return supaStore.ensureConversation(id, clientId, title);
}

export async function getHistory(conversationId, limit = 40) {
  return supaStore.getHistory(conversationId, limit);
}

export async function appendMessage(conversationId, role, content, extra = {}) {
  return supaStore.appendMessage(conversationId, role, content, extra);
}

// Guarda el USER con idempotencia por (conversation_id, client_msg_id)
export async function saveUserMessageIdempotent(conversationId, content, clientMsgId) {
  const { data, error } = await supa
    .from('messages')
    .upsert(
      [{ conversation_id: conversationId, role: 'user', content, client_msg_id: clientMsgId }],
      { onConflict: 'conversation_id,client_msg_id' }
    )
    .select('id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const check = await supa
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .eq('client_msg_id', clientMsgId)
      .maybeSingle();
    if (!check.data) {
      await supa
        .from('messages')
        .insert([{ conversation_id: conversationId, role: 'user', content, client_msg_id: clientMsgId }]);
    }
  }
}

export async function saveAssistantMessage(conversationId, content, clientMsgId) {
  const { error } = await supa
    .from('messages')
    .insert([{ conversation_id: conversationId, role: 'assistant', content /*, reply_to_client_msg_id: clientMsgId */ }]);
  if (error) throw error;
}

export async function updateConversationTitle(conversationId, title) {
  const { error } = await supa
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function getConversation(conversationId) {
  const { data, error } = await supa
    .from('conversations')
    .select('id,title,created_at')
    .eq('id', conversationId)
    .single();
  if (error) throw error;
  return data;
}
