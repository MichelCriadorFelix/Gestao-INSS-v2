import { initSupabase } from '../supabaseClient';
import LZString from 'lz-string';

const getSupabase = () => initSupabase();

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
  ai_name: 'michel' | 'luana';
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
      console.error('Error saving AI conversation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getAIConversations(aiName: 'michel' | 'luana') {
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
  async saveMarketingPost(post: any) {
    const supabase = getSupabase();
    if (!supabase) return null;

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
    return data;
  },

  async getMarketingPosts() {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lawyer_type', 'marketing')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching marketing posts from Supabase:', error);
      return [];
    }
    
    return (data || []).map(row => {
      try {
        if (row.messages && row.messages.length > 0) {
          return JSON.parse(row.messages[0].content);
        }
      } catch (e) {
        console.error('Error parsing marketing post:', e);
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
  async saveThemeImage(topic: string, imageUrl: string) {
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
          timestamp: new Date().toISOString()
        }]
      });

    if (error) {
      console.error('Error saving theme image:', error);
      throw error;
    }
    return data;
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
      return data.messages[0].content;
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
    const record = {
      id: clientId,
      name: client.name || 'Sem Nome', // Evita 'EMPTY'
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
      legal_representative: client.legalRepresentative,
      legal_representative_cpf: client.legalRepresentativeCpf,
      legal_representative_marital_status: client.legalRepresentativeMaritalStatus,
      legal_representative_profession: client.legalRepresentativeProfession,
      legal_representative_address: client.legalRepresentativeAddress,
      is_daily_attention: !!client.isDailyAttention,
      is_urgent_attention: !!client.isUrgentAttention,
      is_archived: !!client.isArchived,
      is_referral: !!client.isReferral,
      referrer_name: client.referrerName,
      referrer_percentage: client.referrerPercentage || 0,
      total_fee: client.totalFee || 0,
      documents: client.documents || [],
      petitions: client.petitions || []
    };

    console.log('Salvando cliente no Supabase:', record);

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
      .select('id, name, cpf, password, nationality, marital_status, profession, type, der, med_expertise_date, social_expertise_date, extension_date, dcb_date, ninety_days_date, security_mandate_date, address, legal_representative, legal_representative_cpf, legal_representative_marital_status, legal_representative_profession, legal_representative_address, is_daily_attention, is_urgent_attention, is_archived, is_referral, referrer_name, referrer_percentage, total_fee, documents');
      
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
      legalRepresentative: c.legal_representative,
      legalRepresentativeCpf: c.legal_representative_cpf,
      legalRepresentativeMaritalStatus: c.legal_representative_marital_status,
      legalRepresentativeProfession: c.legal_representative_profession,
      legalRepresentativeAddress: c.legal_representative_address,
      isDailyAttention: c.is_daily_attention,
      isUrgentAttention: c.is_urgent_attention,
      isArchived: c.is_archived,
      isReferral: c.is_referral,
      referrerName: c.referrer_name,
      referrerPercentage: c.referrer_percentage,
      totalFee: c.total_fee,
      documents: c.documents || [],
      documentCount: (c.documents || []).length,
      petitions: []  // Keep petitions empty for summary
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
      legalRepresentative: data.legal_representative,
      legalRepresentativeCpf: data.legal_representative_cpf,
      legalRepresentativeMaritalStatus: data.legal_representative_marital_status,
      legalRepresentativeProfession: data.legal_representative_profession,
      legalRepresentativeAddress: data.legal_representative_address,
      isDailyAttention: data.is_daily_attention,
      isUrgentAttention: data.is_urgent_attention,
      isArchived: data.is_archived,
      isReferral: data.is_referral,
      referrerName: data.referrer_name,
      referrerPercentage: data.referrer_percentage,
      totalFee: data.total_fee,
      documents: data.documents || [],
      petitions: data.petitions || []
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
      created_at: contract.createdAt || new Date().toISOString()
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
      createdAt: c.created_at
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

  async searchLegalDocuments(embedding: number[], matchThreshold = 0.7, matchCount = 5) {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .rpc('match_legal_documents', {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      });
      
    if (error) {
      console.error('Error searching legal documents in Supabase:', error);
      return [];
    }
    return data || [];
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
    
    // Select unique titles from metadata
    // We fetch more rows to ensure we get all unique titles even if there are many chunks
    const { data, error } = await supabase
      .from('legal_documents')
      .select('metadata')
      .limit(10000);
      
    if (error) {
      console.error('Error fetching legal document titles from Supabase:', error);
      return [];
    }
    
    // Filter unique titles manually
    const titles = (data || []).map(item => {
      const metadata = item.metadata as any;
      return metadata?.title ? String(metadata.title) : null;
    }).filter(Boolean) as string[];
    
    return [...new Set(titles)].sort();
  },

  // Supabase Storage
  async uploadFile(bucket: string, path: string, file: File | Blob | string): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    // Se for base64 (Data URL), converte para Blob
    let fileBody: File | Blob | string = file;
    if (typeof file === 'string' && file.startsWith('data:')) {
      const response = await fetch(file);
      fileBody = await response.blob();
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBody, {
        upsert: true,
        contentType: typeof file === 'string' && file.startsWith('data:') ? file.split(';')[0].split(':')[1] : undefined
      });

    if (error) {
      // Se o erro for que o bucket não existe, tenta criar (pode falhar se não for admin)
      if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
        console.log(`Bucket ${bucket} não encontrado, tentando criar...`);
        await supabase.storage.createBucket(bucket, { public: true });
        // Tenta o upload novamente
        return this.uploadFile(bucket, path, file);
      }
      console.error('Erro ao fazer upload para Storage:', error);
      throw error;
    }

    // Retorna a URL pública
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }
};
