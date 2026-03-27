import { createClient } from '@supabase/supabase-js';
import LZString from 'lz-string';

const SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateClients() {
  console.log('Fetching old clients...');
  const { data: oldClients, error: fetchError } = await supabase
    .from('clients')
    .select('*');

  if (fetchError) {
    console.error('Error fetching old clients:', fetchError);
    return;
  }

  console.log(`Found ${oldClients?.length || 0} rows in old clients table.`);

  const newClients = [];

  for (const row of oldClients || []) {
    try {
      if (!row.data) continue;

      let parsed;
      // Try decompressing first
      try {
        const decompressed = LZString.decompressFromUTF16(row.data);
        parsed = JSON.parse(decompressed || row.data);
      } catch (e) {
        // If decompression fails, try parsing directly
        parsed = JSON.parse(row.data);
      }
      
      if (Array.isArray(parsed)) {
        newClients.push(...parsed.filter(c => c !== null));
      } else if (parsed !== null) {
        newClients.push(parsed);
      }
    } catch (e) {
      console.error(`Error processing row ${row.id}:`, e);
    }
  }

  console.log(`Prepared ${newClients.length} clients for migration.`);

  // Map to new schema, filtering out nulls
  const mappedClients = newClients
    .filter(c => c !== null && typeof c === 'object')
    .map(c => ({
      id: String(c.id),
      name: c.name || '',
      cpf: c.cpf || '',
      password: c.password || '',
      nationality: c.nationality,
      marital_status: c.maritalStatus,
      profession: c.profession,
      type: c.type || 'Cliente',
      der: c.der,
      med_expertise_date: c.medExpertiseDate,
      social_expertise_date: c.socialExpertiseDate,
      extension_date: c.extensionDate,
      dcb_date: c.dcbDate,
      ninety_days_date: c.ninetyDaysDate,
      security_mandate_date: c.securityMandateDate,
      address: c.address,
      legal_representative: c.legalRepresentative,
      legal_representative_cpf: c.legalRepresentativeCpf,
      legal_representative_marital_status: c.legalRepresentativeMaritalStatus,
      legal_representative_profession: c.legalRepresentativeProfession,
      legal_representative_address: c.legalRepresentativeAddress,
      is_daily_attention: !!c.isDailyAttention,
      is_urgent_attention: !!c.isUrgentAttention,
      is_archived: !!c.isArchived,
      is_referral: !!c.isReferral,
      referrer_name: c.referrerName,
      referrer_percentage: c.referrerPercentage || 0,
      total_fee: c.totalFee || 0,
      documents: c.documents || [],
      petitions: c.petitions || []
    }));

  console.log('Inserting into clients_v2...');
  
  // Insert in batches to avoid payload limits
  const batchSize = 50;
  for (let i = 0; i < mappedClients.length; i += batchSize) {
    const batch = mappedClients.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('clients_v2')
      .insert(batch);
      
    if (insertError) {
      console.error(`Error inserting batch ${i}:`, insertError);
    } else {
      console.log(`Inserted batch ${i} to ${i + batch.length}`);
    }
  }

  console.log('Migration completed!');
}

migrateClients();
