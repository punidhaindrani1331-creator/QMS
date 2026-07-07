/**
 * Centralised application configuration.
 *
 * All environment-specific values are read from Vite's import.meta.env.
 * Set them in a .env file at the Frontend root:
 *
 *   VITE_API_URL=http://127.0.0.1:8000
 *   VITE_WS_URL=ws://127.0.0.1:8000/ws
 *
 * Never hardcode URLs or ports anywhere else in the codebase — import from here.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:8000/ws";
