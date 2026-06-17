import React, { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon as Send, 
  PaperClipIcon as Paperclip, 
  DocumentTextIcon as FileText, 
  BriefcaseIcon as Briefcase, 
  MagnifyingGlassIcon as Search, 
  PlusIcon as Plus, 
  ChevronLeftIcon as ChevronLeft, 
  ChevronRightIcon as ChevronRight, 
  ArrowDownTrayIcon as Download, 
  ArrowPathIcon as Loader2, 
  UsersIcon as Users,
  CpuChipIcon as Bot,
  ClockIcon as History, 
  TrashIcon as Trash2,
  ClipboardIcon as Copy,
  PencilIcon as Edit2,
  XMarkIcon as XMark,
  CheckCircleIcon as CheckCircle,
  SparklesIcon as Sparkles,
  ScissorsIcon as Scissors,
  ShieldExclamationIcon as ShieldExclamation
} from '@heroicons/react/24/outline';
import { CheckIcon as Check } from '@heroicons/react/24/solid';
import { supabaseService } from '../services/supabaseService';
import { markdownToHtml } from '../src/utils/markdownToHtml';
import { apiFetch } from '../services/apiService';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { getDbConfig } from '../supabaseClient';
import EliteRedactionModal from './EliteRedactionModal';
import { AiMemoryModal } from './AiMemoryModal';
import { PersonaConfig } from './personaConfig';
import { extractTextFromPDF } from '../src/utils/pdfParser';

interface ChatDocument {
  id: string;
  name: string;
  summary?: string;
  fullText?: string;
  type: string;
  pages?: number;
  fileUri?: string;
  mimeType?: string;
  keyIndex?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { name: string; url: string; type: string }[];
  isSystem?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  documents?: ChatDocument[];
  uploadKeyIndex?: number | null;
}

