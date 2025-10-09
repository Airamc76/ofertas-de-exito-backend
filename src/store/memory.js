// Memoria por cliente y conversación
// - conversationListStore: key = clientId, val = Array<{id,title,createdAt,updatedAt}>
// - chatStore: key = conversationId, val = Array<{role, content, metadata, createdAt}>

export const conversationListStore = new Map();
export const chatStore = new Map();
