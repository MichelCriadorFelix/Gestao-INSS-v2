import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'URL_SUPABASE', 'SUPABASE_ANON_KEY'],
      plugins: [react()],
      define: {
        // ATENÇÃO: NUNCA exponha chaves de API secretas (como GEMINI_API_KEY) no frontend.
        // O backend (api/index.ts) já tem acesso a process.env nativamente.
        'process.env.URL_SUPABASE': JSON.stringify(env.URL_SUPABASE),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
