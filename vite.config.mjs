import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// O código lê process.env.REACT_APP_* (nomes herdados do CRA e já
// configurados na Vercel). Só variáveis com esse prefixo entram no
// bundle — nunca crie uma REACT_APP_ com a service_role.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const define = { 'process.env.PUBLIC_URL': JSON.stringify('') };
  for (const [chave, valor] of Object.entries(env)) {
    define[`process.env.${chave}`] = JSON.stringify(valor);
  }
  return {
    plugins: [react()],
    define,
    build: { outDir: 'build' },
    server: { port: 3000 },
    preview: { port: 3000 },
  };
});
