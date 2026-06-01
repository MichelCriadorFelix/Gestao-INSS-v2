import { supabase } from '../supabaseClient';
import LZString from 'lz-string';

const getSupabase = () => supabase;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { name: string; url: string; type: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  ai_name: 'michel' | 'luana' | 'felix_castro' | 'fabricia';
  documents?: any[];
}

export interface SavedCalculation {
  id: string;
  date: string;
  clientName: string;
  data: any;
}

export const supabaseService = {
  // AI Conversations
  async saveAIConversation(session: ChatSession) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    let messagesToSave = session.messages.filter(m => !m.content?.startsWith('[SYSTEM_DOCUMENTS_METADATA]'));
    if (session.documents && session.documents.length > 0) {
      messagesToSave = [...messagesToSave, {
        id: 'system-documents-metadata',
        role: 'user',
        content: `[SYSTEM_DOCUMENTS_METADATA]\n${JSON.stringify(session.documents)}`,
        timestamp: new Date().toISOString()
      }];
    }

    const { data, error } = await supabase
      .from('ai_conversations')
      .upsert({
        id: session.id,
        lawyer_type: session.ai_name,
        title: session.title,
        date: session.date,
        messages: messagesToSave
      });
      
    if (error) {
      if (error.message?.includes('row-level security') || error.code === '42501' || error.message?.includes('RLS')) {
        console.warn('Supabase RLS bloqueado. A conversa continuará apenas localmente no navegador por enquanto.');
        return session;
      }
      console.error('Error saving AI conversation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getAIConversations(aiName: 'michel' | 'luana' | 'felix_castro' | 'fabricia') {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lawyer_type', aiName)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching AI conversations from Supabase:', error);
      return [];
    }
    
    return (data || []).map(session => {
      let documents = [];
      let messages = session.messages || [];
      const docsMsgIndex = messages.findIndex((m: any) => m.content?.startsWith('[SYSTEM_DOCUMENTS_METADATA]'));
      if (docsMsgIndex !== -1) {
        try {
          const docsJson = messages[docsMsgIndex].content.replace('[SYSTEM_DOCUMENTS_METADATA]\n', '');
          documents = JSON.parse(docsJson);
          messages = messages.filter((_: any, i: number) => i !== docsMsgIndex);
        } catch (e) {
          console.error('Error parsing documents metadata', e);
        }
      }
      return {
        ...session,
        messages,
        documents
      };
    });
  },

  async deleteAIConversation(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting AI conversation from Supabase:', error);
      throw error;
    }
  },

  // Marketing Posts (Reusing ai_conversations table)
  // Feature: Theme-based image persistence
  async saveMarketingPost(post: any) {
    const supabase = getSupabase();
    if (!supabase) {
      console.error('Supabase not initialized in saveMarketingPost');
      return null;
    }

    console.log('Saving marketing post to Supabase:', post.id);

    const { data, error } = await supabase
      .from('ai_conversations')
      .upsert({
        id: post.id,
        lawyer_type: 'marketing',
        title: post.topic || 'Sem tema',
        date: post.date,
        messages: [{
          id: post.id,
          role: 'assistant',
          content: JSON.stringify(post),
          timestamp: post.date
        }]
      });
      
    if (error) {
      console.error('Error saving marketing post to Supabase:', error);
      throw error;
    }
    console.log('Marketing post saved successfully:', post.id);
    return data;
  },

  async getMarketingPosts() {
    const supabase = getSupabase();
    if (!supabase) {
      console.error('Supabase not initialized in getMarketingPosts');
      return [];
    }
    
    console.log('Fetching marketing posts from Supabase...');
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lawyer_type', 'marketing')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching marketing posts from Supabase:', error);
      return [];
    }
    
    console.log(`Fetched ${data?.length || 0} marketing posts from Supabase.`);
    
    return (data || []).map(row => {
      try {
        if (row.messages && row.messages.length > 0) {
          return JSON.parse(row.messages[0].content);
        }
      } catch (e) {
        console.error('Error parsing marketing post JSON:', e);
      }
      return null;
    }).filter(Boolean);
  },

  async deleteMarketingPost(id: string) {
    const supabase = getSupabase();
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('lawyer_type', 'marketing');
      
    if (error) {
      console.error('Error deleting marketing post from Supabase:', error);
      return false;
    }
    return true;
  },

  // Theme Images (Reusable images for specific topics)
  async saveThemeImage(topic: string, imageUrl: string, description?: string) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('ai_conversations')
      .upsert({
        id: `theme_img_${topic.toLowerCase().replace(/\s+/g, '_')}`,
        lawyer_type: 'theme_image',
        title: topic,
        date: new Date().toISOString(),
        messages: [{
          id: 'img',
          role: 'assistant',
          content: imageUrl,
          description: description || '',
          timestamp: new Date().toISOString()
        }]
      });

    if (error) {
      console.error('Error saving theme image:', error);
      throw error;
    }
    return data;
  },

  async getThemeImages() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lawyer_type', 'theme_image')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching theme images:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      topic: row.title,
      url: row.messages?.[0]?.content || '',
      description: row.messages?.[0]?.description || ''
    }));
  },

  async getThemeImage(topic: string) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('messages')
      .eq('lawyer_type', 'theme_image')
      .eq('id', `theme_img_${topic.toLowerCase().replace(/\s+/g, '_')}`)
      .maybeSingle();

    if (error) {
      console.error('Error fetching theme image:', error);
      return null;
    }

    if (data && data.messages && data.messages.length > 0) {
      return {
        url: data.messages[0].content,
        description: data.messages[0].description || ''
      };
    }
    return null;
  },

  // Social Security Calculations
  async saveCalculation(calc: SavedCalculation) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('social_security_calculations')
      .upsert({
        id: calc.id,
        client_name: calc.clientName,
        date: calc.date,
        data: calc.data
      });
      
    if (error) {
      if (error.message?.includes('row-level security') || error.code === '42501' || error.message?.includes('RLS')) {
        console.warn('Supabase RLS bloqueado para salvamento de cálculo.');
        return calc;
      }
      console.error('Error saving calculation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getCalculations() {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('social_security_calculations')
      .select('*')
      .order('id', { ascending: false });
      
    if (error) {
      console.error('Error fetching calculations from Supabase:', error);
      return [];
    }
    
    return (data || []).map(item => ({
      id: item.id,
      clientName: item.client_name,
      date: item.date,
      data: item.data
    }));
  },

  async deleteCalculation(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('social_security_calculations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting calculation from Supabase:', error);
      throw error;
    }
  },

  // Labor Calculations
  async saveLaborCalculation(calc: any) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('labor_calculations')
      .upsert({
        id: calc.id,
        employee_name: calc.employeeName,
        date: calc.date,
        total_value: calc.totalValue,
        data: calc.data
      });
      
    if (error) {
      console.error('Error saving labor calculation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getLaborCalculations() {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('labor_calculations')
      .select('*')
      .order('id', { ascending: false });
      
    if (error) {
      console.error('Error fetching labor calculations from Supabase:', error);
      return [];
    }
    
    return (data || []).map(item => {
      // Ensure backward compatibility for LaborData
      const laborData = item.data || {};
      
      // Patch Adicional Noturno
      if (laborData.adicionalNoturno) {
        if (laborData.adicionalNoturno.applySumula60 === undefined) {
          laborData.adicionalNoturno.applySumula60 = false;
        }
        if (laborData.adicionalNoturno.extendedEndTime === undefined) {
          laborData.adicionalNoturno.extendedEndTime = '';
        }
      }

      return {
        id: item.id,
        employeeName: item.employee_name,
        date: item.date,
        totalValue: item.total_value || 0,
        data: laborData
      };
    });
  },

  async deleteLaborCalculation(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('labor_calculations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting labor calculation from Supabase:', error);
      throw error;
    }
  },

  // Clients
  async saveClient(client: any) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    // Garantir que o ID seja uma string válida e não nula
    const clientId = String(client.id || Date.now());

    // Map to new schema
    const record: any = {
      id: clientId,
      name: client.name || 'Sem Nome',
      cpf: client.cpf || '',
      password: client.password || '',
      nationality: client.nationality,
      marital_status: client.maritalStatus,
      profession: client.profession,
      type: client.type || 'Cliente',
      der: client.der,
      med_expertise_date: client.medExpertiseDate,
      social_expertise_date: client.socialExpertiseDate,
      extension_date: client.extensionDate,
      dcb_date: client.dcbDate,
      ninety_days_date: client.ninetyDaysDate,
      security_mandate_date: client.securityMandateDate,
      address: client.address,
      gender: client.gender,
      legal_representative: client.legalRepresentative,
      legal_representative_gender: client.legalRepresentativeGender,
      legal_representative_cpf: client.legalRepresentativeCpf,
      legal_representative_marital_status: client.legalRepresentativeMaritalStatus,
      legal_representative_profession: client.legalRepresentativeProfession,
      legal_representative_address: client.legalRepresentativeAddress,
      whatsapp: client.whatsapp,
      legal_representative_nationality: client.legalRepresentativeNationality,
      is_daily_attention: !!client.isDailyAttention,
      is_urgent_attention: !!client.isUrgentAttention,
      is_archived: !!client.isArchived,
      is_referral: !!client.isReferral,
      referrer_name: client.referrerName,
      referrer_percentage: client.referrerPercentage || 0,
      total_fee: client.totalFee || 0,
      documents: client.documents || [],
      narrative_certificates: client.narrativeCertificates || [],
    };

    // Only include petitions if they are provided (prevent overwriting with empty array from summaries)
    if (client.petitions !== undefined) {
      record.petitions = client.petitions;
    }

    console.log('Salvando cliente no Supabase:', record.id);

    const { data, error } = await supabase
      .from('clients_v2')
      .upsert(record);
      
    if (error) {
      console.error('Erro detalhado ao salvar cliente no Supabase:', error);
      throw error;
    }
    return data;
  },

  async getClients() {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    // Fetch summary including documents (now lightweight with URLs) to show counts
    const { data, error } = await supabase
      .from('clients_v2')
      .select('id, name, cpf, password, nationality, marital_status, profession, type, der, med_expertise_date, social_expertise_date, extension_date, dcb_date, ninety_days_date, security_mandate_date, address, gender, legal_representative, legal_representative_gender, legal_representative_cpf, legal_representative_marital_status, legal_representative_profession, legal_representative_address, is_daily_attention, is_urgent_attention, is_archived, is_referral, referrer_name, referrer_percentage, total_fee, whatsapp, legal_representative_nationality, narrative_certificates');
      
    if (error) {
      console.error('Error fetching clients from Supabase:', error);
      throw error;
    }
    
    return (data || []).map(c => ({
      id: String(c.id),
      name: c.name,
      cpf: c.cpf,
      password: c.password,
      nationality: c.nationality,
      maritalStatus: c.marital_status,
      profession: c.profession,
      type: c.type,
      der: c.der,
      medExpertiseDate: c.med_expertise_date,
      socialExpertiseDate: c.social_expertise_date,
      extensionDate: c.extension_date,
      dcbDate: c.dcb_date,
      ninetyDaysDate: c.ninety_days_date,
      securityMandateDate: c.security_mandate_date,
      address: c.address,
      gender: c.gender,
      legalRepresentative: c.legal_representative,
      legalRepresentativeGender: c.legal_representative_gender,
      legalRepresentativeCpf: c.legal_representative_cpf,
      legalRepresentativeMaritalStatus: c.legal_representative_marital_status,
      legalRepresentativeProfession: c.legal_representative_profession,
      legalRepresentativeAddress: c.legal_representative_address,
      whatsapp: c.whatsapp,
      legalRepresentativeNationality: c.legal_representative_nationality,
      isDailyAttention: c.is_daily_attention,
      isUrgentAttention: c.is_urgent_attention,
      isArchived: c.is_archived,
      isReferral: c.is_referral,
      referrerName: c.referrer_name,
      referrerPercentage: c.referrer_percentage,
      totalFee: c.total_fee,
      documents: [],
      documentCount: 0,
      petitionCount: 0,
      narrativeCertificates: [],
      narrativeCertificateCount: 0
    }));
  },

  async getClientDetails(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('clients_v2')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching client details from Supabase:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: String(data.id),
      name: data.name,
      cpf: data.cpf,
      password: data.password,
      nationality: data.nationality,
      maritalStatus: data.marital_status,
      profession: data.profession,
      type: data.type,
      der: data.der,
      medExpertiseDate: data.med_expertise_date,
      socialExpertiseDate: data.social_expertise_date,
      extensionDate: data.extension_date,
      dcbDate: data.dcb_date,
      ninetyDaysDate: data.ninety_days_date,
      securityMandateDate: data.security_mandate_date,
      address: data.address,
      gender: data.gender,
      legalRepresentative: data.legal_representative,
      legalRepresentativeGender: data.legal_representative_gender,
      legalRepresentativeCpf: data.legal_representative_cpf,
      legalRepresentativeMaritalStatus: data.legal_representative_marital_status,
      legalRepresentativeProfession: data.legal_representative_profession,
      legalRepresentativeAddress: data.legal_representative_address,
      whatsapp: data.whatsapp,
      legalRepresentativeNationality: data.legal_representative_nationality,
      isDailyAttention: data.is_daily_attention,
      isUrgentAttention: data.is_urgent_attention,
      isArchived: data.is_archived,
      isReferral: data.is_referral,
      referrerName: data.referrer_name,
      referrerPercentage: data.referrer_percentage,
      totalFee: data.total_fee,
      documents: data.documents || [],
      petitions: data.petitions || [],
      narrativeCertificates: data.narrative_certificates || []
    };
  },

  async deleteClient(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('clients_v2')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting client from Supabase:', error);
      throw error;
    }
  },

  // Contracts
  async saveContract(contract: any) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const record = {
      id: String(contract.id || Date.now()),
      client_id: contract.clientId,
      first_name: contract.firstName || '',
      last_name: contract.lastName || '',
      cpf: contract.cpf || '',
      service_type: contract.serviceType || '',
      lawyer: contract.lawyer || '',
      total_fee: contract.totalFee || 0,
      status: contract.status || 'Pendente',
      payment_method: contract.paymentMethod || 'Parcelado',
      installments_count: contract.installmentsCount || 0,
      payments: contract.payments || [],
      created_at: contract.createdAt || new Date().toISOString(),
      concluded_at: contract.concludedAt || null,
      lawyer_split: contract.lawyerSplit ?? 60
    };

    const { data, error } = await supabase
      .from('contracts_v2')
      .upsert(record);
      
    if (error) {
      console.error('Error saving contract to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getContracts() {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('contracts_v2')
      .select('*');
      
    if (error) {
      console.error('Error fetching contracts from Supabase:', error);
      throw error;
    }
    
    return (data || []).map(c => ({
      id: String(c.id),
      clientId: c.client_id,
      firstName: c.first_name,
      lastName: c.last_name,
      cpf: c.cpf,
      serviceType: c.service_type,
      lawyer: c.lawyer,
      totalFee: c.total_fee,
      status: c.status,
      paymentMethod: c.payment_method,
      installmentsCount: c.installments_count,
      payments: c.payments,
      createdAt: c.created_at,
      concludedAt: c.concluded_at,
      lawyerSplit: c.lawyer_split ?? 60
    }));
  },

  async deleteContract(id: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('contracts_v2')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting contract from Supabase:', error);
      throw error;
    }
  },

  async getPdfCache(fileHash: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('pdf_text_cache')
      .select('full_text')
      .eq('file_hash', fileHash)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching PDF cache from Supabase:', error);
      return null;
    }
    return data?.full_text || null;
  },

  async savePdfCache(fileHash: string, fileName: string, fullText: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('pdf_text_cache')
      .upsert({
        file_hash: fileHash,
        file_name: fileName,
        full_text: fullText,
        created_at: new Date().toISOString()
      }, { onConflict: 'file_hash' });
      
    if (error) {
      console.error('Error saving PDF cache to Supabase:', error);
      // We don't throw here to not block the user if cache fails
    }
  },

  // RAG (Retrieval-Augmented Generation)
  async saveLegalDocuments(chunks: { content: string, metadata: any, embedding: number[] }[]) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('legal_documents')
      .insert(chunks);
      
    if (error) {
      console.error('Error saving legal documents to Supabase:', error);
      throw error;
    }
    return data;
  },

  async searchLegalDocuments(embedding: number[], matchThreshold = 0.25, matchCount = 5): Promise<Array<{id: number, content: string, metadata: any, similarity: number, is_single_chunk: boolean | null}>> {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .rpc('match_legal_documents_smart', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      });
      
    if (error) {
      if (error.message?.includes('timeout')) {
        console.warn('Supabase RAG search timeout - possibly missing index or too many records. Continuing without extra context.');
      } else {
        console.error('Error searching legal documents in Supabase:', error);
      }
      return [];
    }
    return data || [];
  },

  async searchLegalDocumentsByArea(
    embedding: number[],
    areas: string[],
    matchThreshold = 0.25,
    matchCount = 30
  ): Promise<Array<{id: number, content: string,
    metadata: any, similarity: number,
    is_single_chunk: boolean | null}>> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let areaData: any[] = [];
    let legacyData: any[] = [];

    // Buscas paralelas para ampla cobertura e velocidade garantida (modo cabal!)
    try {
      const [areaRes, legacyRes] = await Promise.all([
        supabase.rpc('match_legal_documents_by_area', {
          query_embedding: embedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
          filter_areas: areas
        }),
        supabase.rpc('match_legal_documents_smart', {
          query_embedding: embedding,
          match_threshold: matchThreshold,
          match_count: matchCount
        })
      ]);

      if (areaRes.data) areaData = areaRes.data;
      if (legacyRes.data) legacyData = legacyRes.data;
    } catch (err) {
      console.warn("Error doing parallel RAG searches, trying fallback:", err);
      try {
        const legacyRes = await supabase.rpc('match_legal_documents_smart', {
          query_embedding: embedding,
          match_threshold: matchThreshold,
          match_count: matchCount
        });
        if (legacyRes.data) legacyData = legacyRes.data;
      } catch (innerErr) {
        console.error("Critical fallback search failed:", innerErr);
      }
    }

    // Merge sem duplicatas
    const seen = new Set<number>();
    const merged: any[] = [];

    // 1. Adicionar resultados por área primeiro
    areaData.forEach((doc: any) => {
      seen.add(doc.id);
      merged.push(doc);
    });

    // 2. Adicionar da busca geral se passarem na validação inteligente
    // (para recuperar Código Civil ou outros que faltem áreas classificadas)
    legacyData.forEach((doc: any) => {
      if (!seen.has(doc.id)) {
        const docAreas = doc.metadata?.areas;
        if (!docAreas || !Array.isArray(docAreas) || docAreas.length === 0 || docAreas.some((a: string) => areas.includes(a))) {
          seen.add(doc.id);
          merged.push(doc);
        }
      }
    });

    // Ordena decrescente pela similaridade
    const sorted = merged.sort((a, b) => {
      const simA = a.similarity ?? a.a_similarity ?? 0;
      const simB = b.similarity ?? b.a_similarity ?? 0;
      return simB - simA;
    });

    if (sorted.length < 5 && matchThreshold > 0.25) {
      console.log(`[RAG Self-Healing] Poucos resultados (${sorted.length}) com limiar ${matchThreshold}. Resgatando com limiar 0.25...`);
      return this.searchLegalDocumentsByArea(embedding, areas, 0.25, matchCount);
    }

    return sorted.slice(0, matchCount);
  },

  async searchByTitles(titles: string[], chunksPerTitle = 15, query?: string): Promise<any[]> {
    const supabase = getSupabase();
    if (!supabase || titles.length === 0) return [];

    const results: any[] = [];
    const seen = new Set<number>();

    // Extração de números de artigos/parágrafos com suporte a:
    //   - ponto milhar: "art. 1.829", "Art. 1.851"
    //   - artigo composto: "art. 19-E", "art. 19-A"
    //   - artigo simples: "art. 15", "art 725", "art. 1851"
    //   - múltiplos: "arts. 124 e 127"
    // NUNCA captura números soltos sem prefixo "art./§/parágrafo" — evita ruído.
    const articleNumbers: string[] = [];
    if (query) {
      const add = (n: string) => { if (n && !articleNumbers.includes(n)) articleNumbers.push(n); };

      // 1. Ponto milhar: "art. 1.829", "Art. 1.851-A"
      [...query.matchAll(/(?:art(?:igo|s|\.)?|§|parágrafo)\s*(\d{1,4}\.\d{3}(?:\-[A-Za-z])?)/gi)]
        .forEach(m => add(m[1]));

      // 2. Artigo composto sem ponto milhar: "art. 19-E", "art 19-A"
      [...query.matchAll(/(?:art(?:igo|s|\.)?|§|parágrafo)\s*(\d+\-[A-Za-z])/gi)]
        .forEach(m => add(m[1]));

      // 3. Artigo simples (1-4 dígitos): "art. 15", "art 725", "art. 1851"
      [...query.matchAll(/(?:art(?:igo|s|\.)?|§|parágrafo)\s*(\d{1,4})/gi)]
        .forEach(m => add(m[1]));

      // 4. "e NNN" após artigo já detectado: "arts. 124 e 127"
      [...query.matchAll(/\be\s+(\d{1,4})\b/gi)]
        .forEach(m => add(m[1]));

      // 5. Deduplicar: remover números que são prefixo de outro mais específico na lista
      //    Ex.: ["1.829", "1"] → remove "1" porque "1829" já está coberto por "1.829"
      articleNumbers.splice(0, articleNumbers.length,
        ...articleNumbers.filter(n => {
          const nDigits = n.replace(/[.\-]/g, '');
          return !articleNumbers.some(other => {
            if (other === n) return false;
            const oDigits = other.replace(/[.\-]/g, '');
            return oDigits.startsWith(nDigits) && oDigits.length > nDigits.length;
          });
        })
      );
    }

    // Extrair palavras-chave relevantes da query para busca complementar interna nas leis correspondentes
    const keywords: string[] = [];
    if (query) {
      const stopWords = new Set([
        'artigo', 'artigos', 'sobre', 'como', 'quem', 'traz', 'qual', 'para', 'onde', 'quais', 'diz', 'esta', 'este', 'naquela', 'naquele', 'pelo', 'pela', 'pelos', 'pelas',
        'do', 'da', 'dos', 'das', 'de', 'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'em', 'para', 'com', 'contra', 'por', 'sem', 'sob', 'sobre', 'atras', 'entre',
        'lei', 'organica', 'municipal', 'municipalidade', 'estatuto', 'servidor', 'servidores', 'publico', 'publicos', 'comarca'
      ]);
      const normalQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const words = normalQuery.split(/[^a-z0-9]/).filter(w => w.length >= 3);
      words.forEach(w => {
        if (!stopWords.has(w) && isNaN(Number(w)) && !keywords.includes(w)) {
          keywords.push(w);
        }
      });
    }

    // Execução concorrência 100% paralela de alto nível (Padrão Ouro / PHD) para busca de documentos!
    const titlePromises = titles.map(async (title) => {
      const docResults: any[] = [];
      const titleSeen = new Set<number>();
      const subQueries: any[] = [];

      // 1. Busca integrada das partes do documento (Subqueries paralelas para o mesmo título)
      if (articleNumbers.length > 0) {
        const filters: string[] = [];
        articleNumbers.forEach(num => {
          const semPonto = num.replace(/\./g, '');
          // Converter número sem ponto milhar em com ponto: "1851" → "1.851"
          const comPonto = /^\d{4}$/.test(semPonto)
            ? `${semPonto.slice(0, 1)}.${semPonto.slice(1)}`
            : null;

          const filterVariants: string[] = [];
          const addV = (n: string) => {
            filterVariants.push(`content.ilike.%Art. ${n}.%`); // "Art. 1.829." ponto final
            filterVariants.push(`content.ilike.%Art. ${n} %`); // "Art. 725 P" espaço
            filterVariants.push(`content.ilike.%Art. ${n},%`); // "Art. 15,"
            filterVariants.push(`content.ilike.%Art. ${n}-%`); // "Art. 19-E"
            filterVariants.push(`content.ilike.%§ ${n}%`);
            filterVariants.push(`content.ilike.%§ ${n}º%`);
          };

          addV(num);
          if (semPonto !== num) addV(semPonto); // tinha ponto → adicionar sem ponto
          if (comPonto && comPonto !== num) addV(comPonto); // sem ponto → adicionar com ponto

          const uniqueVariants = [...new Set(filterVariants)];
          filters.push(...uniqueVariants);
        });

        const uniqueFilters = [...new Set(filters)];

        // Executa em lotes integrados no PostgREST para não estourar tamanho de query
        const batchSize = 18;
        for (let i = 0; i < uniqueFilters.length; i += batchSize) {
          const filterSlice = uniqueFilters.slice(i, i + batchSize).join(',');
          subQueries.push(
            supabase
              .from('legal_documents')
              .select('*')
              .eq('metadata->>title', title)
              .or(filterSlice)
              .limit(15)
              .then(res => {
                if (res.error) console.error(`Error in article query for title ${title}:`, res.error);
                return (res.data || []).map(d => ({ ...d, is_target_article: true }));
              })
          );
        }
      }

      if (keywords.length > 0) {
        const filters = keywords.map(kw => `content.ilike.%${kw}%`);
        const batchSize = 10;
        for (let i = 0; i < filters.length; i += batchSize) {
          const filterSlice = filters.slice(i, i + batchSize).join(',');
          subQueries.push(
            supabase
              .from('legal_documents')
              .select('*')
              .eq('metadata->>title', title)
              .or(filterSlice)
              .limit(10)
              .then(res => {
                if (res.error) console.error(`Error in keyword query for title ${title}:`, res.error);
                return (res.data || []).map(d => ({ ...d, is_target_keyword: true }));
              })
          );
        }
      }

      // Resolvendo as subqueries de artigo e palavra-chave primeiro
      const queryResults = await Promise.all(subQueries);
      queryResults.forEach((list) => {
        list.forEach((doc: any) => {
          if (!titleSeen.has(doc.id)) {
            titleSeen.add(doc.id);
            docResults.push(doc);
          } else {
            const existing = docResults.find(d => d.id === doc.id);
            if (existing) {
              if (doc.is_target_article) existing.is_target_article = true;
              if (doc.is_target_keyword) existing.is_target_keyword = true;
            }
          }
        });
      });

      // 3. Fallback: carrega chunks iniciais do documento APENAS quando
      //    não foi especificado artigo ou keyword (contexto geral da lei).
      //    Se artigo foi especificado, a busca direta já é suficiente e
      //    o fallback só adicionaria ruído de Arts. 1-N irrelevantes.
      const hasDirectHit = docResults.length > 0;
      const skipFallback = (articleNumbers.length > 0 || keywords.length > 0) && hasDirectHit;

      if (!skipFallback) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('legal_documents')
          .select('*')
          .eq('metadata->>title', title)
          .order('id', { ascending: true }) // Mantém ordem sequencial científica dos artigos
          .limit(chunksPerTitle);

        if (!fallbackError && fallbackData) {
          fallbackData.forEach((doc: any) => {
            if (!titleSeen.has(doc.id)) {
              titleSeen.add(doc.id);
              docResults.push(doc);
            }
          });
        }
      }

      return docResults.map(doc => {
        let scoreBoost = 0.8;
        if (doc.is_target_article) {
          scoreBoost = 1.8; // Artigos exatos possuem máxima precedência
        } else if (doc.is_target_keyword) {
          scoreBoost = 1.3;
        }
        return { ...doc, similarity: scoreBoost, source: 'title_exact' };
      });
    });

    const docGroupResults = await Promise.all(titlePromises);
    docGroupResults.forEach(r => results.push(...r));

    // Ordena priorizando relevância estrutural e remove duplicatas globais
    const finalSeen = new Set<number>();
    const finalResults: any[] = [];
    results
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .forEach(doc => {
        if (!finalSeen.has(doc.id)) {
          finalSeen.add(doc.id);
          finalResults.push(doc);
        }
      });

    return finalResults;
  },

  async keywordSearchLegalDocuments(query: string, matchCount = 15) {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    // Extract potential legal identifiers (e.g., IN 128, Art. 482, Lei 8.213)
    const identifiers = query.match(/(IN|Art|Lei|Decreto|Súmula|Enunciado)\.?\s*\d+/gi) || [];
    
    // Split query into terms, but be more inclusive for numbers and identifiers
    const terms = query.split(/\s+/).filter(t => t.length >= 2);
    if (terms.length === 0 && identifiers.length === 0) return [];

    const rawTerms = Array.from(new Set([...identifiers, ...terms])).slice(0, 10);
    
    // Filter out common Portuguese/English stop words to avoid flooding the PostgREST OR clause with useless terms (e.g., 'sao', 'joao', 'de', 'do')
    const stopWords = new Set([
      'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'em', 'para', 'com', 'contra', 'por', 'sem', 'sob', 'sobre', 'atras', 'entre',
      'como', 'quem', 'qual', 'quais', 'onde', 'quando', 'esta', 'este', 'isto', 'aquilo', 'o', 'a', 'os', 'as', 'e', 'ou', 'se', 'mas', 'pelo', 'pela', 'pelos', 'pelas'
    ]);
    
    const searchTerms = rawTerms.filter(term => {
      const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return !stopWords.has(normalizedTerm);
    });

    if (searchTerms.length === 0) return [];
    
    let filter = '';
    searchTerms.forEach((term) => {
      // Escape special characters for ilike
      // Supabase PostgREST uses % as wildcard, not *
      // IMPORTANT: Remove commas as they break the OR logic tree in PostgREST
      const escapedTerm = term.replace(/[%_]/g, '\\$0')
                             .replace(/[(),"'`\\/:]/g, '') // Remove potentially breaking characters
                             .replace(/\s+/g, '%')          // Replace spaces with % to keep PostgREST URLs clean and continuous
                             .substring(0, 30);    // Avoid too long terms
      if (escapedTerm.length < 2) return;
      
      if (filter) filter += ',';
      filter += `content.ilike.%${escapedTerm}%,metadata->>title.ilike.%${escapedTerm}%`;
    });

    if (!filter) return [];

    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .or(filter)
      .limit(matchCount);
      
    if (error) {
      console.error('Error keyword searching legal documents in Supabase:', error);
      return [];
    }
    return data || [];
  },

  // Busca documentos maiores que minChars — usado para rechunking no browser
  async getLargeDocuments(minChars: number = 8000, batchLimit: number = 1): Promise<Array<{id: number, content: string, metadata: any}>> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .rpc('get_large_legal_documents', { min_chars: minChars, batch_limit: batchLimit, batch_offset: 0 });
    if (error) throw error;
    return data || [];
  },

  async countLargeDocuments(minChars: number = 8000): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const { data, error } = await supabase
      .rpc('count_large_legal_documents', { min_chars: minChars });
    if (error) throw error;
    return Number(data) || 0;
  },

  // Atualiza o embedding de um chunk específico (usado no reembedding pós-rechunking SQL)
  async updateEmbedding(id: number, embedding: number[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
      .from('legal_documents')
      .update({ embedding })
      .eq('id', id);
    if (error) throw error;
  },

  // Busca 1 chunk sem embedding para processar
  async getOneChunkNeedingEmbedding(): Promise<{id: number, content: string, metadata: any} | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_one_chunk_needing_embedding');
    if (error) throw error;
    return data?.[0] || null;
  },

  // Conta chunks sem embedding
  async countChunksNeedingEmbedding(): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const { data, error } = await supabase.rpc('count_chunks_needing_embedding');
    if (error) throw error;
    return Number(data) || 0;
  },

  // Divide UM documento grande em sub-chunks via SQL (sem embedding — rápido)
  async splitOneLargeDocument(): Promise<{done: boolean, titulo?: string, chars?: number, chunks_gerados?: number, message?: string}> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase não disponível');
    const { data, error } = await supabase.rpc('split_one_large_document', {
      max_chunk_chars: 2500,
      overlap_chars: 200,
      min_large_chars: 8000
    });
    if (error) throw error;
    return data as any;
  },

  async deleteLegalDocumentById(id: number) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('legal_documents').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteLegalDocumentByTitle(title: string) {
    const supabase = getSupabase();
    if (!supabase) return null;
    
    // We use the JSON operator ->> to query inside the metadata JSONB column
    const { error } = await supabase
      .from('legal_documents')
      .delete()
      .eq('metadata->>title', title);
      
    if (error) {
      console.error('Error deleting legal document from Supabase:', error);
      throw error;
    }
  },

  async getLegalDocumentTitles(): Promise<string[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('metadata')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) {
        console.error('Error fetching legal document titles from Supabase:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }
    
    // Filter unique titles manually
    const titles = allData.map(item => {
      const metadata = item.metadata as any;
      return metadata?.title ? String(metadata.title) : null;
    }).filter(Boolean) as string[];
    
    return [...new Set(titles)].sort();
  },

  filterLawTitles(allLawTitles: string[], queryText: string): string[] {
    const normQuery = queryText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Conceitos Semânticos e Leis Principais Mapeadas
    const matchedByConcept = new Set<string>();

    // Conceito: Civil / Sucessões / Família / Alvará
    const civilKeywords = ['alvara', 'sucess', 'herde', 'heranc', 'partilha', 'inventar', 'bens', 'filho', 'neto', 'avo', 'pai', 'mae', 'obito', 'morte', 'falec', 'represent', 'pre-mort', 'divorcio', 'casamento', 'uniao estavel', 'parentesco', 'morte', 'de cujus', 'legitima', 'quinhão', 'cota-parte', 'banco', 'saldo', 'poupança', 'levantamento', 'alvará judicial'];
    if (civilKeywords.some(kw => normQuery.includes(kw))) {
      // Buscar títulos que correspondem a Código Civil, CPC, Lei 6858
      allLawTitles.forEach(t => {
        const nt = t.toLowerCase();
        if (nt.includes('codigo civil') || nt.includes('codigo de processo civil') || nt.includes('6.858') || nt.includes('85.845') || nt.includes('decreto 85')) {
          matchedByConcept.add(t);
        }
      });
    }

    // Conceito: Previdenciário / Benefícios / INSS
    const prevKeywords = ['aposentador', 'inss', 'previdenc', 'pensao', 'beneficio', 'loas', 'bpc', 'miserabilidad', 'renda', 'deficiente', 'idoso', 'carencia', 'tempo de contribuicao', 'cnis', 'segurado', 'auxilio', 'doenca', 'pericia', 'incapacidade', 'pensionista', 'rpps', 'der', 'dcb', 'concessão'];
    if (prevKeywords.some(kw => normQuery.includes(kw))) {
      allLawTitles.forEach(t => {
        const nt = t.toLowerCase();
        if (nt.includes('8.213') || nt.includes('3.048') || nt.includes('8.742') || nt.includes('8.212') || nt.includes('instrucao normativa') || nt.includes('pres/inss') || nt.includes('sumula') || nt.includes('tema')) {
          matchedByConcept.add(t);
        }
      });
    }

    // Conceito: Trabalhista / CLT
    const cltKeywords = ['trabalh', 'empregad', 'clt', 'demiss', 'justa causa', 'rescis', 'salario', 'hora extra', 'seguro-desemprego', 'aviso previo', 'fgts', 'carteira de trabalho', 'ctps', 'vinculo', 'adicional', 'maternidade', 'ferias', 'convenção coletiva'];
    if (cltKeywords.some(kw => normQuery.includes(kw))) {
      allLawTitles.forEach(t => {
        const nt = t.toLowerCase();
        if (nt.includes('consolidacao') || nt.includes('c.l.t') || nt.includes('8.036') || nt.includes('fgts') || nt.includes('constituição') || nt.includes('decreto-lei nº 5.452')) {
          matchedByConcept.add(t);
        }
      });
    }

    // Conceito: Consumidor / Bancos
    const consKeywords = ['consumidor', 'cdc', 'banc', 'tarifa', 'fraude', 'empréstimo', 'bloqueio', 'danos morais', 'vício', 'compra', 'serviço', 'fornecedor', 'súmula 297', 'súmula 479', 'responsabilidade objetiva'];
    if (consKeywords.some(kw => normQuery.includes(kw))) {
      allLawTitles.forEach(t => {
        const nt = t.toLowerCase();
        if (nt.includes('defesa do consumidor') || nt.includes('c.d.c') || nt.includes('297') || nt.includes('479')) {
          matchedByConcept.add(t);
        }
      });
    }

    // 2. Filtro Geral inteligente para correspondências específicas
    const matchedByGeneral = allLawTitles.filter((title) => {
      const normTitle = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // 1. Inclusão direta do título
      if (normQuery.includes(normTitle)) return true;

      // 2. Correspondência por números de lei/súmula/tema/decreto/IN
      const cleanQuery = normQuery.replace(/[.\-\/\s]/g, '');
      const rawNumberTokens = title.match(/\d+(?:[.\-\/]\d+)*/g) || [];
      const numberVariants = new Set<string>();
      for (const token of rawNumberTokens) {
        numberVariants.add(token.replace(/[.\-\/]/g, '')); // token cheio sem separadores
        const segments = token.split('/');
        segments.forEach((part) => {
          const clean = part.replace(/[.\-]/g, '');
          const looksLikeYear = /^(19|20)\d{2}$/.test(clean);
          if (clean.length >= 2 && (!looksLikeYear || segments.length === 1)) {
            numberVariants.add(clean);
          }
        });
      }
      for (const variant of numberVariants) {
        if (variant.length >= 2 && cleanQuery.includes(variant)) {
          return true;
        }
      }

      // 3. Correspondência inteligente por coocorrência (ex: "Súmula 75 TNU")
      const titleLabelMatch = normTitle.match(/(sumula|decreto|lei|tema|instrucao|inss|tnu|stj|stf|ec)/gi) || [];
      const numbersInTitle = normTitle.match(/\b\d+\b/g) || [];
      if (numbersInTitle.length > 0) {
        const matchedNumbers = numbersInTitle.filter(num => {
          const looksLikeYear = /^(19|20)\d{2}$/.test(num);
          return (num.length >= 2 || numbersInTitle.length === 1) && !looksLikeYear;
        });
        if (matchedNumbers.length > 0) {
          const allNumbersInQuery = matchedNumbers.every(num => normQuery.includes(num));
          const hasIndicator = titleLabelMatch.length === 0 || titleLabelMatch.some(label => {
            const normLabel = label.toLowerCase();
            if (normLabel === 'instrucao' && (normQuery.includes('in') || normQuery.includes('instrucao'))) return true;
            return normQuery.includes(normLabel);
          });
          if (allNumbersInQuery && hasIndicator) {
            return true;
          }
         }
       }

       // 4. Correspondência por palavras-chave principais do título (ex: "Transportes", "Consumidor")
       const keywords = normTitle.split(/[^a-z0-9]/).filter(w => w.length >= 5);
       for (const kw of keywords) {
         if (normQuery.includes(kw)) {
           return true;
         }
       }

       return false;
    });

    // Combinar ambas as estratégias sem duplicatas
    const finalTitles = new Set<string>([...matchedByConcept, ...matchedByGeneral]);
    return [...finalTitles];
  },

  // Supabase Storage
  async uploadFile(bucket: string, path: string, file: File | Blob | string): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    // Se for base64 (Data URL), converte para Blob de forma robusta
    let fileBody: File | Blob | string = file;
    let contentType: string | undefined = undefined;

    if (typeof file === 'string' && file.startsWith('data:')) {
      try {
        const parts = file.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1];
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        fileBody = new Blob([u8arr], { type: mime });
        contentType = mime;
      } catch (e) {
        console.error('Erro ao converter base64 para Blob, tentando fetch...', e);
        const response = await fetch(file);
        fileBody = await response.blob();
        contentType = fileBody.type;
      }
    } else if (file instanceof File || file instanceof Blob) {
      contentType = file.type;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBody, {
        upsert: true,
        contentType: contentType
      });

    if (error) {
      // Se o erro for que o bucket não existe, tenta criar (pode falhar se não for admin)
      if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
        console.log(`Bucket ${bucket} não encontrado, tentando criar...`);
        try {
          const { error: createError } = await supabase.storage.createBucket(bucket, { public: true });
          if (createError) {
            console.error('Erro ao criar bucket:', createError);
            throw new Error(`O bucket "${bucket}" não existe e não pôde ser criado automaticamente. Por favor, crie-o manualmente no console do Supabase.`);
          }
          // Tenta o upload novamente
          return this.uploadFile(bucket, path, file);
        } catch (e: any) {
          throw new Error(`Erro ao acessar o armazenamento: ${e.message}`);
        }
      }
      console.error('Erro ao fazer upload para Storage:', error);
      throw error;
    }

    // Retorna a URL pública
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }
};
