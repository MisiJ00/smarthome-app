import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The web interface talks to everything through its own origin, so no CORS is needed and Kratos's session cookie
// belongs to the web interface: /api (incl. the /api/events WebSocket) goes to the backend, /kratos to Kratos.
// On the server a reverse proxy (e.g. Caddy) does the same.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.BACKEND_URL ?? 'http://localhost:8088';
  const kratos = env.KRATOS_URL ?? 'http://localhost:4433';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true, ws: true },
        '/kratos': { target: kratos, changeOrigin: true, rewrite: (path) => path.replace(/^\/kratos/, '') },
      },
    },
    preview: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true, ws: true },
        '/kratos': { target: kratos, changeOrigin: true, rewrite: (path) => path.replace(/^\/kratos/, '') },
      },
    },
  };
});
