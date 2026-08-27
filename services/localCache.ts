/**
 * Cache local em IndexedDB para a primeira pintura da tela.
 *
 * Por que NAO localStorage: o app ja usa o localStorage para varias listas
 * (social_security_calculations guarda o CNIS completo de cada calculo,
 * inss_calculations, marketing_saved_posts, inss_records...). O limite de ~5 MB
 * ja estava saturado e qualquer cache adicional estourava a cota
 * (QuotaExceededError). O IndexedDB tem cota muito maior e nao disputa espaco
 * com essas chaves.
 *
 * Todas as funcoes falham em silencio: cache e otimizacao, nunca requisito.
 * Se o navegador bloquear o IndexedDB (aba anonima, storage desabilitado), o
 * app simplesmente carrega da rede como antes.
 */

const DB_NAME = 'gestao_inss_cache';
const DB_VERSION = 1;
const STORE = 'cache';

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[cache] IndexedDB indisponivel:', req.error);
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    } catch (e) {
      console.warn('[cache] Falha ao abrir IndexedDB:', e);
      resolve(null);
    }
  });

  return dbPromise;
};

export const cacheGet = async <T,>(key: string): Promise<T | null> => {
  try {
    const db = await openDb();
    if (!db) return null;

    return await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: any): Promise<void> => {
  try {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[cache] Falha ao gravar', key, tx.error);
          resolve();
        };
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    /* cache e best-effort */
  }
};

/**
 * Remove chaves de cache antigas que ficaram no localStorage antes da migracao
 * para IndexedDB — libera espaco na cota apertada do localStorage.
 */
export const clearLegacyLocalStorageCache = (keys: string[]) => {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignora */
  }
};
