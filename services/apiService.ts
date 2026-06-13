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

  const reqMethod = options.method || 'GET';
  console.log(`%c[API REQUEST] 🛫 ${reqMethod} ${url}`, 'color: #3b82f6; font-weight: bold; font-size: 11px;');
  
  if (options.body) {
    try {
      if (options.body instanceof FormData) {
        const fields: Record<string, any> = {};
        options.body.forEach((val, key) => {
          fields[key] = val instanceof File ? `[File: ${val.name} (${val.size} bytes)]` : val;
        });
        console.log('%c[API REQUEST BODY] (FormData)', 'color: #64748b; font-size: 10px;', fields);
      } else {
        const bodyObj = JSON.parse(options.body as string);
        // Log clean body object to console
        console.log('%c[API REQUEST BODY]', 'color: #64748b; font-size: 10px;', {
          ...bodyObj,
          // Truncate very long fields in preview if any
          message: bodyObj.message ? (bodyObj.message.length > 500 ? `${bodyObj.message.substring(0, 500)}...` : bodyObj.message) : undefined,
          history: bodyObj.history ? `[${bodyObj.history.length} messages]` : undefined,
          documentContext: bodyObj.documentContext ? `[Length: ${bodyObj.documentContext.length} chars]` : undefined,
          ragContext: bodyObj.ragContext ? `[Length: ${bodyObj.ragContext.length} chars]` : undefined
        });
      }
    } catch (e) {
      console.log('%c[API REQUEST BODY - raw]', 'color: #64748b; font-size: 10px;', options.body);
    }
  }

  try {
    const start = performance.now();
    const res = await fetch(url, {
      ...options,
      headers,
    });
    const duration = (performance.now() - start).toFixed(1);
    const statusColor = res.ok ? 'color: #10b981;' : 'color: #ef4444;';
    console.log(`%c[API RESPONSE] 🛬 Status: ${res.status} (${res.statusText}) | Tempo: ${duration}ms`, `${statusColor} font-weight: bold; font-size: 11px;`);
    return res;
  } catch (err: any) {
    console.error(`%c[API CONNECTION ERROR] ❌ Falha ao conectar a ${url}:`, 'color: #ef4444; font-weight: bold;', err);
    throw err;
  }
};
