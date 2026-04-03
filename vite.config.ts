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
        'process.env.API_KEY': JSON.stringify(env.API_KEY_2 || env.GEMINI_API_KEY || env.API_KEY_1),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY_1 || env.API_KEY_2 || env.API_KEY_3 || env.API_KEY_4 || env.API_KEY_5 || env.API_KEY_6 || env.API_KEY_7 || env.API_KEY_8 || env.API_KEY_9 || env.API_KEY_10 || env.API_KEY_11 || env.API_KEY_12),
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
