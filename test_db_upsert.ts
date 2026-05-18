// Arquivo de teste - NÃO usar chaves hardcoded aqui.
// Use variáveis de ambiente:
// SUPABASE_URL=... SUPABASE_ANON_KEY=... npx ts-node test_db_upsert.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error('Configure SUPABASE_URL e SUPABASE_ANON_KEY como variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('ai_conversations').upsert({
    id: "test_id_123",
    lawyer_type: "michel",
    title: "Test",
    date: "01/04/2026",
    messages: []
  });
  console.log(error);
}
run();
