import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkDocs() {
  try {
    console.log("=== SUPABASE METADATA AREA AUDIT ===");
    
    const { data, error } = await supabaseAdmin
      .from('legal_documents')
      .select('metadata')
      .limit(500);
      
    if (error) {
      console.error("Supabase Error:", error);
      return;
    }

    const titleMap = new Map<string, any>();
    data?.forEach((d: any) => {
      const t = d.metadata?.title;
      if (t && !titleMap.has(t)) {
        titleMap.set(t, d.metadata);
      }
    });

    console.log(`\nDistinct Titles and their associated areas:`);
    for (const [title, meta] of titleMap.entries()) {
      console.log(`- Title: "${title}"`);
      console.log(`  Areas: ${JSON.stringify(meta.areas || [])}`);
    }

  } catch (err: any) {
    console.error("Error executing check:", err.message);
  }
}

checkDocs();
