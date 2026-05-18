import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://nnhatyvrtlbkyfadumqo.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg");

async function run() {
  const { data, error } = await supabase.from('ai_conversations').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
run();
