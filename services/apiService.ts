import { supabase } from '../supabaseClient';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'Authorization': token ? `Bearer ${token}` : '',
  };

  // Only set Content-Type if not already set and not FormData
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
