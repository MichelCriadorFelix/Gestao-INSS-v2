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
const GLOBAL_SUPABASE_URL = "";
const GLOBAL_SUPABASE_KEY = "";

const getEnvVar = (key: string): string | undefined => {
    try {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
            return meta.env[key];
        }
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}
    return undefined;
};

const isValidUrl = (url: string | undefined): boolean => {
    if (!url || url === 'undefined' || url === 'null') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
        return false;
    }
};

export const getDbConfig = () => {
    const stored = localStorage.getItem(DB_CONFIG_KEY);
    if (stored) return JSON.parse(stored);

    const envUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('URL_SUPABASE');
    const envKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

    if (isValidUrl(envUrl) && envKey) {
        return { url: envUrl as string, key: envKey, isEnv: true };
    }
  
    if (isValidUrl(GLOBAL_SUPABASE_URL) && GLOBAL_SUPABASE_KEY) {
        return { url: GLOBAL_SUPABASE_URL, key: GLOBAL_SUPABASE_KEY, isEnv: true };
    }

    return null;
  };
  
  export const supabase = (() => {
      try {
          const config = getDbConfig();
          if (!config || !isValidUrl(config.url)) return null;
          return createClient(config.url, config.key, {
              auth: {
                  persistSession: true,
                  autoRefreshToken: true,
                  detectSessionInUrl: true
              }
          });
      } catch (e) {
          console.error("Erro ao inicializar cliente Supabase:", e);
          return null;
      }
  })();
  
  // Função legada para manter compatibilidade com componentes antigos
  export const initSupabase = () => supabase;

/**
 * Valida a conexão com o Supabase tentando buscar um registro simples.
 * Útil para diagnosticar erros de "Falha ao buscar" (CORS ou Projeto Pausado).
 */
export const validateSupabaseConnection = async () => {
    const supabase = initSupabase();
    if (!supabase) return { success: false, message: "Supabase não inicializado. Verifique URL e Key." };

    try {
        // Tenta buscar da tabela 'clients_v2' que é a principal
        const { error } = await supabase.from('clients_v2').select('id').limit(1);
        
        if (error) {
            if (error.message.includes('fetch')) {
                return { 
                    success: false, 
                    message: "Erro de Rede (Falha ao buscar). Possíveis causas: 1. Projeto Supabase Pausado. 2. Bloqueio de CORS. 3. Sem conexão com internet.",
                    details: error
                };
            }
            return { success: false, message: `Erro do Supabase: ${error.message}`, details: error };
        }

        return { success: true, message: "Conexão estabelecida com sucesso!" };
    } catch (err: any) {
        return { 
            success: false, 
            message: "Exceção ao conectar: " + (err.message || "Erro desconhecido"),
            details: err
        };
    }
};
