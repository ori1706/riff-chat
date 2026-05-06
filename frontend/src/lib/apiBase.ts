/** Backend origin for REST + Socket.IO. In dev, empty → same origin + Vite proxy. */
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://riff-chat-api.onrender.com" : "");
