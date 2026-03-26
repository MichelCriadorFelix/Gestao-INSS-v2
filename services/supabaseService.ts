import { initSupabase } from '../supabaseClient';
import LZString from 'lz-string';

const supabase = initSupabase();

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
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .upsert({
        id: session.id,
        lawyer_type: session.ai_name,
        title: session.title,
        date: session.date,
        messages: session.messages
      });
      
    if (error) {
      console.error('Error saving AI conversation to Supabase:', error);
      throw error;
    }
    return data;
  },

  async getAIConversations(aiName: 'michel' | 'luana') {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('lawyer_type', aiName)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching AI conversations from Supabase:', error);
      return [];
    }
    return data || [];
  },

  async deleteAIConversation(id: string) {
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

  // Social Security Calculations
  async saveCalculation(calc: SavedCalculation) {
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
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('social_security_calculations')
      .select('*')
      .order('date', { ascending: false });
      
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
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('labor_calculations')
      .select('*')
      .order('date', { ascending: false });
      
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
    if (!supabase) return null;
    
    const compressedData = LZString.compressToUTF16(JSON.stringify(client));
    
    const { data, error } = await supabase
      .from('clients')
      .upsert({
        id: client.id,
        data: compressedData
      });
      
    if (error) {
      console.error('Error saving client to Supabase:', error);
      throw error;
    }
    return data;
  },

  async deleteClient(id: string) {
    if (!supabase) return null;
    
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting client from Supabase:', error);
      throw error;
    }
  },

  async getPdfCache(fileHash: string) {
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
  }
};
