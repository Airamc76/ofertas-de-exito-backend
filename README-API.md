# API de Chat con Historial - Ofertas de Éxito

## Endpoints Disponibles

### 1. Chat Principal
**POST** `/api/chat`

```javascript
// Nueva conversación
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + jwt_token // opcional
  },
  body: JSON.stringify({
    mensaje: "Hola Alma, quiero crear un curso online",
    userId: "user123" // requerido si no hay token
  })
});

// Continuar conversación existente
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + jwt_token
  },
  body: JSON.stringify({
    mensaje: "¿Qué precio debería poner?",
    userId: "user123",
    conversationId: "conv_1756161522601" // ID de conversación existente
  })
});
```

**Respuesta:**
```json
{
  "ok": true,
  "fuente": "openai",
  "modelo": "gpt-4o-mini",
  "respuesta": "¡Hola! Me alegra que quieras crear un curso...",
  "conversationId": "conv_1756161522601"
}
```

### 2. Listar Conversaciones
**GET** `/api/chat/conversations`

```javascript
const conversations = await fetch('/api/chat/conversations', {
  headers: {
    'Authorization': 'Bearer ' + jwt_token
  }
});
```

**Respuesta:**
```json
{
  "ok": true,
  "conversations": [
    {
      "id": "conv_1756161522601",
      "title": "Hola Alma, quiero crear un curso online...",
      "createdAt": "2025-08-25T22:20:19.000Z",
      "updatedAt": "2025-08-25T22:25:30.000Z"
    }
  ]
}
```

## Características del Sistema

- **100 turnos** por conversación (200 mensajes)
- **20 conversaciones** máximo por usuario
- **Persistencia completa** en Redis
- **Títulos automáticos** basados en primer mensaje
- **Timestamps** en cada mensaje
- **Compatibilidad** con autenticación JWT

## Ejemplo de Integración Frontend

```javascript
class ChatManager {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.currentConversationId = null;
  }

  async sendMessage(message, conversationId = null) {
    const response = await fetch(`${this.apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        mensaje: message,
        conversationId: conversationId || this.currentConversationId
      })
    });

    const data = await response.json();
    this.currentConversationId = data.conversationId;
    return data;
  }

  async getConversations() {
    const response = await fetch(`${this.apiUrl}/api/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  newConversation() {
    this.currentConversationId = null;
  }
}

// Uso
const chat = new ChatManager('http://localhost:3000', 'tu_jwt_token');
const response = await chat.sendMessage('Hola Alma, necesito ayuda con ventas');
```
