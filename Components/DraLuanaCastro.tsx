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
  UserIcon as User, 
  UsersIcon as Users,
  CpuChipIcon as Bot,
  ClockIcon as History, 
  ChatBubbleLeftRightIcon as MessageSquare, 
  TrashIcon as Trash2,
  ClipboardIcon as Copy,
  PencilIcon as Edit2,
  XMarkIcon as XMark
} from '@heroicons/react/24/outline';
import { CheckIcon as Check } from '@heroicons/react/24/solid';
import { supabaseService } from '../services/supabaseService';
import { safeSetLocalStorage } from '../utils';
import { apiFetch } from '../services/apiService';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import EliteRedactionModal from './EliteRedactionModal';
import { markdownToHtml } from '../src/utils/markdownToHtml';

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
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
  documents?: ChatDocument[];
  uploadKeyIndex?: number | null;
}

interface DraLuanaCastroProps {
  initialSessions?: ChatSession[];
  onSaveSessions?: (sessions: ChatSession[]) => void;
  onOpenPetition?: (petition: { title: string; content: string }) => void;
  customLaws?: any[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const PHASE_TIMEOUT = 180000; // 3 minutes in milliseconds

const DraLuanaCastro: React.FC<DraLuanaCastroProps> = ({ initialSessions, onSaveSessions, onOpenPetition, customLaws }) => {
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

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedModelProvider, setSelectedModelProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [petitionLength, setPetitionLength] = useState('Padrão (Livre)');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sessionsRef = useRef(sessions);
  const pendingSyncRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSessionsRef = useRef<Record<string, string>>({});
  
  useEffect(() => {
    if (pendingAudit) {
      idbSet('pending_audit_dra_luana', pendingAudit).catch(console.error);
    } else {
      idbDel('pending_audit_dra_luana').catch(console.error);
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
        idbGet('pending_audit_dra_luana').then(saved => {
          if (saved) {
            console.log("Audit Dra Luana pendente recuperado:", saved);
            setPendingAudit(saved);
          }
        }).catch(console.error);

        const dbSessions = await supabaseService.getAIConversations('luana');
        let formattedSessions = dbSessions && dbSessions.length > 0 ? dbSessions.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          messages: s.messages,
          documents: s.documents || []
        })) : [];

        // Merge with local storage to prevent data loss on page refresh
        const localSaved = localStorage.getItem('dra_luana_sessions');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            const mergedSessions = [...formattedSessions];
            for (const localSession of parsed) {
              const dbIndex = mergedSessions.findIndex(s => s.id === localSession.id);
              if (dbIndex === -1) {
                mergedSessions.push(localSession);
              }
            }
            mergedSessions.sort((a, b) => b.id.localeCompare(a.id));
            formattedSessions = mergedSessions;
          } catch (e) {
            console.error("Error parsing local sessions:", e);
          }
        }

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
    return sessions.map(session => ({
      ...session,
      messages: session.messages.map(msg => {
        if (msg.role === 'user' && msg.content.length > 50000 && msg.content.includes('--- CONTEÚDO DO ARQUIVO:')) {
          return {
            ...msg,
            content: msg.content.substring(0, 50000) + '\n\n[... Conteúdo extremamente longo truncado para preservação do banco de dados. A IA já processou o conteúdo integral anteriormente ...]'
          };
        }
        return msg;
      })
    }));
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
              ai_name: 'luana'
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
    if (isLoading) {
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
    } else {
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

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

    if (messageText.toUpperCase().includes("CONTINUAR AUDITORIA") && pendingAudit) {
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

    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? messageText.slice(0, 30) : s.title } : s
    ));
    setInput('');
    const textarea = document.getElementById('chat-input-luana');
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

      // If payload is > 4MB (Vercel serverless limit is 4.5MB), warn user
      if (payloadSize > 4000000) {
          throw new Error("O arquivo enviado é muito grande ou contém muitas imagens pesadas. Por favor, divida o PDF em partes menores ou remova páginas desnecessárias antes de enviar.");
      }

      const abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 800000); // 800 seconds — conforme solicitado para petições longas

      const session = sessionsRef.current.find(s => s.id === sessionId);
      const docSummaries = session?.documents?.map(doc => {
        const header = `DOCUMENTO: ${doc.name}\n`;
        const summaryPart = doc.summary ? `MAPEAMENTO DA AUDITORIA DETALHADA:\n${doc.summary}\n\n` : '';
        
        // Se temos um arquivo na nuvem que o back-end vai processar, enviar menos texto para poupar RAG
        if (doc.fileUri) {
          return `${header}${summaryPart}[Arquivo presente na Base de Dados Nativa (GED) ou Storage]`;
        }

        const activeProvider = eliteProviderOverride || selectedModelProvider;
        const activeModel = eliteModelOverride || selectedModel;
        const textLimit = doc.fileUri ? 1000 : (activeModel?.includes('claude') ? 50000 : (activeProvider === 'openrouter' ? 150000 : 500000));
        const fullTextPart = doc.fullText ? `CONTEÚDO:\n${doc.fullText.substring(0, textLimit)}` : '';
        return `${header}${summaryPart}${fullTextPart}`;
      }).join('\n\n---\n\n') || '';

      // 1. Get embedding and perform Keyword Search in parallel
      let ragContext = '';

      // Detectar mensagens casuais para evitar busca RAG desnecessária
      const isCasualMessage = /^(oi|olá|bom dia|boa tarde|boa noite|obrigad|tudo bem|tudo bom|ok|certo|entendido|perfeito|sim|não|valeu|vlw|blz|beleza)/i.test(messageText.trim()) && messageText.trim().length < 60;

      try {
        if (isCasualMessage) {
          // Mensagem casual: pular busca RAG completamente
          ragContext = '';
        } else {
        // Se for comando de geração, enriquece a query com
        // termos jurídicos trabalhistas para forçar o RAG
        // a recuperar as leis principais da CLT
        const isGenerationCommand =
          messageText.includes('GERAR') ||
          messageText.includes('Gerar');

        // Busca TODOS os títulos da base dinamicamente.
        // Documentos futuros são captados automaticamente
        // desde que sigam os padrões de nomenclatura da base.
        const allTitles = isGenerationCommand
          ? await supabaseService.getAllLegalDocumentTitles()
          : [];

        const ragQuery = messageText.substring(0, 400);

        const [embedResponse, keywordResults] = await Promise.all([
          apiFetch('/api/rag/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: ragQuery }),
            signal: abortController.signal
          }),
          supabaseService.keywordSearchLegalDocuments(messageText, 5)
        ]);

        const titleResults = allTitles.length > 0
          ? await supabaseService.searchByTitles(allTitles, 5)
          : [];

        if (embedResponse.ok) {
          const { embedding } = await embedResponse.json();
          if (embedding && embedding.length > 0) {
            // Threshold 0.60 e máximo 12 resultados para reduzir ruído
            const vectorResults = await supabaseService
              .searchLegalDocuments(embedding, 0.60, 25);

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
              seen.add(r.id);
              merged.push({ ...r, source: 'vector' });
            });
            // Keyword depois (complementar)
            keywordResults.forEach((r: any) => {
              if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, source: 'keyword' });
              }
            });

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
          ragContext = keywordResults.map((r: any) => {
            const title = r.metadata?.title 
              ? `FONTE: ${r.metadata.title} [Keyword Match]\n` 
              : '';
            return `${title}${r.content}`;
          }).join('\n\n---\n\n');
        }
        } // fecha bloco else (não-casual)
      } catch (err) {
        console.warn("RAG search failed:", err);
      }

      // ============================================================
      // COMPRESSÃO DE HISTORY (Camada 1 — economia de tokens)
      // ============================================================
      const compressHistory = (msgs: Message[]): Message[] => {
        const last = msgs.slice(-40);
        return last.map((m) => {
          if (m.role === 'user' && (m.content.includes('[FASE DE TOMADA DE CIÊNCIA]') || (m.content.length > 5000 && m.content.includes('CONTEÚDO:')))) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '\n\n[... Compilado/documento completo disponível no documentContext desta requisição — conteúdo integral preservado ...]'
            };
          }
          if (m.role === 'assistant' && m.content.length > 3000) {
            return {
              ...m,
              content: m.content.substring(0, 500) + '\n\n[... Peça/Relatório completo gerado anteriormente — conteúdo integral disponível no Editor de Petições. Foque APENAS na nova solicitação do usuário ...]'
            };
          }
          return m;
        });
      };

      const compressedHistory = compressHistory(session?.messages || []);

      let fullText = '';
      let isFinished = false;
      let resumeCount = 0;
      const MAX_RESUMES = 3;

      while (!isFinished && resumeCount <= MAX_RESUMES) {
        let currentMessage = messageText;
        if (resumeCount > 0) {
          const anchor = fullText.slice(-400).replace(/\n/g, ' ');
          currentMessage = `(GERAÇÃO INTERROMPIDA — CONTINUE A PEÇA EXATAMENTE DE ONDE PAROU, SEM INTRODUÇÕES, SEM RECOMEÇAR. Última linha gerada: "${anchor}")`;
        }

        try {
          const response = await apiFetch('/api/dra-luana/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: currentMessage,
              documentContext: docSummaries,
              history: resumeCount === 0 ? compressedHistory : [...compressedHistory, { role: 'user', content: messageText }, { role: 'assistant', content: fullText }],
              images: resumeCount === 0 ? (images || []) : [],
              files: resumeCount === 0 ? (session?.documents?.filter(d => d.fileUri).map(d => ({ fileUri: d.fileUri, mimeType: d.mimeType })) || []) : [],
              minWage: localStorage.getItem('app_min_wage') || '1621.00',
              ragContext: resumeCount === 0 ? ragContext : undefined,
              customLaws,
              modelProvider: eliteProviderOverride || selectedModelProvider,
              model: eliteModelOverride || selectedModel,
              petitionLength,
              keyIndex: session?.uploadKeyIndex,
              sessionId: session?.id
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            if (resumeCount === 0) {
              if (timeoutId) clearTimeout(timeoutId);
              const errorText = await response.text();
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
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
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
                      isFinished = true;
                      continue;
                    }

                    let data;
                    try {
                      data = JSON.parse(dataStr);
                    } catch (e) {
                      continue;
                    }

                    if (data.error) throw new Error(data.error);
                    if (data.max_tokens) {
                      isFinished = false;
                      throw new Error("MAX_TOKENS_HIT");
                    }
                    if (data.heartbeat) continue;

                    if (data.text) {
                      fullText += data.text;
                      setStreamingMessage(fullText);
                    }
                  }
                }
              }
            } catch (readError: any) {
              if (readError.name === 'AbortError') {
                console.log('Stream aborted after 800 seconds');
                fullText += '\n\n[Aviso: Tempo limite atingido. Geração pausada. Digite "continue" para prosseguir.]';
                isFinished = true;
              } else {
                throw readError;
              }
            }
          } else {
            isFinished = true;
          }
        } catch (readError: any) {
          if (resumeCount < MAX_RESUMES && (readError.message === 'MAX_TOKENS_HIT' || readError.name === 'TypeError' || readError.message?.includes('fetch'))) {
            console.log(`[Dra.Luana] Auto-resume após interrupção (tentativa ${resumeCount + 1})...`);
            resumeCount++;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            if (resumeCount > 0) fullText += '\n\n[Aviso: Geração interrompida após múltiplas tentativas de retomada automática.]';
            isFinished = true;
            if (resumeCount === 0) throw readError;
          }
        }
      }

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
      setStreamingMessage('');
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

  const processFilesPhased = async (fileArray: File[], activeSessionId: string, startFileIndex = 0, startPageIndex = 0) => {
    let currentIdx = startFileIndex;
    try {
      // Obter o índice da chave preferida da sessão, se já existir
      const currentSession = sessionsRef.current.find(s => s.id === activeSessionId);
      let preferredKeyIndex = currentSession?.uploadKeyIndex;

      for (let i = startFileIndex; i < fileArray.length; i++) {
        currentIdx = i;
        const file = fileArray[i];
        setProgressText(`Preparando ${file.name} (${i + 1}/${fileArray.length})...`);
        setProgress(Math.round(((i) / fileArray.length) * 100));

        let uploadData: any = {};
        let fileSummary = `Arquivo enviado e processado pela IA: ${file.name}`;
        let fullTextContent = '';
        
        const isTxT = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');

        if (isTxT) {
          setProgressText(`Lendo texto do arquivo OCR ${file.name}...`);
          fullTextContent = await file.text();
          
          setProgressText(`Analisando conteúdo de ${file.name}...`);
          try {
            const aiResponse = await apiFetch('/api/dra-luana/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `[FASE DE TOMADA DE CIÊNCIA] Realize a auditoria detalhada e integral deste documento (TXT/OCR): ${file.name}.\n\nCONTEÚDO:\n${fullTextContent.substring(0, 500000)}\n\nExtraia nomes de partes, datas, CPFs, CIDs, valores e fatos cruciais. Responda seguindo o protocolo: "✅ Ciência tomada de [Nome do Arquivo]. Dados extraídos: [Lista detalhada]. Aguardando próxima parte."`,
                history: [],
                files: [],
                minWage: localStorage.getItem('app_min_wage') || '1621.00',
                model: "gemini-3-flash-preview", 
                keyIndex: preferredKeyIndex
              })
            });

            if (aiResponse.ok) {
              const reader = aiResponse.body?.getReader();
              const decoder = new TextDecoder();
              let fullAiResText = "";
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const dataStr = line.replace('data: ', '');
                      if (dataStr === '[DONE]') continue;
                      try {
                        const data = JSON.parse(dataStr);
                        if (data.text) fullAiResText += data.text;
                      } catch(e) {}
                    }
                  }
                }
              }
              if (fullAiResText && !fullAiResText.includes('"error":')) {
                fileSummary = fullAiResText;
              } else {
                fileSummary = `[LEITURA CONCLUÍDA LOCAMENTE] O texto do OCR foi anexado em memória (tamanho: ${fullTextContent.length} caracteres), mas o resumo IA falhou por cota.`;
              }
            } else {
              fileSummary = `[LIDO COM SUCESSO] OCR anexado à memória do Supabase. Resumo ignorado por falha na API.`;
            }
          } catch (e) {
            fileSummary = `[LIDO COM SUCESSO] Texto arquivado e disponível para o contexto sem resumo IA.`;
          }
        } else {
          // Bypass Vercel 4.5MB limit if file is large
          if (file.size > 4 * 1024 * 1024) {
            setProgressText(`Enviando arquivo grande via Storage (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`);
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storageUrl = await supabaseService.uploadFile('ged-auditoria', `temp/${Date.now()}_${sanitizedFileName}`, file);
            
            if (!storageUrl) throw new Error("Falha ao fazer upload temporário para o Storage.");
  
            const urlResponse = await apiFetch('/api/upload-from-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: storageUrl,
                mimeType: file.type,
                fileName: file.name,
                keyIndex: preferredKeyIndex
              })
            });
  
            if (!urlResponse.ok) {
              const errText = await urlResponse.text();
              throw new Error(`Falha no processamento via URL: ${errText}`);
            }
            uploadData = await urlResponse.json();
          } else {
            setProgressText(`Enviando ${file.name} para a IA...`);
            const formData = new FormData();
            formData.append('file', file);
            if (preferredKeyIndex !== undefined && preferredKeyIndex !== null) {
              formData.append('keyIndex', preferredKeyIndex.toString());
            }
  
            const uploadResponse = await apiFetch('/api/upload-file', {
              method: 'POST',
              body: formData
            });
  
            if (!uploadResponse.ok) {
              const errText = await uploadResponse.text();
              let errMessage = "Falha no upload";
              try {
                const errJson = JSON.parse(errText);
                errMessage = errJson.error || errMessage;
              } catch(e) {
                errMessage = "Erro no servidor: " + errText.substring(0, 100);
              }
              throw new Error(errMessage);
            }
            uploadData = await uploadResponse.json();
          }
  
          // Se for o primeiro upload da sessão, fixamos a chave para o resto da sessão
          if (preferredKeyIndex === undefined || preferredKeyIndex === null) {
            preferredKeyIndex = uploadData.keyIndex;
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, uploadKeyIndex: preferredKeyIndex } : s));
          }
  
          // --- NEW: Detailed AI Analysis for each document ---
          setProgressText(`Analisando conteúdo de ${file.name}...`);
          
          try {
            const aiResponse = await apiFetch('/api/dra-luana/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `[FASE DE TOMADA DE CIÊNCIA] Realize a auditoria detalhada e integral deste documento: ${file.name}. Extraia nomes de partes, datas, CPFs, CIDs, valores e fatos cruciais. Responda seguindo o protocolo: "✅ Ciência tomada de [Nome do Arquivo]. Dados extraídos: [Lista detalhada]. Aguardando próxima parte."`,
                history: [],
                files: [{ fileUri: uploadData.fileUri, mimeType: uploadData.mimeType }],
                minWage: localStorage.getItem('app_min_wage') || '1621.00',
                model: "gemini-3-flash-preview",
                keyIndex: preferredKeyIndex
              })
            });
  
            if (aiResponse.ok) {
              const reader = aiResponse.body?.getReader();
              const decoder = new TextDecoder();
              let fullAiResText = "";
              
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const dataStr = line.replace('data: ', '');
                      if (dataStr === '[DONE]') continue;
                      try {
                        const data = JSON.parse(dataStr);
                        if (data.text) fullAiResText += data.text;
                      } catch(e) {}
                    }
                  }
                }
              }
              
              if (fullAiResText && !fullAiResText.includes('"error":')) {
                fileSummary = fullAiResText;
              } else {
                fileSummary = `[FALHA DE LEITURA] O arquivo ${file.name} foi recebido, mas os limites de cota da API (Erro 429) impediram a extração automática do texto e dos cálculos pela IA nesta etapa. Recomenda-se reenviar a planilha de cálculos se a peça gerada falhar em apontar os devidos valores.`;
                console.warn("Retorno mascarado com erro da IA ou vazio:", fullAiResText);
              }
            } else {
              const errText = await aiResponse.text();
              console.warn("IA falhou na análise inicial:", errText);
              fileSummary = `[FALHA DE COMUNICAÇÃO] O servidor recursou a análise inicial do documento ${file.name} (Erro API). A IA arquivista não pôde ler seus dados.`;
            }
          } catch (e) {
            console.warn("Falha na análise inicial do arquivo:", e);
            fileSummary = `[FALHA DE ANÁLISE INTERNA] Erro de sistema ao tentar extrair conteúdo de ${file.name}.`;
          }
        }

        const newDoc: ChatDocument = {
          id: generateId(),
          name: file.name,
          type: file.type,
          fileUri: uploadData.fileUri,
          mimeType: uploadData.mimeType,
          summary: fileSummary,
          fullText: fullTextContent || undefined,
          keyIndex: preferredKeyIndex || uploadData.keyIndex
        };

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { 
            ...s, 
            documents: [...(s.documents || []), newDoc],
            messages: [...s.messages, {
              id: generateId(),
              role: 'assistant',
              content: fileSummary,
              timestamp: new Date().toISOString()
            }]
          } : s
        ));
      }

      setProgress(100);
      setProgressText('Concluído!');
      setPendingAudit(null);
      
      const finalMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `✅ **Auditoria concluída.** Tomei ciência integral de todos os ${fileArray.length} arquivo(s) enviado(s) e mapeei os dados trabalhistas essenciais de cada documento. Estou pronta para **GERAR RELATÓRIO** ou **GERAR PEÇA** com base nas informações consolidadas. Como deseja prosseguir?`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, finalMsg] } : s
      ));

    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      
      // Salva progresso para retomada
      setPendingAudit({
        fileIndex: currentIdx,
        pageIndex: startPageIndex,
        files: fileArray,
        activeSessionId: activeSessionId
      });

      let friendlyError = error.message;
      if (friendlyError.includes("429") || friendlyError.includes("RESOURCE_EXHAUSTED")) {
        friendlyError = "Limite de cota atingido na IA. Todas as chaves foram tentadas. Por favor, aguarde alguns segundos e clique em 'Retomar Auditoria'.";
      } else if (friendlyError.includes("Bucket not found") || friendlyError.toLowerCase().includes("bucket")) {
        friendlyError = "O Bucket 'ged-auditoria' não existe no seu Supabase Storage. Para conseguirmos enviar este arquivo grande, acesse seu painel Supabase > Storage > New Bucket > e crie um public bucket com o nome 'ged-auditoria'.";
      } else if (friendlyError.includes("PAYLOAD_TOO_LARGE") || friendlyError.includes("Too Large") || friendlyError.includes("413")) {
        friendlyError = "O arquivo é muito grande. Estamos tentando via Storage, mas o Google ainda encontrou limites. Tente comprimir o PDF para menos de 20MB.";
      }

      alert(`Erro ao ler os arquivos: ${friendlyError}`);
    } finally {
      setIsUploading(false);
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
      a.download = `Peticao_Dra_Luana_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o arquivo Word.');
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
      
      if (!fullClient || !fullClient.documents || fullClient.documents.length === 0) {
          alert("Este cliente não possui documentos cadastrados.");
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
        content: `Importando dossiê do cliente **${fullClient.name}**. Vou realizar a **Auditoria Detalhada** de todos os documentos do GED a partir do nosso banco de dados, garantindo ciência integral e mapeamento técnico de cada folha. Por favor, aguarde...`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, readingMsg] } : s
      ));

      const fileArray: File[] = [];
      for (let i = 0; i < fullClient.documents.length; i++) {
        const doc = fullClient.documents[i];
        try {
          const res = await fetch(doc.url);
          const blob = await res.blob();
          const file = new File([blob], doc.name, { type: doc.type || 'application/pdf' });
          fileArray.push(file);
        } catch (e) {
          console.error(`Erro ao baixar documento ${doc.name}:`, e);
        }
      }

      await processFilesPhased(fileArray, activeSessionId);
    } catch (error) {
      console.error("Error importing client:", error);
      alert("Erro ao importar cliente.");
      setIsUploading(false);
    }
  };

  const handleOpenInEditor = (content: string) => {
    if (onOpenPetition) {
      // Convert newlines to paragraphs to ensure formatting is preserved in the editor
      const formattedContent = content
        .split('\n')
        .map(line => line.trim() ? `<p>${line}</p>` : '<p>&nbsp;</p>')
        .join('');

      onOpenPetition({
        title: `Petição Dra. Luana - ${new Date().toLocaleDateString('pt-BR')}`,
        content: formattedContent
      });
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-110px)] md:h-[calc(100vh-120px)] w-full bg-white dark:bg-slate-900 rounded-lg md:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
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
      
      {/* SIDEBAR: HISTÓRICO */}
      <aside className={`${isSidebarOpen ? 'w-full md:w-80' : 'w-0'} absolute md:relative z-20 h-full overflow-hidden shrink-0 transition-all duration-300 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <button 
            onClick={() => {
              createNewSession();
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Conversa
          </button>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all"
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
                className={`group p-3 rounded-xl cursor-pointer border transition-all ${currentSessionId === session.id ? 'bg-white dark:bg-slate-800 border-rose-500 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
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
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-rose-500 rounded px-2 py-1 text-sm outline-none"
                    />
                    <button onClick={(e) => saveTitle(session.id, e)} className="text-rose-600 hover:text-rose-700">
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
                        className="p-1 text-slate-400 hover:text-rose-500"
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
      <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-950 min-w-0">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-10 p-2 bg-white dark:bg-slate-800 shadow-md rounded-full border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
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
                  Olá, DOUTOR(A)!<br />
                  <span className="text-rose-600">Bem vindo à Dra. Luana Castro IA</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400">Sua especialista em Direito Trabalhista e Processo do Trabalho.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Análise de Caso</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Resumo de fatos e estratégia para Reclamação Trabalhista.</p>
                  <button 
                    onClick={() => handleSendMessage('Analise este caso trabalhista e sugira a estratégia processual.')}
                    className="mt-4 text-rose-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Briefcase className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Peças Trabalhistas</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Petições Iniciais, Contestação e Recursos (RO, RR).</p>
                  <button 
                    onClick={() => handleSendMessage('GERAR PEÇA: Reclamação Trabalhista com pedido de Horas Extras e Verbas Rescisórias.')}
                    className="mt-4 text-rose-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Search className="w-6 h-6 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">Cálculos e Provas</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Envie cartões de ponto ou contracheques para análise.</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 text-rose-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou gerencie manualmente abaixo</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 px-2 sm:px-4">
              {currentSession.messages.map(msg => (
                <div key={msg.id} className={`group ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                  {msg.role === 'user' ? (
                    // BUBBLE DO USUÁRIO — estilo Claude (cinza claro à direita, compacto)
                    <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tr-md px-5 py-3.5 shadow-sm">
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
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20 ring-2 ring-rose-100 dark:ring-rose-900/40">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Dra. Luana Castro</span>
                          <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded">OAB/RJ 226.749</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                        prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                                        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                        prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                        prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                                        prose-blockquote:border-l-4 prose-blockquote:border-rose-500 prose-blockquote:bg-rose-50/50 dark:prose-blockquote:bg-rose-950/20
                                        prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                        prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300
                                        prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em]
                                        prose-a:text-rose-600 dark:prose-a:text-rose-400 prose-a:no-underline hover:prose-a:underline
                                        prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:font-bold
                                        font-inter">
                          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content || '') }} />
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyToClipboard(msg.content || '', msg.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Copiar"
                          >
                            {copiedId === msg.id ? <Check className="w-4 h-4 text-rose-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>
                          {(
                            /petição|reclamação|excelentíssimo|ao juízo|inicial|contestação|recurso|vossa excelência/i.test(msg.content || '') ||
                            (msg.content || '').length > 1000
                          ) && (
                            <>
                              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                              <button
                                onClick={() => generateDocx(msg.content || '')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
                                title="Baixar Word"
                              >
                                <Download className="w-3.5 h-3.5" /> Word
                              </button>
                              <button
                                onClick={() => handleOpenInEditor(msg.content || '')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
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
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20 ring-2 ring-rose-100 dark:ring-rose-900/40">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Dra. Luana Castro</span>
                      <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded animate-pulse">{progressText}</span>
                    </div>

                    {streamingMessage ? (
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base
                                      prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                      prose-p:leading-[1.7] prose-p:text-slate-700 dark:prose-p:text-slate-300
                                      prose-blockquote:border-l-4 prose-blockquote:border-rose-500 prose-blockquote:bg-rose-50/50 dark:prose-blockquote:bg-rose-950/20
                                      prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                      font-inter">
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(streamingMessage) }} />
                        <span className="w-1.5 h-4 bg-rose-500 inline-block animate-pulse ml-1 align-middle rounded-sm"></span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-rose-500 to-rose-600 h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-rose-600 dark:text-rose-400">{progress}% • Padrão Ouro Felix & Castro</span>
                          <span className="animate-pulse">Redigindo peça...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto relative">

            {/* Badge de Tier de Petição Ativo */}
            {petitionLength !== 'Padrão (Livre)' && (
              <div className={`mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                /Premium/.test(petitionLength)
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${/Premium/.test(petitionLength) ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`}></span>
                {/Premium/.test(petitionLength)
                  ? `Tier Premium ativo · DeepSeek V3.2 (OpenRouter)`
                  : `Tier ${petitionLength.replace(' palavras', 'p').replace(/(\d{4})/, '$1 palavras')} · Gemini 3 Flash`}
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
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2"
                  >
                    <History className="w-3 h-3" /> Retomar Auditoria
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-rose-500 transition-all">
              <textarea 
                id="chat-input-luana"
                rows={1}
                placeholder="Como posso te ajudar, Dra. Luana?"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white resize-none min-h-[44px] max-h-[100px] overflow-y-auto text-sm"
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
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
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                    title="Anexar documentos (PDF, Imagens)"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsClientModalOpen(true)}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all flex items-center gap-1"
                    title="Importar Cliente (GED)"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                  <select
                    value={petitionLength}
                    onChange={(e) => setPetitionLength(e.target.value)}
                    className="bg-transparent text-xs text-slate-500 font-medium focus:outline-none focus:ring-0 truncate w-40"
                    title="Tamanho da Peça (Padrão Ouro Felix & Castro)"
                  >
                    <option value="Padrão (Livre)">Tamanho Livre (Padrão)</option>
                    <option value="Mínima 3000 palavras">Mínima · 3.000 palavras</option>
                    <option value="Média 4000 palavras">Média · 4.000 palavras</option>
                    <option value="Máxima 5000 palavras">Máxima · 5.000 palavras ⭐</option>
                    <option value="Premium 7000 palavras">Premium · 7.000 palavras (API paga)</option>
                  </select>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      if (val.includes('/')) {
                        setSelectedModelProvider('openrouter');
                      } else {
                        setSelectedModelProvider('gemini');
                      }
                    }}
                    className="bg-transparent text-[10px] font-bold text-slate-500 dark:text-slate-400 outline-none cursor-pointer hover:text-rose-600 transition-colors max-w-[150px]"
                  >
                    <optgroup label="Google Gemini · Gratuito (Padrão)">
                      <option value="gemini-3-flash-preview">Gemini 3 Flash Preview · Padrão Ouro ⭐</option>
                    </optgroup>
                    <optgroup label="OpenRouter · API Paga (Premium)">
                      <option value="deepseek/deepseek-v3.2">DeepSeek V3.2 · Recomendado para 7.000 palavras</option>
                      <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</option>
                      <option value="qwen/qwen3-max-thinking">Qwen 3 Max Thinking</option>
                      <option value="qwen/qwen-max">Qwen Max</option>
                      <option value="qwen/qwen3.6-plus">Qwen 3.6 Plus</option>
                      <option value="qwen/qwen-plus">Qwen Plus</option>
                      <option value="qwen/qwen3.5-flash-02-23">Qwen 3.5 Flash</option>
                    </optgroup>
                  </select>
                </div>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:hover:bg-rose-600 text-white p-2.5 rounded-xl shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              Dra. Luana Castro IA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>

      {/* Client Import Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Importar Cliente (GED)</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XMark className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou CPF..." 
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 transition-all"
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
                      className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.cpf} • {client.documents?.length || 0} documentos</p>
                      </div>
                      <Plus className="w-5 h-5 text-rose-600" />
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

export default DraLuanaCastro;
