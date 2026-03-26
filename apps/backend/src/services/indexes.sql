-- Script de optimizacion de indices para Supabase
-- Ejecutar estas sentencias en el SQL Editor de tu proyecto Supabase para mejorar drásticamente el rendimiento bajo mucha carga.

-- Indice para buscar conversaciones por cliente ordenadas por fecha (Usado en el historial lateral)
CREATE INDEX IF NOT EXISTS idx_conversations_client_id_created_at 
ON conversations(client_id, created_at DESC);

-- Indice para buscar mensajes por conversación (Usado al cargar el Chat y por la IA)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
ON messages(conversation_id, created_at ASC);

-- Indice para asegurar que la búsqueda de clientes por ID sea instantánea
-- (Supabase suele crear la PK automáticamente, pero esto asegura el rendimiento)
CREATE INDEX IF NOT EXISTS idx_clients_id ON clients(id);

-- Opcional: Indice para búsquedas por client_msg_id (Idempotencia)
CREATE INDEX IF NOT EXISTS idx_messages_client_msg_id ON messages(client_msg_id);
