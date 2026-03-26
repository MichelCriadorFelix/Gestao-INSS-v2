import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    supabase: any;
  }
}

export const DB_CONFIG_KEY = 'inss_db_config';

// ------------------------------------------------------------------
// CONFIGURAÇÃO GLOBAL DO BANCO DE DADOS (AUTO-CONFIG)
// ------------------------------------------------------------------
const GLOBAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const GLOBAL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg";

const getEnvVar = (key: string): string | undefined => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
             // @ts-ignore
            return import.meta.env[key];
        }
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) {}
    return undefined;
};

export const getDbConfig = () => {
    const stored = localStorage.getItem(DB_CONFIG_KEY);
    if (stored) return JSON.parse(stored);

    const envUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
    const envKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

    if (envUrl && envKey) {
        return { url: envUrl, key: envKey, isEnv: true };
    }

    if (GLOBAL_SUPABASE_URL && GLOBAL_SUPABASE_KEY) {
        return { url: GLOBAL_SUPABASE_URL, key: GLOBAL_SUPABASE_KEY, isEnv: true };
    }

    return null;
};

export const initSupabase = () => {
    // Prioridade 1: Configuração salva pelo usuário na interface (localStorage)
    const stored = localStorage.getItem(DB_CONFIG_KEY);
    if (stored) {
        const config = JSON.parse(stored);
        if (config && config.url && config.key) {
            return createClient(config.url, config.key);
        }
    }

    // Prioridade 2: Variáveis de ambiente
    const envUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
    const envKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');
    if (envUrl && envKey) {
        return createClient(envUrl, envKey);
    }

    // Prioridade 3: Configuração global (fallback)
    if (GLOBAL_SUPABASE_URL && GLOBAL_SUPABASE_KEY) {
        return createClient(GLOBAL_SUPABASE_URL, GLOBAL_SUPABASE_KEY);
    }

    return null;
};
