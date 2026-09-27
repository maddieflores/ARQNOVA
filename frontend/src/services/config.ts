export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
