// Arquivo de teste - NÃO usar chaves hardcoded aqui.
// Use variáveis de ambiente:
// SUPABASE_URL=... SUPABASE_ANON_KEY=... npx ts-node test_db.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error('Configure SUPABASE_URL e SUPABASE_ANON_KEY como variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('ai_conversations').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}
run();