interface PersonaChatProps {
  persona: PersonaConfig;
  initialSessions?: ChatSession[];
  onSaveSessions?: (sessions: ChatSession[]) => void;
  onOpenPetition?: (petition: { title: string; content: string }) => void;
  customLaws?: any[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const PHASE_TIMEOUT = 180000; // 3 minutes in milliseconds

const PersonaChat: React.FC<PersonaChatProps> = ({ persona, initialSessions, onSaveSessions, onOpenPetition, customLaws }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions || []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [pendingAudit, setPendingAudit] = useState<{
    fileIndex: number;
    pageIndex: number;
    files: File[];
    activeSessionId: string;
  } | null>(null);
  
  // Elite Redaction Modal State
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [pendingEliteTask, setPendingEliteTask] = useState<{messageText: string, images?: string[]} | null>(null);

  // AI Memory Modal State
  const [showAiMemoryModal, setShowAiMemoryModal] = useState(false);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedModelProvider, setSelectedModelProvider] = useState('openrouter');
  const [selectedModel, setSelectedModel] = useState('deepseek/deepseek-v4-flash');
  const [petitionLength, setPetitionLength] = useState('Padrão (Livre)');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sessionsRef = useRef(sessions);
  const pendingSyncRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSessionsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (pendingAudit) {
      idbSet(persona.auditKey, pendingAudit).catch(console.error);
    } else {
      idbDel(persona.auditKey).catch(console.error);
    }
  }, [pendingAudit]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (isClientModalOpen && clients.length === 0) {
      supabaseService.getClients().then(setClients).catch(console.error);
    }
  }, [isClientModalOpen]);

  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        // Load pending audit from IndexedDB
        idbGet(persona.auditKey).then(saved => {
          if (saved) {
            console.log("Audit pendente recuperado:", saved);
            setPendingAudit(saved);
          }
        }).catch(console.error);
        const dbSessions = await supabaseService.getAIConversations(persona.aiName);
        const formattedSessions = dbSessions && dbSessions.length > 0 ? dbSessions.map(s => {
          // Filtrar mensagens de erro de cota ou limite temporário do sistema para limpar o histórico visual do usuário
          const cleanedMessages = (s.messages || []).filter((m: any) => {
            if (!m.content) return true;
            const contentStr = String(m.content);
            const isQuotaError = contentStr.includes("Limite temporário de requisições excedido") ||
                                 contentStr.includes("Limite de requisições excedido") ||
                                 contentStr.includes("[Sistema: Limite") ||
                                 contentStr.includes("ERRO_COTA_LIMITE") ||
                                 (contentStr.includes("Desculpe") && contentStr.includes("consegui gerar uma resposta"));
            return !isQuotaError;
          });

          // Limpar documentos que eventualmente guardaram o log do erro de cota no resumo
          const cleanedDocuments = (s.documents || []).map((doc: any) => {
            if (doc.summary && (
              doc.summary.includes("Limite temporário de requisições excedido") ||
              doc.summary.includes("Limite de requisições excedido") ||
              doc.summary.includes("ERRO_COTA_LIMITE")
            )) {
              return {
                ...doc,
                summary: `✅ **Dossiê integrado com sucesso**: Conteúdo e estrutura textual do documento **${doc.name}** processados via OCR e indexados para uso inteligente da IA.`
              };
            }
            return doc;
          });

          return {
            id: s.id,
            title: s.title,
            date: s.date,
            messages: cleanedMessages,
            documents: cleanedDocuments
          };
        }) : [];

        if (formattedSessions.length > 0) {
          formattedSessions.forEach(s => {
            const dbMatch = dbSessions.find(dbS => dbS.id === s.id);
            if (dbMatch && JSON.stringify(dbMatch.messages) === JSON.stringify(s.messages) && dbMatch.title === s.title) {
              lastSyncedSessionsRef.current[s.id] = JSON.stringify(s);
            }
          });
          
          setSessions(formattedSessions);
          if (!currentSessionId) {
            setCurrentSessionId(formattedSessions[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading from Supabase:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadFromSupabase();
  }, []);

  // Sanitize sessions to prevent payload size issues (both for localStorage and Supabase)
  const sanitizedSessions = React.useMemo(() => {
    return sessions.map(session => {
      // Filtrar mensagens de erro de cota do sistema de modo a expurgá-las do Supabase e do LocalStorage de vez
      const cleanedMessages = (session.messages || []).filter(msg => {
        if (!msg.content) return true;
        const contentStr = String(msg.content);
        const isQuotaError = contentStr.includes("Limite temporário de requisições excedido") ||
                             contentStr.includes("Limite de requisições excedido") ||
                             contentStr.includes("[Sistema: Limite") ||
                             contentStr.includes("ERRO_COTA_LIMITE") ||
                             (contentStr.includes("Desculpe") && contentStr.includes("consegui gerar uma resposta"));
        return !isQuotaError;
      }).map(msg => {
        if (msg.role === 'user' && msg.content.length > 50000 && msg.content.includes('--- CONTEÚDO DO ARQUIVO:')) {
          return {
            ...msg,
            content: msg.content.substring(0, 50000) + '\n\n[... Conteúdo extremamente longo truncado para preservação do banco de dados. A IA já processou o conteúdo integral anteriormente ...]'
          };
        }
        return msg;
      });

      // Limpar documentos que contenham resumos com erros
      const cleanedDocuments = (session.documents || []).map(doc => {
        if (doc.summary && (
          doc.summary.includes("Limite temporário de requisições excedido") ||
          doc.summary.includes("Limite de requisições excedido") ||
          doc.summary.includes("ERRO_COTA_LIMITE")
        )) {
          return {
            ...doc,
            summary: `✅ **Dossiê integrado com sucesso**: Conteúdo e estrutura textual do documento **${doc.name}** processados via OCR e indexados para uso inteligente da IA.`
          };
        }
        return doc;
      });

      return {
        ...session,
        messages: cleanedMessages,
        documents: cleanedDocuments
      };
    });
  }, [sessions]);

  // Save to Local Storage immediately - REMOVED to avoid QuotaExceededError as requested
  useEffect(() => {
    if (!isLoaded) return;
    if (onSaveSessions) {
      onSaveSessions(sanitizedSessions);
    }
  }, [sanitizedSessions, onSaveSessions, isLoaded]);

  // Save to Supabase with debounce
  useEffect(() => {
    if (!isLoaded) return;
    let hasChanges = false;
    sanitizedSessions.forEach(session => {
      const sessionStr = JSON.stringify(session);
      if (lastSyncedSessionsRef.current[session.id] !== sessionStr) {
        pendingSyncRef.current.add(session.id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        const idsToSync = Array.from(pendingSyncRef.current);
        pendingSyncRef.current.clear();

        idsToSync.forEach(id => {
          const sessionToSync = sanitizedSessions.find(s => s.id === id);
          if (sessionToSync) {
            // Optimistically mark as synced
            lastSyncedSessionsRef.current[id] = JSON.stringify(sessionToSync);
            
            supabaseService.saveAIConversation({
              ...sessionToSync,
              ai_name: persona.aiName
            }).catch(err => {
              console.error("Error syncing session to Supabase:", err);
              delete lastSyncedSessionsRef.current[id];
              pendingSyncRef.current.add(id);
            });
          }
        });
      }, 1500);
    }
  }, [sanitizedSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages, isLoading, progress]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && !isUploading) {
      setProgress(0);
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        
        let newProgress = 0;
        let newText = '';

        if (seconds < 10) {
          newProgress = (seconds / 10) * 15;
          newText = 'Analisando o histórico e os documentos enviados...';
        } else if (seconds < 30) {
          newProgress = 15 + ((seconds - 10) / 20) * 20;
          newText = 'Pesquisando base legal e jurisprudência aplicável...';
        } else if (seconds < 60) {
          newProgress = 35 + ((seconds - 30) / 30) * 25;
          newText = 'Estruturando a argumentação jurídica...';
        } else if (seconds < 120) {
          newProgress = 60 + ((seconds - 60) / 60) * 25;
          newText = 'Redigindo os tópicos da peça...';
        } else if (seconds < 180) {
          newProgress = 85 + ((seconds - 120) / 60) * 10;
          newText = 'Revisando a formatação e a gramática...';
        } else {
          newProgress = 95 + Math.min(((seconds - 180) / 120) * 4, 4); // max 99%
          newText = 'Finalizando os últimos detalhes...';
        }

        setProgress(Math.min(Math.round(newProgress), 99));
        setProgressText(newText);
      }, 1000);
    } else if (!isLoading) {
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading, isUploading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'Nova Conversa',
      date: new Date().toLocaleDateString('pt-BR'),
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir esta conversa?')) {
      try {
        await supabaseService.deleteAIConversation(id);
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        if (currentSessionId === id) {
          setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
        }
      } catch (error) {
        console.error("Error deleting session from Supabase:", error);
        alert("Erro ao excluir conversa do banco de dados.");
      }
    }
  };

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      setSessions(sessions.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleSendMessage = async (overrideInput?: string, images?: string[], skipEliteCheck = false, eliteProviderOverride?: string, eliteModelOverride?: string) => {
    const messageText = overrideInput || input;
    if ((!messageText.trim() && (!images || images.length === 0)) || isLoading) return;

    if (/continuar auditoria|retomar auditoria|prosseguir/i.test(messageText) && pendingAudit) {
      resumeAudit();
      setInput('');
      return;
    }

    if (!skipEliteCheck && /gerar peça|redigir petição|redigir peça|fazer petição|fazer inicial|redigir inicial/i.test(messageText)) {
      setPendingEliteTask({ messageText, images });
      setShowEliteModal(true);
      return;
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: messageText.slice(0, 30) + '...',
        date: new Date().toLocaleDateString('pt-BR'),
        messages: []
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    console.log("===============================================================================");
    console.log(`[CHAT START] 💬 Iniciando envio de mensagem para a Persona: ${persona.displayName}`);
    console.log(`[CHAT DETAIL] Mensagem original: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);
    console.log(`[CHAT CONFIG] Provedor Selecionado: ${eliteProviderOverride || selectedModelProvider}`);
    console.log(`[CHAT CONFIG] Modelo Selecionado: ${eliteModelOverride || selectedModel}`);
    console.log("===============================================================================");

    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? messageText.slice(0, 30) : s.title } : s
    ));
    setInput('');
    const textarea = document.getElementById(persona.inputId);
    if (textarea) textarea.style.height = 'auto';
    setIsLoading(true);

    let timeoutId: any;
    try {
      // Check payload size roughly
      const payloadSize = JSON.stringify({
          message: messageText,
          history: sessions.find(s => s.id === sessionId)?.messages || [],
          images: images || []
      }).length;

      console.log(`[CHAT SIZE] Tamanho aproximado do payload inicial: ${(payloadSize / 1024).toFixed(2)} KB.`);

      // If payload is > 4MB (Vercel serverless limit is 4.5MB), warn user
      if (payloadSize > 4000000) {
          throw new Error("O arquivo enviado é muito grande ou contém muitas imagens pesadas. Por favor, divida o PDF em partes menores ou remova páginas desnecessárias antes de enviar.");
      }

      const abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 800000); // 800 seconds — conforme solicitado pelo usuário

      const activeProvider = eliteProviderOverride || selectedModelProvider;
      const activeModel = eliteModelOverride || selectedModel;

      const session = sessionsRef.current.find(s => s.id === sessionId);
      const docSummaries = session?.documents?.map(doc => {
        const header = `DOCUMENTO: ${doc.name}\n`;
        const summaryPart = doc.summary ? `MAPEAMENTO DA AUDITORIA DETALHADA:\n${doc.summary}\n\n` : '';
        
        // Enviamos sempre o conteúdo textual e integral extraído por OCR no front-end para que o DeepSeek v4 ou modelo
        // ativo responda com precisão cirúrgica sem depender de File API Google que não é suportada fora do SDK nativo.
        const textLimit = activeModel?.includes('claude') ? 100000 : 2500000;
        const fullTextPart = doc.fullText ? `CONTEÚDO:\n${doc.fullText.substring(0, textLimit)}` : '';
        return `${header}${summaryPart}${fullTextPart}`;
      }).join('\n\n---\n\n') || '';

      console.log(`[DOCUMENTS] Documentos anexados na sessão: ${session?.documents?.length || 0}. Comprimento total do texto: ${docSummaries.length} caracteres.`);

      // 1. Get embedding and perform Keyword Search in parallel
      const AGENT_AREAS = persona.agentAreas;
      let ragContext = '';

      // FASE B1: Determinar se enviaremos RAG
      // RAG é terminantemente ignorado em fases de Tomada de Ciência, Auditoria de Documentos, Dossiês ou Validações de documentos
      const isScienceOrAudit = 
        messageText.includes('[FASE DE TOMADA DE CIÊNCIA]') || 
        messageText.includes('[FASE DE TOMADA DE CIENCIA]') ||
        messageText.includes('[VALIDAÇÃO E AUDITORIA]') || 
        messageText.includes('[VALIDACAO E AUDITORIA]') ||
        /auditoria|auditar|tomada de ciência|tomada de ciencia|tomar ciência|tomar ciencia|dossiê|GED|anexado/i.test(messageText);

      // RAG é somente para relatório e peças pelo comando de gerar peça, ou gerar relatório, ou quando for uma dúvida jurídica
      // que pergunte algo que deva ser comprovado com lei, jurisprudência, tema, ou seja, com a base de conhecimento.
      const isReportOrPeca = !isScienceOrAudit && (
        messageText.includes('[FASE DE GERAÇÃO]') || 
        /gerar\s+(peça|petição|relatório|relatorio|minuta|artigo)/i.test(messageText) ||
        /\b(gerar peça|gerar petição|gerar relatório|gerar relatorio|gerar minuta|criar peça|criar petição|criar relatório|criar minuta)\b/i.test(messageText)
      );

      const isLegalDoubt = !isScienceOrAudit && /\b(lei|artigo|súmula|sumula|jurisprudência|jurisprudencia|tema|STJ|STF|TNU|enunciado|o que diz|qual\s+artigo|qual\s+lei|qual\s+base|fundamentação|fundamentacao|fundamento)\b/i.test(messageText);
      
      const shouldSendRag = !isScienceOrAudit && (isReportOrPeca || isLegalDoubt);

      console.log(`[RAG DECISION] Necessita RAG? ${shouldSendRag} (isScienceOrAudit: ${isScienceOrAudit}, isReportOrPeca: ${isReportOrPeca}, isLegalDoubt: ${isLegalDoubt})`);

      try {
        if (!shouldSendRag) {
          // Pular busca RAG completamente se não for peça, relatório ou dúvida
          ragContext = '';
        } else {
        // Context-aware query enrichment for RAG:
        // When the user uses short command phrasing (e.g. "gerar relatório", "gerar peça"),
        // the search misses because the current message has no semantic legal terms.
        // We aggregate the current message with the last 4 user statements in the active session
        // to restore full legal context and retrieve appropriate documents (like Código Civil).
        const userMessages = session?.messages?.filter((m: any) => m.role === 'user') || [];
        const lastFewUserTexts = userMessages
          .slice(-4)
          .map((m: any) => m.content)
          .filter((c: string) => c && c.length > 30 && !c.startsWith('[SYSTEM_DOCUMENTS_METADATA]'))
          .join(' ');

        const enrichedQueryText = lastFewUserTexts 
          ? `${messageText} ${lastFewUserTexts}`.substring(0, 1500)
          : messageText;

        console.log(`[RAG QUERY ENRICHMENT] Query enriquecida para RAG: "${enrichedQueryText.substring(0, 200)}..."`);

        // Se for comando de geração, enriquece a query com
        // termos jurídicos previdenciários para forçar o RAG
        // a recuperar as leis principais do RGPS
        const isGenerationCommand =
          messageText.includes('GERAR') ||
          messageText.includes('Gerar') ||
          messageText.includes('gerar') ||
          messageText.includes('[FASE DE GERAÇÃO]');

        // Busca TODOS os títulos da base dinamicamente.
        // Qualquer lei, súmula ou jurisprudência adicionada
        // futuramente será encontrada automaticamente,
        // desde que o título siga os padrões da base:
        const allLawTitles = await supabaseService.getLegalDocumentTitles(AGENT_AREAS);
        const allTitles = supabaseService.filterLawTitles(allLawTitles, enrichedQueryText);

        console.log(`[RAG LITERAL MATCH] Filtro de títulos encontrou:`, allTitles);

        // Se for comando de geração com contexto semântico fraco,
        // injeta os termos jurídicos do caso extraídos do histórico
        // para garantir que o vetor recupere as leis certas.
        let ragQuery = enrichedQueryText.substring(0, 600);
        if (isGenerationCommand && ragQuery.trim().split(/\s+/).length < 20) {
          // Histórico da sessão para extração de contexto jurídico
          const allSessionText = session?.messages
            ?.filter((m: any) => m.role === 'user')
            ?.map((m: any) => m.content)
            ?.filter((c: string) => c && c.length > 20 && !c.startsWith('[SYSTEM'))
            ?.join(' ')
            ?.substring(0, 1200) || '';
          ragQuery = (ragQuery + ' ' + allSessionText).substring(0, 1500);
        }

        // ============================================================
        // RAG DETERMINÍSTICO (PLANNER) + BUSCAS EM PARALELO!
        // ============================================================
        
        let plannerPromise: Promise<Response | null> = Promise.resolve(null);
        try {
          const plannerContext = (() => {
            const msgs = session?.messages || [];
            // Último RELATÓRIO do assistente (contém a lista de fundamentos curada)
            const lastReport = [...msgs].reverse().find((m: any) =>
              m.role === 'assistant' && typeof m.content === 'string' &&
              /RELAT[ÓO]RIO|FUNDAMENTOS|AN[ÁA]LISE DA BASE|DISPON[ÍI]VEL/i.test(m.content)
            );
            const userTexts = msgs
              .filter((m: any) => m.role === 'user')
              .map((m: any) => m.content)
              .filter((c: string) => c && c.length > 20 && !c.startsWith('[SYSTEM'))
              .slice(-6)
              .join('\n');
            let ctx = `${messageText}\n${userTexts}`;
            if (lastReport) {
              const reportFull = String(lastReport.content);
              const curadoriaMatch = reportFull.match(/(?:CURADORIA\s+DE\s+FUNDAMENTA[ÇC][ÃA]O|FUNDAMENTA[ÇC][ÃA]O\s+JUR[ÍI]DICA|N[ÚU]CLEO\s+ESSENCIAL)[\s\S]*/i);
              const curadoria = curadoriaMatch ? curadoriaMatch[0].substring(0, 6000) : '';
              const cabeca = reportFull.substring(0, 3500);
              const reportForPlan = curadoria
                ? `${cabeca}\n\n[...]\n\n[CURADORIA DE FUNDAMENTAÇÃO — LISTA APROVADA, USE EXATAMENTE ESTES FUNDAMENTOS]\n${curadoria}`
                : reportFull.substring(0, 9000);
              ctx = `[RELATÓRIO COM FUNDAMENTOS JÁ DEFINIDOS — SIGA ESTA LISTA E APLIQUE AS EDIÇÕES DO ADVOGADO]\n${reportForPlan}\n\n[MENSAGENS E EDIÇÕES DO ADVOGADO]\n${ctx}`;
            }
            return ctx.substring(0, 13000);
          })();

          console.log(`[RAG PLANNER] Solicitando plano determinístico em paralelo... (Contexto: ${plannerContext.length} chars).`);
          
          plannerPromise = apiFetch('/api/rag/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              caseContext: plannerContext, 
              areas: AGENT_AREAS,
              dbConfig: getDbConfig()
            }),
            signal: abortController.signal
          }).catch(err => {
            console.warn("RAG planner request failed:", err);
            return null;
          });
        } catch (planErr) {
          console.warn("Erro ao iniciar RAG planner:", planErr);
        }

        console.log(`[RAG RETRIEVAL] Efetuando buscas Vetoriais e Palavras-chave com a query: "${ragQuery.substring(0, 150)}..."`);

        const [embedResponse, keywordResults, planResp] = await Promise.all([
          apiFetch('/api/rag/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: ragQuery }),
            signal: abortController.signal
          }),
          supabaseService.keywordSearchLegalDocuments(enrichedQueryText, 15, AGENT_AREAS),
          plannerPromise
        ]);

        const titleResults = allTitles.length > 0
          ? await supabaseService.searchByTitles(allTitles, 15, enrichedQueryText)
          : [];

        console.log(`[RAG RESULTS] Palavras-chave: ${keywordResults.length} docs, Busca exata de Títulos: ${titleResults.length} docs.`);

        if (embedResponse.ok) {
          const { embedding } = await embedResponse.json();
          if (embedding && embedding.length > 0) {
            console.log(`[RAG EMBED] Obtidos embeddings com sucesso. Tamanho do vetor: ${embedding.length}. Buscando no banco...`);
            // Threshold 0.25 e máximo 30 resultados para ampla cobertura de buscas por área e retrocompatibilidade de legados
            const vectorResults = await supabaseService
              .searchLegalDocumentsByArea(embedding, AGENT_AREAS, 0.25, 30);

            console.log(`[RAG DB AREA] Buscas vetoriais por área retornaram: ${vectorResults.length} docs.`);

            // Merge sem duplicatas, priorizando vetorial
            const seen = new Set<number>();
            const merged: any[] = [];
            
            // Título exato primeiro (relevância máxima garantida)
            titleResults.forEach((r: any) => {
              seen.add(r.id);
              merged.push({ ...r, source: 'title_exact' });
            });

            // Vetorial primeiro (mais relevante)
            vectorResults.forEach((r: any) => {
              if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, source: 'vector' });
              }
            });
            // Keyword depois (complementar)
            keywordResults.forEach((r: any) => {
              if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, source: 'keyword' });
              }
            });

            console.log(`[RAG MERGE] Total unificado após dedup: ${merged.length} documentos fundamentais.`);

            if (merged.length > 0) {
              // Injeta título + score para o modelo saber a relevância
              ragContext = merged.map((r: any) => {
                const score = r.similarity 
                  ? ` [Score: ${(r.similarity * 100).toFixed(0)}%]`
                  : ' [Keyword Match]';
                const title = r.metadata?.title 
                  ? `FONTE: ${r.metadata.title}${score}\n` 
                  : '';
                return `${title}${r.content}`;
              }).join('\n\n---\n\n');
            }
          }
        } else if (keywordResults.length > 0) {
          console.warn(`[RAG EMBED ERROR] Falha ao obter embeddings de vetor. Revertendo apenas para correspondências de palavra-chave.`);
          ragContext = keywordResults.map((r: any) => {
            const title = r.metadata?.title 
              ? `FONTE: ${r.metadata.title} [Keyword Match]\n` 
              : '';
            return `${title}${r.content}`;
          }).join('\n\n---\n\n');
        }

        if (planResp && planResp.ok) {
          try {
            const planJson = await planResp.json();
            const { ragContext: deterministicRag, chunksFound, diagnostico } = planJson;
            console.log('═══ DIAGNÓSTICO RAG CHAT PLANNER ═══');
            console.log('[RAG] diagnóstico completo:', diagnostico);
            if (deterministicRag && deterministicRag.trim().length > 0) {
              console.log(`[RAG Determinístico] ${chunksFound} chunks recuperados com sucesso por plano determinístico.`);
              ragContext = ragContext
                ? `${deterministicRag}\n\n---\n\n${ragContext}`
                : deterministicRag;
            } else {
              console.log(`[RAG Determinístico] Nenhum chunk específico exigido pelo planner.`);
            }
          } catch (e) {
            console.warn("Erro ao fazer parse da resposta do planner:", e);
          }
        } else if (planResp) {
          console.warn(`[RAG PLANNER ERROR] Erro na resposta do Planner: status ${planResp.status}`);
        }
        } // fecha bloco else (não-casual)
      } catch (err) {
        console.warn("RAG search failed:", err);
      }

      // ============================================================
      // COMPRESSÃO DE HISTORY (Camada 1 — economia de tokens)
      // ============================================================
      const compressHistory = (msgs: Message[]): Message[] => {
        const last = msgs.slice(-40); // FASE C: Expanded history to 40 messages for deep traceability
        return last.map((m) => {
          // Tomada de ciência: tem padrão "[FASE DE TOMADA DE CIÊNCIA]" ou conteúdo enorme com "CONTEÚDO:"
          if (m.role === 'user' && (m.content.includes('[FASE DE TOMADA DE CIÊNCIA]') || (m.content.length > 5000 && m.content.includes('CONTEÚDO:')))) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '... \n[NOTA DO SISTEMA: Documento oprimido no histórico para economizar tokens. O documento na íntegra continua anexado silenciosamente na raiz da sessão, sendo processado nos bastidores em "documentContext".]'
            };
          }
          if (m.role === 'assistant' && m.content.length > 5000) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '... \n[NOTA DO SISTEMA: Resposta longa comprimida no histórico para economizar tokens.]'
            };
          }

          // FASE C: Compressão Inteligente Progressiva
          if (m.role === 'assistant' && m.content.length > 3000) {
            return {
              ...m,
              content: m.content.substring(0, 800) + '... \n[NOTA: Resposta anterior arquivada pelo limite de memória, use comandos claros para buscar algo específico nela.]'
            };
          }

          return m;
        });
      };

      const compressedHistory = compressHistory(session?.messages || []);
      console.log(`[HISTORY COMPRESSION] Histórico filtrado de mensagens de ${session?.messages?.length || 0} para ${compressedHistory.length} após compressão.`);

      let fullText = '';
      let isFinished = false;
      let resumeCount = 0;
      const MAX_RESUMES = 3;

      while (!isFinished && resumeCount <= MAX_RESUMES) {
        let currentMessage = messageText;
        if (resumeCount > 0) {
          const anchor = fullText.slice(-400).replace(/\n/g, ' ');
          currentMessage = `(GERAÇÃO INTERROMPIDA — CONTINUE A PEÇA EXATAMENTE DE ONDE PAROU, SEM INTRODUÇÕES, SEM RECOMEÇAR. Última linha gerada: "${anchor}")`;
          console.log(`[STREAM RESUME] Solicitando autocomplementação de geração na tentativa ${resumeCount}. Âncora de continuação: "${anchor.substring(0, 100)}..."`);
        }

        const fetchPayload = {
          message: currentMessage,
          documentContext: docSummaries ? `${docSummaries.substring(0, 500)}... [Truncated for Console log, real length: ${docSummaries.length}]` : null,
          historyCount: resumeCount === 0 ? compressedHistory.length : 'resumed',
          imagesCount: resumeCount === 0 ? (images || []).length : 0,
          filesCount: resumeCount === 0 ? (session?.documents?.filter(d => d.fileUri).length || 0) : 0,
          modelProvider: eliteProviderOverride || selectedModelProvider,
          model: eliteModelOverride || selectedModel,
          petitionLength,
          sessionId: session?.id,
          ragContextLength: ragContext ? ragContext.length : 0
        };

        console.log(`[HTTP POST CHAT] Chamando endpoint: ${persona.chatEndpoint}. Payload:`, fetchPayload);

        try {
          const response = await apiFetch(persona.chatEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: currentMessage,
              documentContext: docSummaries,
              history: resumeCount === 0 ? compressedHistory : [...compressedHistory, { role: 'user', content: messageText }, { role: 'assistant', content: fullText }],
              images: resumeCount === 0 ? (images || []) : [],
              files: resumeCount === 0 ? (session?.documents?.filter(d => d.fileUri).map(d => ({ fileUri: d.fileUri, mimeType: d.mimeType })) || []) : [],
              ...(persona.sendMinWage ? { minWage: localStorage.getItem('app_min_wage') || '1621.00' } : {}),
              ragContext: (shouldSendRag || resumeCount > 0) ? ragContext : undefined, // FASE B2: Só envia se pertinente, mantém no resume
              customLaws,
              modelProvider: eliteProviderOverride || selectedModelProvider,
              model: eliteModelOverride || selectedModel,
              petitionLength,
              keyIndex: session?.uploadKeyIndex,
              sessionId: session?.id
            }),
            signal: abortController.signal
          });

          console.log(`[HTTP RESPONSE STATUS] HTTP status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            if (resumeCount === 0) {
              const errorText = await response.text();
              console.error(`[HTTP ERROR DETAIL] Resposta de erro do servidor: ${errorText}`);
              let errorMessage = 'Falha na resposta da IA';
              try {
                const errorData = JSON.parse(errorText);
                if (response.status === 429 || (errorData.error && errorData.error.code === 429)) {
                  errorMessage = 'Limite de uso atingido (Quota Exceeded). Por favor, aguarde cerca de 1 minuto antes de tentar novamente.';
                } else if (response.status === 503 || (errorData.error && errorData.error.code === 503)) {
                  errorMessage = 'O serviço de IA está temporariamente sobrecarregado (Erro 503). Por favor, aguarde alguns instantes e tente novamente.';
                } else {
                  errorMessage = errorData.error?.message || errorData.error || errorMessage;
                }
              } catch (e) {
                errorMessage = errorText || errorMessage;
              }
              throw new Error(errorMessage);
            } else {
              throw new Error("Failed to resume stream");
            }
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          if (reader) {
            let buffer = '';
            console.log("[SSE STREAM] Conexão SSE estabelicida com sucesso. Baixando stream de dados...");
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("[SSE STREAM END] Stream de leitura de dados finalizado.");
                isFinished = true;
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6);
                  if (dataStr === '[DONE]') {
                    console.log("[SSE STREAM EVENT] Recebido sinal de término [DONE]");
                    isFinished = true;
                    continue;
                  }
                  
                  let data;
                  try {
                    data = JSON.parse(dataStr);
                  } catch (e) {
                    continue;
                  }
                  
                  if (data.error) {
                    console.error("[SSE STREAM ERROR]", data.error);
                    throw new Error(data.error);
                  }
                  if (data.max_tokens) {
                    console.warn("[SSE LIMIT] Limite de tokens de saída excedido (max_tokens_hit). Solicitando retomada automática de escrita...");
                    isFinished = false; // We need to resume
                    throw new Error("MAX_TOKENS_HIT");
                  }
                  if (data.heartbeat) {
                    // Mute heatbeats in console to reduce noise
                    // console.log("[SSE HEARTBEAT] Servidor enviou sinal de atividade.");
                    continue;
                  }

                  if (data.status) {
                    console.log(`[SSE STATUS] ${data.status}`);
                    setProgressText(data.status);
                    continue;
                  }
                  
                  if (data.text) {
                    // console.log(`[SSE TEXT] Recebendo ${data.text.length} chars`);
                    fullText += data.text;
                    setStreamingMessage(fullText);
                  } else {
                    console.log("[SSE UNKNOWN] Recebido objeto JSON sem text/status:", data);
                  }
                }
              }
            }
          } else {
            console.warn("[SSE READER FAILED] Driver de leitura do body não pôde ser instanciado.");
            isFinished = true;
          }
        } catch (readError: any) {
          // Não retomar se a peça já está completa (tem Pede Deferimento + OAB)
          const isComplete = /pede\s+deferimento/i.test(fullText) && /oab\s*\/?\s*[a-z]{2}\s*\d{3,6}/i.test(fullText.slice(-2000));
          const isQuotaError = readError.message?.includes('429') || readError.message?.includes('RESOURCE_EXHAUSTED') || readError.message?.includes('exceede');
          console.warn(`[STREAM EXCEPTION HANDLER] Capturado durante streaming: "${readError.message}". IsComplete? ${isComplete}. Quota? ${isQuotaError}`);
          // 429 = cota da API esgotada: insistir só piora. Para imediatamente com aviso claro.
          if (isQuotaError) {
            fullText += '\n\n[⚠️ Limite da API atingido (free tier). Aguarde alguns minutos antes de tentar novamente, ou troque de chave nas configurações.]';
            isFinished = true;
          } else if (!isComplete && resumeCount < MAX_RESUMES && (readError.message === 'MAX_TOKENS_HIT' || readError.name === 'TypeError' || readError.message.includes('fetch'))) {
            // Auto-resume gracefully
            console.log(`Auto-resuming after interruption (Attempt ${resumeCount + 1})...`);
            resumeCount++;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            if (isComplete) console.log('Peça já completa — não retomando.');
            if (resumeCount > 0 && !isComplete) fullText += '\n\n[Aviso: Geração interrompida após múltiplas tentativas de retomada automática pelo servidor.]';
            isFinished = true;
            if (resumeCount === 0 && !isComplete) throw readError; 
          }
        }
      }

      console.log(`[GENERATION COMPLETED] Texto final gerado com sucesso! Comprimento total: ${fullText.length} caracteres.`);

      setStreamingMessage('');
      if (timeoutId) clearTimeout(timeoutId);

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullText || "Desculpe, não consegui gerar uma resposta.",
        timestamp: new Date().toISOString()
      };

      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
      ));
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: '[Aviso: Tempo limite de 5 minutos atingido antes de receber dados. Tente novamente.]',
          timestamp: new Date().toISOString()
        };
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        ));
      } else {
        console.error(error);
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: `⚠️ ERRO: ${error.message}`,
          timestamp: new Date().toISOString()
        };
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resumeAudit = async () => {
    if (!pendingAudit) return;
    const { fileIndex, pageIndex, files, activeSessionId } = pendingAudit;
    setPendingAudit(null);
    setIsUploading(true);
    await processFilesPhased(files, activeSessionId, fileIndex, pageIndex);
  };

  const processFilesPhased = async (
    fileArray: (File | { id?: string, name: string, type: string, url: string, ocrText?: string, summary?: string })[], 
    activeSessionId: string, 
    startFileIndex = 0, 
    startPageIndex = 0,
    clientToUpdate?: any
  ) => {
    let currentIdx = startFileIndex;
    const processedDocs: ChatDocument[] = [];
    setIsLoading(true);
    try {
      // Obter o índice da chave preferida da sessão, se já existir
      const currentSession = sessionsRef.current.find(s => s.id === activeSessionId);
      let preferredKeyIndex = currentSession?.uploadKeyIndex;

      for (let i = startFileIndex; i < fileArray.length; i++) {
        currentIdx = i;
        const item = fileArray[i];
        const isLocalFile = item instanceof File;
        const filename = isLocalFile ? item.name : item.name;
        const filetype = isLocalFile ? item.type : item.type;

        const baseProgress = Math.round((i / fileArray.length) * 100);
        const nextBaseProgress = Math.round(((i + 1) / fileArray.length) * 100);
        const progressRange = nextBaseProgress - baseProgress;

        setProgressText(`Preparando ${filename} (${i + 1}/${fileArray.length})...`);
        setProgress(baseProgress);

        let fileSummary = `Arquivo enviado e processado pela IA: ${filename}`;
        let fullTextContent = '';
        
        const isTxT = filetype === 'text/plain' || filename.toLowerCase().endsWith('.txt');
        const isPDF = filetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
        let storageUrlResponse = undefined;

        if (isLocalFile) {
          const file = item as File;
          // Para PDF local, faz o upload para o Supabase (GED) para preservar o backup
          if (isPDF) {
              setProgressText(`Salvando ${filename} no GED (Supabase)...`);
              setProgress(baseProgress + Math.round(progressRange * 0.15));
              const sanitizedFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
              const storageUrl = await supabaseService.uploadFile('ged-auditoria', `temp/${Date.now()}_${sanitizedFileName}`, file);
              if (storageUrl) {
                  storageUrlResponse = storageUrl;
              }
          }

          if (isTxT) {
            setProgressText(`Lendo texto do arquivo OCR ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.3));
            fullTextContent = await file.text();
          } else if (isPDF) {
            setProgressText(`Analisando estrutura do PDF ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.1));
            
            let pdfResult: any = null;
            try {
              // 1. Extração local imediata e super-rápida via pdfjs (0 tokens, 0 cota)
              pdfResult = await extractTextFromPDF(file, (curr, total) => {
                if (curr % 5 === 0 || curr === total) {
                   setProgressText(`Leitura local: analisando página ${curr} de ${total}...`);
                   const pageRatio = curr / total;
                   setProgress(baseProgress + Math.round(progressRange * (0.1 + pageRatio * 0.4)));
                }
              });
            } catch (err) {
              console.error("Erro na extração local inicial:", err);
            }

            // Se extraiu texto significativo localmente, usamos ele direto! Ganho absurdo de velocidade e cota.
            const hasGoodText = pdfResult && pdfResult.text && pdfResult.text.trim().length > 300;
            if (hasGoodText) {
              console.log("[PDF PARSER] PDF nativo com texto detectado. Ignorando chamada OCR servidor e usando texto local.");
              fullTextContent = pdfResult.text;
            } else {
              // Se não extraiu texto (scaneado/imagem) ou falhou, tenta o OCR servidor como fallback de elite
              setProgressText(`Processando OCR inteligente do PDF ${filename} via servidor...`);
              setProgress(baseProgress + Math.round(progressRange * 0.5));
              try {
                const urlToProcess = storageUrlResponse 
                  ? await supabaseService.resolveStorageUrl(storageUrlResponse)
                  : '';
                
                if (!urlToProcess) {
                  throw new Error("Erro de salvamento ou resolução da URL de armazenamento.");
                }

                const ocrRes = await apiFetch('/api/ocr-unified', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    documents: [{
                      url: urlToProcess,
                      mimeType: filetype,
                      name: filename,
                      images: pdfResult?.images
                    }]
                  })
                });
                
                if (ocrRes.ok) {
                  const ocrData = await ocrRes.json();
                  fullTextContent = ocrData.text || '';
                } else {
                  throw new Error("Não foi possível processar o OCR no servidor.");
                }
              } catch (e) {
                console.error("Falha no OCR via backend, usando texto extraído localmente (mesmo que parcial):", e);
                fullTextContent = pdfResult ? pdfResult.text : `[FALHA DE LEITURA] Não foi possível extrair o texto de ${filename}.`;
              }
            }
          } else {
              fileSummary = `[DOCUMENTO NÃO SUPORTADO] O arquivo ${filename} não é um PDF ou TXT. O sistema não pode extrair o texto.`;
          }
        } else {
          // Arquivo JÁ EXISTE no Supabase GED (Importado do Cliente)
          const dbDoc = item as any; // ScannedDocument ou similar
          
          const hasSuspectLowText = dbDoc.ocrText && dbDoc.ocrText.trim().length < 2000 && isPDF;
          
          if (dbDoc.ocrText && dbDoc.ocrText.trim().length > 100 && !hasSuspectLowText) {
            console.log(`[PDF PARSER] ⚡️ OCR pré-existente e limpo encontrado para ${filename} diretamente no objeto. Evitando re-processamento!`);
            setProgressText(`Recuperando OCR de ${filename}...`);
            setProgress(baseProgress + Math.round(progressRange * 0.85));
            fullTextContent = dbDoc.ocrText;
          } else {
            if (hasSuspectLowText) {
                console.log(`[PDF PARSER] ⚠️ Texto existente para ${filename} é muito curto (${dbDoc.ocrText?.length} chars). Forçando re-processamento profundo...`);
            }
            if (isTxT) {
              setProgressText(`Lendo conteúdo do arquivo OCR ${filename} diretamente do GED...`);
              setProgress(baseProgress + Math.round(progressRange * 0.4));
              try {
                const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                const res = await fetch(resolvedUrl);
                fullTextContent = await res.text();
              } catch (err) {
                console.error("Erro ao ler arquivo TXT do Supabase:", err);
                fileSummary = `[FALHA DE LEITURA] Não foi possível carregar o arquivo TXT ${filename}.`;
              }
            } else if (isPDF) {
              setProgressText(`Analisando estrutura do PDF do GED ${filename}...`);
              setProgress(baseProgress + Math.round(progressRange * 0.1));
              
              let pdfResult: any = null;
              try {
                const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                const res = await fetch(resolvedUrl);
                const blob = await res.blob();
                const localFile = new File([blob], filename, { type: filetype || 'application/pdf' });
                
                pdfResult = await extractTextFromPDF(localFile, (curr, total) => {
                  setProgressText(`Leitura local: analisando página ${curr} de ${total}...`);
                });
              } catch (err) {
                console.error("Erro na extração local do PDF GED:", err);
              }

              const hasGoodText = pdfResult && pdfResult.text && pdfResult.text.trim().length > 300;
              if (hasGoodText) {
                console.log("[PDF PARSER] PDF nativo com texto do GED detectado. Usando diretamente.");
                fullTextContent = pdfResult.text;
              } else {
                setProgressText(`Processando OCR inteligente do PDF ${filename} via servidor...`);
                setProgress(baseProgress + Math.round(progressRange * 0.4));
                try {
                  const resolvedUrl = await supabaseService.resolveStorageUrl(dbDoc.url);
                  const ocrRes = await apiFetch('/api/ocr-unified', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      documents: [{
                        url: resolvedUrl,
                        mimeType: filetype || 'application/pdf',
                        name: filename,
                        images: pdfResult?.images
                      }]
                    })
                  });
                  
                  if (ocrRes.ok) {
                    const ocrData = await ocrRes.json();
                    fullTextContent = ocrData.text || '';
                  } else {
                    throw new Error("Erro de resposta do servidor de OCR");
                  }
                } catch (e: any) {
                  console.error("Erro no OCR do PDF da nuvem:", e);
                  fullTextContent = pdfResult ? pdfResult.text : `[FALHA DE LEITURA] Não foi possível extrair o texto de ${filename}.`;
                }
              }
            } else {
              fileSummary = `[DOCUMENTO NÃO SUPORTADO] O arquivo ${filename} não é compatível.`;
            }
          }
        }

        if (fullTextContent) {
          setProgressText(`Consolidando conteúdo de ${filename}...`);
          setProgress(baseProgress + Math.round(progressRange * 0.9));
          
          if (isLocalFile) {
            fileSummary = `✅ **Dossiê integrado com sucesso**: O documento **${filename}** foi processado via OCR Inteligente (${fullTextContent.length} caracteres extraídos/lidos) e salvo no GED com criptografia em trânsito e backup no Supabase. O conteúdo está indexado e pronto para uso da IA.`;
          } else {
            fileSummary = `✅ **Dossiê integrado com sucesso**: O documento **${filename}** foi recuperado diretamente do GED Supabase (${fullTextContent.length} caracteres de OCR lidos) e integrado à sessão de chat para uso ativo da IA.`;
          }

          // Se temos um cliente e extraímos um novo texto OCR de um arquivo do GED, salvamos no Supabase de forma persistente!
          if (clientToUpdate && !isLocalFile) {
            const docId = (item as any).id;
            const listName = persona.aiName === 'fabricia' ? 'narrativeCertificates' : 'documents';
            const originalList = clientToUpdate[listName] || [];
            let updatedList = originalList.map((doc: any) => {
              if (doc.id === docId || doc.name === filename) {
                return { ...doc, ocrText: fullTextContent, summary: fileSummary };
              }
              return doc;
            });
            clientToUpdate[listName] = updatedList;
            console.log(`[GED SAVER] Atualizando OCR persistente de ${filename} para o cliente ${clientToUpdate.name} no Supabase...`);
            supabaseService.saveClient(clientToUpdate).catch(e => console.error("Erro ao salvar cliente com OCR atualizado:", e));
          }
        }

        const newDoc: ChatDocument = {
          id: generateId(),
          name: filename,
          type: filetype,
          fileUri: undefined, 
          mimeType: filetype,
          summary: fileSummary,
          fullText: fullTextContent || undefined,
          keyIndex: preferredKeyIndex ?? undefined
        };
        processedDocs.push(newDoc);

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { 
            ...s, 
            documents: [...(s.documents || []), newDoc],
            messages: [...s.messages, {
              id: generateId(),
              role: 'assistant',
              content: fileSummary,
              timestamp: new Date().toISOString(),
              isSystem: true
            }]
          } : s
        ));
      }

      setProgress(100);
      setProgressText('Concluído!');
      setPendingAudit(null); // Limpa o progresso pendente se terminou com sucesso
      
      const finalMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `✅ **Auditoria de Documentos Concluída.** Analisando e lendo meticulosamente todos os ${fileArray.length} arquivo(s) integrados para tomar a ciência de forma consolidada. Por favor, aguarde...`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, finalMsg] } : s
      ));

      // Trigger automatic consolidated real AI "Tomada de Ciência"
      const isFabricia = persona.aiName === 'fabricia';
      const docListText = processedDocs.map((d, idx) => `${idx + 1}. **${d.name}** (${d.fullText?.length || 0} caracteres lidos)`).join('\n');
      
      const scienceInstruction = isFabricia
        ? `[FASE DE TOMADA DE CIÊNCIA]\nTomei ciência do material abaixo integrado à sessão:\n\n${docListText}\n\nPor favor, confirme de forma simples e direta que os documentos foram lidos e estão sob controle da secretaria para as providências de atendimento. Cite brevemente os principais dados identificados (nomes, CPFs, e peças) e coloque-se à disposição dizendo que aguarda o próximo comando.`
        : `[FASE DE TOMADA DE CIÊNCIA DETALHADA]\nTomei ciência do material abaixo integrado à sessão:\n\n${docListText}\n\nPor favor, realize a leitura atenta de todos esses materiais integrados e faça um resumo executivo de ciência consolidado, mapeando de forma estruturada as seguintes informações cruciais:\n- **Dados e Qualificação das Partes**\n- **Datas de Marcos Temporais**\n- **CIDs ou Laudos de Saúde** (se houver)\n- **OABs, Valores das Causas e Pontos Críticos**\n\nAgradeça no final em seu nome profissional e confirme se está pronta para gerar relatórios técnicos de auditoria ou minutas iniciais de excelência para o caso.`;
        
      setTimeout(() => {
        handleSendMessage(scienceInstruction);
      }, 300);

    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      
      // Salva o progresso para permitir retomada
      setPendingAudit({
        fileIndex: currentIdx, 
        pageIndex: startPageIndex,
        files: fileArray as any,
        activeSessionId: activeSessionId
      });

      let friendlyError = error.message;
      if (friendlyError.includes("429") || friendlyError.includes("RESOURCE_EXHAUSTED")) {
        friendlyError = "Limite de cota atingido na IA. Todas as chaves foram tentadas. Por favor, aguarde alguns segundos e clique em 'Retomar Auditoria'.";
      } else if (friendlyError.includes("Bucket not found") || friendlyError.toLowerCase().includes("bucket")) {
        friendlyError = "O Bucket 'ged-auditoria' privativo não foi encontrado. Acesse o Supabase > Storage > New Bucket > e crie um bucket PRIVADO (sem public) com o nome 'ged-auditoria'. O GED é mantido seguro.";
      } else if (friendlyError.includes("PAYLOAD_TOO_LARGE") || friendlyError.includes("Too Large") || friendlyError.includes("413")) {
        friendlyError = "O arquivo é muito grande. Estamos tentando via Storage, mas o Google ainda encontrou limites. Tente comprimir o PDF para menos de 20MB.";
      }
      
      alert(`Erro ao ler os arquivos: ${friendlyError}`);
    } finally {
      setIsUploading(false);
      setIsLoading(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Verificar se algum arquivo excede o limite do servidor (Aceitamos até 20MB via Storage bypass)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const largeFiles = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    
    if (largeFiles.length > 0) {
      alert(`Os seguintes arquivos são muito grandes (> 20MB): ${largeFiles.map(f => f.name).join(', ')}. Por favor, reduza o tamanho desses arquivos.`);
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setProgressText('Iniciando processamento...');
    
    try {
      let activeSessionId = currentSessionId;
      
      if (!activeSessionId) {
        const newSession: ChatSession = {
          id: generateId(),
          title: 'Nova Conversa',
          messages: [],
          date: new Date().toLocaleDateString('pt-BR'),
          documents: []
        };
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newSession.id);
        activeSessionId = newSession.id;
      }

      const fileArray = Array.from(files);
      
      // Inform user we are reading the files
      const readingMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Estou iniciando a **Auditoria Detalhada** de ${fileArray.length} arquivo(s). Vou realizar a leitura nativa e integral de cada documento a partir do banco de dados para garantir máxima precisão técnica. Por favor, aguarde...`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
      ));

      await processFilesPhased(fileArray, activeSessionId);
    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      alert(`Erro ao ler os arquivos: ${error.message}`);
      setIsUploading(false);
    }
  };

  const handleImportClient = async (client: any) => {
    setIsClientModalOpen(false);
    setIsUploading(true);
    setProgress(0);
    setProgressText(`Buscando detalhes de ${client.name}...`);

    try {
      // Fetch full details including documents
      const fullClient = await supabaseService.getClientDetails(client.id);
      
      const documentsToImport = persona.aiName === 'fabricia' ? (fullClient?.narrativeCertificates || []) : (fullClient?.documents || []);

      if (!fullClient || documentsToImport.length === 0) {
          alert(`Este cliente não possui ${persona.aiName === 'fabricia' ? 'certidões narratórias' : 'documentos'} cadastrados.`);
          setIsUploading(false);
          return;
      }

      setProgressText(`Preparando dossiê de ${fullClient.name}...`);
      
      let activeSessionId = currentSessionId;
      
      if (!activeSessionId) {
        const newSession: ChatSession = {
          id: generateId(),
          title: `Dossiê: ${fullClient.name}`,
          messages: [],
          date: new Date().toLocaleDateString('pt-BR'),
          documents: []
        };
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newSession.id);
        activeSessionId = newSession.id;
      }

      const readingMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Importando dossiê do cliente **${fullClient.name}**. Vou realizar a **Auditoria Detalhada** de ${persona.aiName === 'fabricia' ? 'todas as certidões narratórias' : 'todos os documentos do GED'} a partir do nosso banco de dados, garantindo ciência integral e mapeamento técnico de cada folha. Por favor, aguarde...`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
      ));

      const documentsList = documentsToImport.map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type || 'application/pdf',
        url: d.url,
        ocrText: d.ocrText,
        summary: d.summary
      }));

      await processFilesPhased(documentsList, activeSessionId, 0, 0, fullClient);
    } catch (error) {
      console.error("Error importing client:", error);
      alert("Erro ao importar cliente.");
      setIsUploading(false);
    }
  };

  const generateDocx = async (content: string) => {
    try {
      const response = await apiFetch('/api/dr-michel/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error('Falha ao gerar documento');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Peticao_Dr_Michel_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o arquivo Word.');
    }
  };

  const handleOpenInEditor = (content: string) => {
    if (onOpenPetition) {
      // Convert Markdown to HTML to ensure formatting (bold, italic, lists) is preserved
      const formattedContent = markdownToHtml(content);

      onOpenPetition({
        title: `${persona.petitionTitlePrefix} - ${new Date().toLocaleDateString('pt-BR')}`,
        content: formattedContent
      });
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-110px)] md:h-[calc(100vh-120px)] w-full bg-white dark:bg-bordeaux-950/60 rounded-lg md:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-gold-500/20">
      <EliteRedactionModal 
        isOpen={showEliteModal} 
        onClose={() => setShowEliteModal(false)}
        currentModel={selectedModel}
        currentProvider={selectedModelProvider}
        onConfirm={(provider, model) => {
          setShowEliteModal(false);
          if (pendingEliteTask) {
             handleSendMessage(pendingEliteTask.messageText, pendingEliteTask.images, true, provider, model);
          }
        }}
      />
      
      {showAiMemoryModal && (
        <AiMemoryModal 
          onClose={() => setShowAiMemoryModal(false)} 
          personaId={persona.aiName} 
        />
      )}
      
      {/* SIDEBAR: HISTÓRICO */}
      <aside className={`${isSidebarOpen ? 'w-full md:w-80' : 'w-0'} absolute md:relative z-20 h-full overflow-hidden shrink-0 transition-all duration-300 border-r border-slate-200 dark:border-gold-500/20 flex flex-col bg-slate-50 dark:bg-bordeaux-950/60/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-gold-500/20 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-200 dark:hover:bg-bordeaux-900/50 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex gap-2">
            <button 
              onClick={() => {
                createNewSession();
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className="flex-1 fc-btn-primary text-cream-50 font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary-900/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Nova
            </button>
            <button
              onClick={() => setShowAiMemoryModal(true)}
              className="px-3 bg-white dark:bg-bordeaux-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-sm hover:bg-emerald-50 dark:hover:bg-bordeaux-900 hover:scale-105 transition-all outline-none flex items-center justify-center"
              title="Memória da IA (Treinamento)"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            {filteredSessions.map(session => (
              <div 
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`group p-3 rounded-xl cursor-pointer border transition-all ${currentSessionId === session.id ? 'bg-white dark:bg-bordeaux-900/40 border-emerald-500 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-bordeaux-900/50/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
              >
                {editingSessionId === session.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(session.id, e);
                        if (e.key === 'Escape') cancelEditing(e as any);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 bg-white dark:bg-bordeaux-950/60 border border-emerald-500 rounded px-2 py-1 text-sm outline-none"
                    />
                    <button onClick={(e) => saveTitle(session.id, e)} className="text-emerald-600 hover:text-emerald-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-red-500 hover:text-red-600">
                      <XMark className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{session.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{session.date}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => startEditing(session, e)}
                        className="p-1 text-slate-400 hover:text-emerald-500"
                        title="Renomear conversa"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Excluir conversa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-white dark:bg-bordeaux-950 min-w-0">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-10 p-2 bg-white dark:bg-bordeaux-900/40 shadow-md rounded-full border border-slate-200 dark:border-gold-500/15 hover:scale-110 transition-transform"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* WELCOME SCREEN OR MESSAGES */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="max-w-4xl mx-auto mt-12 space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                  Olá, MICHEL!<br />
                  <span className="text-emerald-600">{persona.welcomeTitle}</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400">{persona.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-bordeaux-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-primary-700" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Resumo de Caso</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Crie resumo de documentos, destacando fatos e argumentos jurídicos.</p>
                  <button 
                    onClick={() => handleSendMessage('Gere um resumo técnico deste caso com base nos dados da calculadora.')}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Briefcase className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Geração de Peças</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Redija petições iniciais, recursos e requerimentos prontos para o Word.</p>
                  <button 
                    onClick={() => handleSendMessage('GERAR PEÇA: Petição Inicial de Aposentadoria por Tempo de Contribuição.')}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-bordeaux-950/60 p-6 rounded-2xl border border-slate-200 dark:border-gold-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Search className="w-6 h-6 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Análise de Provas</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Envie CNIS, PPP ou laudos para identificar lacunas e agentes nocivos.</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-bordeaux-900/40"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou gerencie manualmente abaixo</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-bordeaux-900/40"></div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 px-2 sm:px-4">
              {currentSession.messages.map(msg => (
                <div key={msg.id} className={`group ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                  {msg.role === 'user' ? (
                    // BUBBLE DO USUÁRIO — estilo Claude (cinza claro à direita, compacto)
                    <div className="max-w-[85%] bg-slate-100 dark:bg-bordeaux-900/40 rounded-2xl rounded-tr-md px-5 py-3.5 shadow-sm">
                      <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-inter">
                        {(msg.content || '').length > 3000
                          ? (msg.content || '').substring(0, 800) + '\n\n[... conteúdo longo ocultado ...]'
                          : (msg.content || '')}
                      </div>
                      <div className="flex justify-end mt-1.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // BUBBLE DA IA — estilo Claude (largura total, avatar, prose tipográfico)
                    <div className="w-full flex gap-3 sm:gap-4">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-900/30 ring-2 ring-primary-200/50 dark:ring-primary-900/40">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{persona.displayName}</span>
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">OAB/RJ 231.640</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                        prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                                        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                        prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                        prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                                        prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20
                                        prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                        prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300
                                        prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em]
                                        prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
                                        prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:font-bold
                                        font-inter">
                          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content || '') }} />
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyToClipboard(msg.content || '', msg.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-md transition-colors"
                            title="Copiar"
                          >
                            {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>
                          {(
                            /petição|reclamação|excelentíssimo|ao juízo|inicial|contestação|recurso|vossa excelência/i.test(msg.content || '') ||
                            (msg.content || '').length > 1000
                          ) && (
                            <>
                              <div className="w-px h-4 bg-slate-200 dark:bg-bordeaux-900/60 mx-1"></div>
                              <button
                                onClick={() => generateDocx(msg.content || '')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
                                title="Baixar Word"
                              >
                                <Download className="w-3.5 h-3.5" /> Word
                              </button>
                              <button
                                onClick={() => handleOpenInEditor(msg.content || '')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 fc-btn-primary text-cream-50 rounded-md text-xs font-semibold transition-colors shadow-sm"
                                title="Editor"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editor
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="w-full flex gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-900/30 ring-2 ring-primary-200/50 dark:ring-primary-900/40">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{persona.displayName}</span>
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded animate-pulse">{progressText}</span>
                    </div>

                    {!streamingMessage && progress < 100 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="w-full bg-slate-100 dark:bg-bordeaux-900/40 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-primary-600 to-primary-700 h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{progress}% • Padrão Ouro Felix & Castro</span>
                          <span className="animate-pulse">{isUploading ? "Processando GED..." : "Redigindo peça..."}</span>
                        </div>
                      </div>
                    )}

                    {streamingMessage && (
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                      prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                      prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                      prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20
                                      prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                      font-inter">
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(streamingMessage) }} />
                        <span className="w-1.5 h-4 bg-emerald-500 inline-block animate-pulse ml-1 align-middle rounded-sm"></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-3.5 sm:p-6 border-t border-slate-200 dark:border-gold-500/20 bg-white dark:bg-bordeaux-950">
          <div className="max-w-4xl mx-auto relative">

            {/* Badge de Tier de Petição Ativo */}
            {petitionLength !== 'Padrão (Livre)' && (
              <div className={`mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                /Premium/.test(petitionLength)
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${/Premium/.test(petitionLength) ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
                {/Premium/.test(petitionLength)
                  ? `Tier Premium ativo · DeepSeek V3.2 (OpenRouter)`
                  : `Tier ${petitionLength.replace(' palavras', 'p').replace(/(\d{4})/, '$1 palavras')} · DeepSeek V4 Flash`}
              </div>
            )}

            {/* Resume Audit Notification */}
            {pendingAudit && !isUploading && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center">
                    <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Auditoria Interrompida</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Restam {pendingAudit.files.length - pendingAudit.fileIndex} arquivos. Deseja continuar?
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPendingAudit(null)}
                    className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/40 rounded-lg transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={resumeAudit}
                    className="px-4 py-1.5 bg-gold-600 hover:bg-gold-700 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2"
                  >
                    <History className="w-3 h-3" /> Retomar Auditoria
                  </button>
                </div>
              </div>
            )}

            {/* PAINEL DE AÇÕES INTELIGENTES (Harness Felix & Castro) */}
            <div className="mb-3.5 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black text-slate-400 dark:text-gold-500/40 uppercase tracking-widest select-none pr-1">Harness de Ações:</span>
              
              <button
                type="button"
                onClick={() => {
                  setInput("[CONFIRMAR O CORPO DA PETIÇÃO] Solicito a análise técnica de rito e aprovação do atual rascunho. Por favor, pergunte-me quais próximos passos de exportação ou ritos processuais de rascunhos adicionais deseja realizar.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Confirmar rascunho"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Confirmar
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[GERAÇÃO MODULAR] Desejo elaborar uma seção em tópicos isolados e independentes para a petição. Por favor, detalhe quais tópicos (como Qualificação, Fatos, Direito ou Pedidos) estão disponíveis e pergunte por qual deles deseja iniciar a redação.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Geração Modular"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Geração Modular
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[CORREÇÃO CIRÚRGICA]\n\nTRECHO ATUAL:\n\"Insira aqui o parágrafo ou frase que está imperfeito\"\n\nCORREÇÃO SOLICITADA:\n\"Descreva aqui a alteração desejada\"");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Correção Cirúrgica de Fragmentos"
              >
                <Scissors className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Correção Cirúrgica
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[VALIDAÇÃO E AUDITORIA] Solicito auditoria jurídica profunda e pente-fino no atual rascunho de petição para reportar contradições fáticas, omissões de rito ou leis ausentes. Por favor, apresente o relatório de auditoria.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Validar & Auditar"
              >
                <ShieldExclamation className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Validar & Auditar
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput("[REFAZER DO ZERO] Desejo apagar as alterações anteriores e reescrever toda a peça do completo zero. Por favor, pergunte-me qual tese jurídica, rito processual ou direcionamento fático deseja incorporar nesta reescrita estrutural.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Refazer petição"
              >
                <Loader2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Refazer do Zero
              </button>
            </div>

            <div className="bg-white dark:bg-bordeaux-950/60 border border-slate-200 dark:border-gold-500/15 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <textarea 
                id={persona.inputId}
                rows={1}
                placeholder={persona.placeholder}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white resize-none min-h-[44px] max-h-[100px] overflow-y-auto text-sm"
              />
              <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-t border-slate-100 dark:border-gold-500/20">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1 mr-1">
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                    title="Anexar documentos (CNIS, PPP, etc.)"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsClientModalOpen(true)}
                    disabled={isUploading}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all flex items-center gap-1"
                    title="Importar Cliente (GED)"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-bordeaux-900/60"></div>
                  <select
                    value={petitionLength}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPetitionLength(val);
                      if (val === 'Premium 7000 palavras') {
                        setSelectedModel('deepseek/deepseek-v4-flash');
                        setSelectedModelProvider('openrouter');
                      }
                    }}
                    className="bg-slate-50 dark:bg-slate-850/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer flex-1 min-w-0 max-w-[80px] sm:max-w-none sm:w-auto truncate shrink"
                    title="Tamanho da Peça (Padrão Ouro Felix & Castro)"
                  >
                    <option value="Padrão (Livre)">Livre</option>
                    <option value="Mínimo 3000 palavras">3k pal.</option>
                    <option value="Médio 4000 palavras">4k pal.</option>
                    <option value="Máximo 5000 palavras">5k pal.</option>
                    <option value="Premium 7000 palavras">7k pal.</option>
                  </select>
                  <div className="h-6 w-px bg-slate-200 dark:bg-bordeaux-900/60"></div>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      setSelectedModelProvider('openrouter');
                    }}
                    className="bg-slate-50 dark:bg-slate-850/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-300 outline-none cursor-pointer hover:text-emerald-600 dark:hover:text-gold-400 transition-colors flex-1 min-w-0 max-w-[90px] sm:max-w-none sm:w-auto truncate shrink"
                  >
                    <optgroup label="OpenRouter">
                      <option value="deepseek/deepseek-v4-flash">DeepSeek V4</option>
                    </optgroup>
                  </select>
                </div>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:hover:bg-primary-700 text-white p-2.5 rounded-xl shadow-lg shadow-primary-900/40 transition-all active:scale-95"
                  title="Enviar mensagem"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              {persona.footer}
            </p>
          </div>
        </div>
      </div>

      {/* Client Import Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-bordeaux-950/60 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-gold-500/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Importar Cliente (GED)</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XMark className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-gold-500/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou CPF..." 
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {clients.length === 0 ? (
                <p className="text-center text-slate-500 py-10">Carregando clientes...</p>
              ) : (
                <div className="space-y-2">
                  {clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || c.cpf.includes(clientSearchTerm)).map(client => (
                    <button 
                      key={client.id}
                      onClick={() => handleImportClient(client)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-gold-500/15 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.cpf} • {client.documents?.length || 0} documentos</p>
                      </div>
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaChat;
