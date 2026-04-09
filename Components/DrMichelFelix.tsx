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
import { SocialSecurityData } from '../SocialSecurityCalc';
import { initSupabase } from '../supabaseClient';
import { extractTextFromPDF } from '../src/utils/pdfParser';
import { supabaseService } from '../services/supabaseService';
import { safeSetLocalStorage } from '../utils';
import { markdownToHtml } from '../src/utils/markdownToHtml';

interface ChatDocument {
  id: string;
  name: string;
  summary?: string;
  fullText?: string;
  type: string;
  pages?: number;
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
}

interface DrMichelFelixProps {
  initialSessions?: ChatSession[];
  onSaveSessions?: (sessions: ChatSession[]) => void;
  onOpenPetition?: (petition: { title: string; content: string }) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const PHASE_TIMEOUT = 180000; // 3 minutes in milliseconds

const DrMichelFelix: React.FC<DrMichelFelixProps> = ({ initialSessions, onSaveSessions, onOpenPetition }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions || []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedModelProvider, setSelectedModelProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sessionsRef = useRef(sessions);
  const pendingSyncRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSessionsRef = useRef<Record<string, string>>({});

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
        const dbSessions = await supabaseService.getAIConversations('michel');
        let formattedSessions = dbSessions && dbSessions.length > 0 ? dbSessions.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          messages: s.messages,
          documents: s.documents || []
        })) : [];

        // Merge with local storage to prevent data loss on page refresh
        const localSaved = localStorage.getItem('dr_michel_sessions');
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

  // Save to Local Storage immediately
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const currentStr = JSON.stringify(sanitizedSessions);
      const storageKey = 'dr_michel_sessions';
      const localSaved = localStorage.getItem(storageKey);
      
      if (localSaved !== currentStr) {
        if (onSaveSessions) {
          onSaveSessions(sanitizedSessions);
        } else {
          safeSetLocalStorage(storageKey, currentStr);
        }
      }
    } catch (error) {
      console.warn("Failed to save sessions locally:", error);
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
              ai_name: 'michel'
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

  const handleSendMessage = async (overrideInput?: string, images?: string[]) => {
    const messageText = overrideInput || input;
    if ((!messageText.trim() && (!images || images.length === 0)) || isLoading) return;

    if (messageText.toUpperCase().includes("CONTINUAR AUDITORIA") && pendingAudit) {
      resumeAudit();
      setInput('');
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
    const textarea = document.getElementById('chat-input-michel');
    if (textarea) textarea.style.height = 'auto';
    setIsLoading(true);

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
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 300000); // 300 seconds

      // 1. Get embedding for the user's message (include recent history for context)
      let ragContext = '';
      try {
        const currentSession = sessions.find(s => s.id === sessionId);
        const recentHistory = currentSession?.messages.slice(-2) || [];
        const contextText = recentHistory.map(m => m.content).join('\n') + '\n' + messageText;

        const embedResponse = await fetch('/api/rag/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: contextText }),
          signal: abortController.signal
        });
        if (embedResponse.ok) {
          const { embedding } = await embedResponse.json();
          if (embedding && embedding.length > 0) {
            // 2. Query Supabase (lower threshold to 0.5 and increase count to 10 for better recall)
            const results = await supabaseService.searchLegalDocuments(embedding, 0.5, 10);
            if (results && results.length > 0) {
              ragContext = results.map((r: any) => r.content).join('\n\n---\n\n');
            }
          }
        }
      } catch (err) {
        console.warn("RAG search failed, continuing without context:", err);
      }

      // Prepare context from documents
      const session = sessionsRef.current.find(s => s.id === sessionId);
      const docSummaries = session?.documents?.map(doc => {
        const header = `DOCUMENTO: ${doc.name}\n`;
        const summaryPart = doc.summary ? `MAPEAMENTO DA AUDITORIA DETALHADA (CIÊNCIA INTEGRAL DE TODAS AS PÁGINAS):\n${doc.summary}\n\n` : '';
        // Include as much full text as possible within safety limits (increased to 500k)
        const fullTextPart = doc.fullText ? `CONTEÚDO INTEGRAL (OCR/TEXTO):\n${doc.fullText.substring(0, 500000)}` : '';
        return `${header}${summaryPart}${fullTextPart}`;
      }).join('\n\n---\n\n') || '';

      const contextPrompt = docSummaries ? 
        `[CONTEXTO DO PROCESSO INTEGRAL - USE PARA TODAS AS RESPOSTAS]\n${docSummaries}\n\n` : '';

      const response = await fetch('/api/dr-michel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextPrompt + messageText,
          history: session?.messages || [],
          images: images || [],
          ragContext,
          modelProvider: selectedModelProvider,
          model: selectedModel
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text();
        let errorMessage = 'Falha na resposta da IA';
        try {
          const errorData = JSON.parse(errorText);
          if (response.status === 429 || (errorData.error && errorData.error.code === 429)) {
            errorMessage = 'Limite de uso atingido (Quota Exceeded). Por favor, aguarde cerca de 1 minuto antes de tentar novamente. Se o problema persistir, considere usar uma chave de API paga.';
          } else if (response.status === 503 || (errorData.error && errorData.error.code === 503)) {
            errorMessage = 'O serviço de IA está temporariamente sobrecarregado (Erro 503). Por favor, aguarde alguns instantes e tente novamente.';
          } else {
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      if (reader) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                
                let data;
                try {
                  data = JSON.parse(dataStr);
                } catch (e) {
                  continue;
                }
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.heartbeat) {
                  continue;
                }
                
                if (data.text) {
                  fullText += data.text;
                }
              }
            }
          }
        } catch (readError: any) {
          if (readError.name === 'AbortError') {
            console.log('Stream aborted after 300 seconds');
            fullText += '\n\n[Aviso: Tempo limite de 5 minutos atingido. Geração pausada. Digite "continue" para prosseguir.]';
          } else {
            throw readError;
          }
        }
      }

      clearTimeout(timeoutId);

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
    const startTime = Date.now();
    const CHUNK_SIZE = 20;

    try {
      for (let i = startFileIndex; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProgressText(`Lendo ${file.name} (${i + 1}/${fileArray.length})...`);

        if (file.type === 'application/pdf') {
          const result = await extractTextFromPDF(file, (current, total, status) => {
            const fileProgress = Math.round((current / total) * 100);
            setProgress(Math.round(((i + (fileProgress / 100)) / fileArray.length) * 100));
            setProgressText(`Lendo ${file.name}: ${status}`);
          });

          const totalPages = result.totalPages;
          const pages = result.pages;
          
          // OTIMIZAÇÃO: Filtrar APENAS páginas que são comprovadamente de separação e sem conteúdo
          const filteredPages = pages.filter(page => {
            const text = page.text.toUpperCase();
            const isSeparationPage = (text.includes("PÁGINA DE SEPARAÇÃO") || 
                                     text.includes("PAGINA DE SEPARACAO") ||
                                     text.includes("FOLHA DE SEPARAÇÃO")) && 
                                     page.text.trim().length < 80; 
            // Se tiver imagem, NUNCA filtra (pode ser um carimbo ou assinatura importante)
            if (page.image) return true;
            return !isSeparationPage;
          });

          const totalFilteredPages = filteredPages.length;
          let fullFileText = result.text;
          let allSummaries = "";
          
          const initialP = (i === startFileIndex) ? startPageIndex : 0;

          for (let p = initialP; p < totalFilteredPages; p += CHUNK_SIZE) {
            const chunkPages = filteredPages.slice(p, p + CHUNK_SIZE);
            const chunkText = chunkPages.map(page => page.text).join('\n');
            const chunkImages = chunkPages.map(page => page.image).filter(Boolean) as string[];

            // Check global timeout
            if (Date.now() - startTime > PHASE_TIMEOUT) {
              const currentPageNum = chunkPages[0]?.pageNumber || p;
              const timeoutMsg: Message = {
                id: generateId(),
                role: 'assistant',
                content: `⚠️ **Tempo máximo de auditoria (3 min) atingido.**\n\nConcluí a ciência até a página ${currentPageNum} do arquivo **${file.name}**. Para continuar a leitura de onde parei, por favor, envie o comando "CONTINUAR AUDITORIA".`,
                timestamp: new Date().toISOString()
              };
              setSessions(prev => prev.map(s => 
                s.id === activeSessionId ? { ...s, messages: [...s.messages, timeoutMsg] } : s
              ));
              setPendingAudit({ fileIndex: i, pageIndex: p, files: fileArray, activeSessionId });
              setIsUploading(false);
              return;
            }

            setProgressText(`Auditoria: ${file.name} (Páginas ${chunkPages[0].pageNumber} a ${chunkPages[chunkPages.length-1].pageNumber})...`);

            const phasePrompt = `[FASE DE TOMADA DE CIÊNCIA - AUDITORIA DETALHADA]
            ARQUIVO: ${file.name}
            PÁGINAS DO LOTE: ${chunkPages[0].pageNumber} a ${chunkPages[chunkPages.length-1].pageNumber} de ${totalPages}
            
            CONTEÚDO DAS PÁGINAS:
            ${chunkText}
            
            INSTRUÇÃO CRÍTICA: Você deve agir como um auditor jurídico e ANALISTA VISUAL. 
            1. Leia cada página com atenção.
            2. Se houver IMAGENS neste lote, descreva-as detalhadamente (fotos, exames, assinaturas).
            3. Extraia nomes, datas, CIDs, valores e propostas de acordo.
            4. Se encontrar um Laudo Pericial ou Proposta de Acordo, DESTAQUE IMEDIATAMENTE.
            5. Responda com a confirmação de ciência e o mapeamento detalhado por página.`;

            const response = await fetch('/api/dr-michel/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: phasePrompt,
                history: [], 
                images: chunkImages,
                isIngestion: true,
                modelProvider: selectedModelProvider,
                model: selectedModel
              })
            });

            if (response.ok) {
              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              let phaseSummary = '';
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.slice(6));
                        if (data.text) phaseSummary += data.text;
                      } catch (e) {}
                    }
                  }
                }
              }
              allSummaries += `\n\n--- PÁGINAS ${p + 1}-${Math.min(p + CHUNK_SIZE, totalPages)} ---\n${phaseSummary}`;
            }
          }

          const newDoc: ChatDocument = {
            id: generateId(),
            name: file.name,
            summary: allSummaries,
            fullText: fullFileText,
            type: file.type,
            pages: totalPages
          };

          setSessions(prev => prev.map(s => 
            s.id === activeSessionId ? { 
              ...s, 
              documents: [...(s.documents || []), newDoc],
              messages: [...s.messages, {
                id: generateId(),
                role: 'assistant',
                content: `✅ **Ciência Integral Tomada: ${file.name}**\n\n${allSummaries}`,
                timestamp: new Date().toISOString(),
                isSystem: true
              }]
            } : s
          ));
        } else {
          const reader = new FileReader();
          const fileText = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string || "");
            reader.readAsText(file);
          });

          const newDoc: ChatDocument = {
            id: generateId(),
            name: file.name,
            summary: `Arquivo de texto processado: ${file.name}`,
            fullText: fileText,
            type: file.type
          };

          setSessions(prev => prev.map(s => 
            s.id === activeSessionId ? { 
              ...s, 
              documents: [...(s.documents || []), newDoc],
              messages: [...s.messages, {
                id: generateId(),
                role: 'assistant',
                content: `✅ **Arquivo Processado: ${file.name}**`,
                timestamp: new Date().toISOString(),
                isSystem: true
              }]
            } : s
          ));
        }
      }

      setProgress(100);
      setProgressText('Concluído!');
      
      // Only send final message if no audit is pending (it didn't return early)
      const finalMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Tomei ciência integral de todos os arquivos enviados. O processo foi mapeado e estou pronto para gerar o recurso ou relatório com base em todas as informações consolidadas. O que deseja fazer agora?`,
        timestamp: new Date().toISOString()
      };
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, finalMsg] } : s
      ));

    } catch (error: any) {
      console.error("Erro ao processar arquivos:", error);
      alert(`Erro ao ler os arquivos: ${error.message}`);
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
        content: `Estou iniciando a **Auditoria Detalhada** de ${fileArray.length} arquivo(s). Vou processar o processo em lotes de 20 páginas para garantir máxima precisão e ciência integral de cada folha, respeitando o tempo de qualidade solicitado. Por favor, aguarde...`,
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
        content: `Importando dossiê do cliente **${fullClient.name}**. Vou realizar a **Auditoria Detalhada** de todos os documentos do GED por fases em lotes de 20 páginas, garantindo ciência integral de cada folha. Por favor, aguarde...`,
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

  const generateDocx = async (content: string) => {
    try {
      const response = await fetch('/api/dr-michel/generate-docx', {
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
        title: `Petição Dr. Michel - ${new Date().toLocaleDateString('pt-BR')}`,
        content: formattedContent
      });
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
      
      {/* SIDEBAR: HISTÓRICO */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <button 
            onClick={createNewSession}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Conversa
          </button>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar conversas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            {filteredSessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`group p-3 rounded-xl cursor-pointer border transition-all ${currentSessionId === session.id ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
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
                      className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm outline-none"
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
      <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-950">
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
                  Olá, MICHEL!<br />
                  <span className="text-emerald-600">Bem vindo ao Dr. Michel Felix IA</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400">Seu assistente jurídico de elite para Direito Previdenciário.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-blue-600" />
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

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
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

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
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
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ou gerencie manualmente abaixo</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {currentSession.messages.map(msg => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'assistant' ? 'bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'assistant' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    {msg.role === 'assistant' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {msg.role === 'assistant' ? 'Dr. Michel Felix' : 'Você'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed">
                      {msg.role === 'assistant' ? (
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content || '') }} />
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {(msg.content || '').length > 3000 
                            ? (msg.content || '').substring(0, 800) + '\n\n[... Conteúdo longo ocultado na tela para evitar travamentos. A IA leu o texto completo ...]' 
                            : (msg.content || '')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => copyToClipboard(msg.content || '', msg.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Copiar texto"
                        >
                          {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </button>
                      )}
                      {msg.role === 'assistant' && (
                        /petição|reclamação|excelentíssimo|ao juízo|inicial|contestação|recurso|vossa excelência/i.test(msg.content || '') || 
                        (msg.content || '').length > 1000
                      ) && (
                        <div className="flex flex-wrap gap-2 ml-2">
                          <button 
                            onClick={() => generateDocx(msg.content || '')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar Word
                          </button>
                          <button 
                            onClick={() => handleOpenInEditor(msg.content || '')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Abrir no Editor
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Dr. Michel Felix</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest animate-pulse">{progressText}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 mb-1 overflow-hidden">
                      <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{progress}% concluído</span>
                      <span className="animate-pulse">Gerando resposta...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto relative">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <textarea 
                id="chat-input-michel"
                rows={1}
                placeholder="Como posso te ajudar, Dr. Michel?"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                className="w-full p-4 bg-transparent outline-none text-slate-800 dark:text-white resize-none min-h-[56px] max-h-40 overflow-y-auto"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
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
                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                    title="Anexar documentos (CNIS, PPP, etc.)"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsClientModalOpen(true)}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all flex items-center gap-1"
                    title="Importar Cliente (GED)"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                  <select
                    value={selectedModelProvider === 'gemini' ? selectedModel : selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('gemini-')) {
                        setSelectedModelProvider('gemini');
                        setSelectedModel(val);
                      } else {
                        setSelectedModelProvider('openrouter');
                        setSelectedModel(val);
                      }
                    }}
                    className="bg-transparent text-[10px] font-bold text-slate-500 dark:text-slate-400 outline-none cursor-pointer hover:text-emerald-600 transition-colors max-w-[150px]"
                  >
                    <optgroup label="Google Gemini (Recomendado)">
                      <option value="gemini-3-flash-preview">Gemini 3.1 Flash (1 Milhão de Tokens - Ultra Rápido)</option>
                      <option value="gemini-3-pro-preview">Gemini 3.1 Pro (2 Milhões de Tokens - Alta Complexidade)</option>
                    </optgroup>
                    <optgroup label="OpenRouter (Modelos Alternativos)">
                      <option value="qwen-plus">Qwen 3.6 Plus Preview (1M Tokens - Gratuito)</option>
                      <option value="llama-3-3-70b-free">Llama 3.3 70B (128k Tokens - Gratuito)</option>
                      <option value="deepseek-chat-free">DeepSeek V3 (64k Tokens - Gratuito)</option>
                      <option value="openrouter-free">Auto-Router (Modelos Gratuitos Aleatórios)</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (200k Tokens - Qualidade Superior)</option>
                      <option value="gemini-pro-1.5">Gemini 1.5 Pro via OR (2M Tokens - Contexto Infinito)</option>
                    </optgroup>
                  </select>
                </div>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              Dr. Michel Felix IA pode cometer erros. Verifique informações importantes.
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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
                      className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex justify-between items-center"
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

export default DrMichelFelix;
