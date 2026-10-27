import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const API_PORT = process.env.API_PORT || 4000;
const inCodespaces = Boolean(process.env.CODESPACE_NAME);

/**
 * Works out where the API lives when VITE_API_URL hasn't been set explicitly.
 * In GitHub Codespaces every forwarded port gets its own URL, built from two variables
 * Codespaces provides — so we derive the API's forwarded URL instead of hardcoding localhost.
 */
function defaultApiUrl() {
  const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
  if (CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return `https://${CODESPACE_NAME}-${API_PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}/api/v1`;
  }
  return `http://localhost:${API_PORT}/api/v1`;
}

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const fromFiles = loadEnv(mode, envDir, 'VITE_'); // .env files + shell variables
  if (!fromFiles.VITE_API_URL) {
    // Vite exposes VITE_* process variables to the app as import.meta.env.VITE_*.
    process.env.VITE_API_URL = defaultApiUrl();
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true, // the API's CORS allow-list expects this exact port
      host: inCodespaces ? true : 'localhost', // let Codespaces port forwarding reach the dev server
      allowedHosts: ['.app.github.dev'], // Codespaces forwarded hostnames
    },
    preview: { port: 5173, strictPort: true, host: inCodespaces ? true : 'localhost' },
  };
});
