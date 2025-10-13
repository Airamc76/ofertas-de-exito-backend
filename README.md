# Ofertas de Éxito - Backend

Backend para el sistema de chat de Ofertas de Éxito utilizando OpenAI.

## Requisitos Previos

- Node.js 16.x o superior
- Cuenta en [OpenAI](https://platform.openai.com/) para obtener una API key
- Vercel CLI (opcional, para despliegue)

## Configuración

1. Clona el repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz del proyecto con:
   ```
   OPENAI_API_KEY=tu_api_key_aquí
   NODE_ENV=development
   ```

## Uso

### Desarrollo Local

```bash
npm run dev
```

La API estará disponible en `http://localhost:3000`

### Despliegue

1. Instala Vercel CLI si no lo tienes:
   ```bash
   npm install -g vercel
   ```

2. Inicia sesión en Vercel:
   ```bash
   vercel login
   ```

3. Despliega:
   ```bash
   vercel --prod
   ```

## API Endpoints

### Obtener conversaciones
```
GET /api/chat/conversations
```

### Crear conversación
```
POST /api/chat/conversations
{
  "title": "Título de la conversación"
}
```

### Eliminar conversación
```
DELETE /api/chat/conversations?id=<conversationId>
```

### Obtener mensajes
```
GET /api/chat/conversations/<conversationId>/messages
```

### Enviar mensaje
```
POST /api/chat/conversations/<conversationId>/messages
{
  "content": "Hola, ¿cómo estás?",
  "role": "user"
}
```

## Variables de Entorno

- `OPENAI_API_KEY`: Tu clave de API de OpenAI
- `NODE_ENV`: Entorno de ejecución (`development` o `production`)

## Estructura del Proyecto

```
.
├── api/
│   ├── chat/
│   │   ├── conversations/
│   │   │   ├── [id]/
│   │   │   │   └── messages.js
│   │   │   └── index.js
│   │   └── index.js
│   └── lib/
│       ├── auth.js
│       └── db.js
├── .env
├── .gitignore
├── package.json
└── vercel.json
```

## Licencia

MIT
