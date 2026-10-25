import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // "" = load all vars, not just VITE_ ones

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/qdrant": {
          target: env.QDRANT_URL,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/qdrant/, ""),
          headers: { "api-key": env.QDRANT_API_KEY },
        },
      },
    },
  };
});