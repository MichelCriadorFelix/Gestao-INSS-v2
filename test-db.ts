import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("No Supabase configuration found in environment variables.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Fetching active memory rules...");
  const { data: rules, error } = await supabase
    .from('ai_memory_rules')
    .select('*');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Found rules:", JSON.stringify(rules, null, 2));
}

run();
