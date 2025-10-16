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

  async getHistory(conversationId, limit = 24) {
    const { data, error } = await supa
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).reverse();
  },
};
