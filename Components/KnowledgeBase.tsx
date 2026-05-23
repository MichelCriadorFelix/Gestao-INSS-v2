import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { apiFetch } from '../services/apiService';
import { CheckCircle2, Plus, Trash2, BookOpen, Loader2, AlertTriangle, Info, FileText, Gavel, Scale, BookMarked, Landmark, ClipboardList, Wrench, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================
// PADRÃO OURO — NOMENCLATURA DA BASE DE CONHECIMENTO
// Felix & Castro Advocacia
// ============================================================
//
// LEIS FEDERAIS:       Nome Descritivo (Lei nº X/AAAA)
//   Ex: Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)
//   Ex: Código de Defesa do Consumidor - CDC (Lei nº 8.078/1990)
//
// LEIS COMPLEMENTARES: Nome Descritivo (LC nº X/AAAA)
//   Ex: Lei do Trabalho Doméstico (LC nº 150/2015)
//
// DECRETOS:            Nome Descritivo (Decreto nº X/AAAA)
//   Ex: Regulamento da Previdência Social (Decreto nº 3.048/1999)
//
// EMENDAS CONST.:      Nome Descritivo (EC nº X/AAAA)
//   Ex: Reforma da Previdência (EC nº 103/2019)
//
// INST. NORMATIVAS:    INSTRUÇÃO NORMATIVA ÓRGÃO Nº X, DE DATA
//   Ex: INSTRUÇÃO NORMATIVA PRES/INSS Nº 128, DE 28 DE MARÇO DE 2022
//
// SÚMULAS:             SÚMULA X TRIBUNAL — ÁREA — Descrição curta
//   Ex: SÚMULA 47 TNU — PREVIDENCIÁRIO — Incapacidade parcial e condições pessoais
//
// TEMAS:               TEMA X.XXX TRIBUNAL — ÁREA — Descrição curta
//   Ex: TEMA 905 STJ — PREVIDENCIÁRIO — Correção monetária IPCA-E e juros Selic
//
// JURISPRUDÊNCIAS:     JURISPRUDÊNCIA TRIBUNAL — ÁREA — Descrição curta
//   Ex: JURISPRUDÊNCIA TRF — PREVIDENCIÁRIO — Aposentadoria especial copeiro hospitalar
//   Ex: JURISPRUDÊNCIA STF — PREVIDENCIÁRIO — RE 580963 — BPC e exclusão de benefício
//
// ORIENT. JURISP.:     ORIENTAÇÃO JURISPRUDENCIAL X SEÇÃO TST — ÁREA — Descrição
//   Ex: ORIENTAÇÃO JURISPRUDENCIAL 42 SDI-1 TST — TRABALHISTA — Licença-prêmio
//
// QUADROS ANEXOS:      QUADRO ANEXO — Descrição (Decreto/Lei nº X/AAAA)
//   Ex: QUADRO ANEXO — Atividades Profissionais e Agentes Nocivos (Decreto nº 53.831/1964)
//
// REGRAS GERAIS:
//   - Títulos devem ser únicos e descritivos — sem ementas completas
//   - Máximo de ~100 caracteres no título
//   - Use travessão (—) nos separadores de súmulas/temas/juris, não hífen (-)
//   - Área em maiúsculas: PREVIDENCIÁRIO | TRABALHISTA | CONSUMERISTA | CÍVEL | PROCESSUAL
// ============================================================

const NAMING_GUIDE = [
  {
    icon: '📋',
    tipo: 'Leis Federais / Complementares',
    padrao: 'Nome Descritivo (Lei nº X/AAAA)',
    exemplos: [
      'Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)',
      'Código de Defesa do Consumidor - CDC (Lei nº 8.078/1990)',
      'Lei do Trabalho Doméstico (LC nº 150/2015)',
    ]
  },
  {
    icon: '📜',
    tipo: 'Decretos',
    padrao: 'Nome Descritivo (Decreto nº X/AAAA)',
    exemplos: [
      'Regulamento da Previdência Social (Decreto nº 3.048/1999)',
      'Regulamento do BPC/LOAS (Decreto nº 6.214/2007)',
    ]
  },
  {
    icon: '🏛️',
    tipo: 'Emendas Constitucionais',
    padrao: 'Nome Descritivo (EC nº X/AAAA)',
    exemplos: [
      'Reforma da Previdência (EC nº 103/2019)',
      'Reforma da Previdência dos Servidores Públicos (EC nº 41/2003)',
    ]
  },
  {
    icon: '📑',
    tipo: 'Instruções Normativas',
    padrao: 'INSTRUÇÃO NORMATIVA ÓRGÃO Nº X, DE DATA POR EXTENSO',
    exemplos: [
      'INSTRUÇÃO NORMATIVA PRES/INSS Nº 128, DE 28 DE MARÇO DE 2022',
    ]
  },
  {
    icon: '⚖️',
    tipo: 'Súmulas',
    padrao: 'SÚMULA X TRIBUNAL — ÁREA — Descrição curta',
    exemplos: [
      'SÚMULA 47 TNU — PREVIDENCIÁRIO — Incapacidade parcial e condições pessoais',
      'SÚMULA 479 STJ — CONSUMERISTA — Responsabilidade objetiva por fraudes bancárias',
      'SÚMULA 192 TJRJ — CONSUMERISTA — Dano moral por interrupção de serviços essenciais',
    ]
  },
  {
    icon: '🎯',
    tipo: 'Temas (STJ/STF/TNU)',
    padrao: 'TEMA X.XXX TRIBUNAL — ÁREA — Descrição curta',
    exemplos: [
      'TEMA 905 STJ — PREVIDENCIÁRIO — Correção monetária IPCA-E e juros Selic',
      'TEMA 640 STJ — PREVIDENCIÁRIO — BPC e exclusão de benefício de idoso',
      'TEMA 286 TNU — PREVIDENCIÁRIO — Pensão por morte e segurado facultativo',
    ]
  },
  {
    icon: '📰',
    tipo: 'Jurisprudências',
    padrao: 'JURISPRUDÊNCIA TRIBUNAL — ÁREA — Descrição curta',
    exemplos: [
      'JURISPRUDÊNCIA TRF — PREVIDENCIÁRIO — Aposentadoria especial copeiro hospitalar',
      'JURISPRUDÊNCIA STF — PREVIDENCIÁRIO — RE 580963 — BPC e exclusão de benefício',
      'JURISPRUDÊNCIA — CONSUMERISTA — Responsabilidade bancária por fraudes',
    ]
  },
  {
    icon: '📊',
    tipo: 'Quadros Anexos',
    padrao: 'QUADRO ANEXO — Descrição (Decreto/Lei nº X/AAAA)',
    exemplos: [
      'QUADRO ANEXO — Atividades Profissionais e Agentes Nocivos (Decreto nº 53.831/1964)',
    ]
  },
  {
    icon: '🔍',
    tipo: 'Orientações Jurisprudenciais (TST)',
    padrao: 'ORIENTAÇÃO JURISPRUDENCIAL X SEÇÃO TST — ÁREA — Descrição',
    exemplos: [
      'ORIENTAÇÃO JURISPRUDENCIAL 42 SDI-1 TST — TRABALHISTA — Licença-prêmio convertida em pecúnia',
    ]
  },
];

// Detecta o tipo de documento pelo padrão do título
function detectTipoDoc(titulo: string): string {
  const t = titulo.trim();
  if (/^SÚMULA\s+\d+/i.test(t)) return 'súmula';
  if (/^TEMA\s+[\d.]+/i.test(t)) return 'tema';
  if (/^JURISPRUDÊNCIA/i.test(t)) return 'jurisprudência';
  if (/^INSTRUÇÃO NORMATIVA/i.test(t)) return 'instrução normativa';
  if (/^ORIENTAÇÃO JURISPRUDENCIAL/i.test(t)) return 'orientação jurisprudencial';
  if (/^QUADRO ANEXO/i.test(t)) return 'quadro anexo';
  if (/\(EC\s+nº/i.test(t)) return 'emenda constitucional';
  if (/\(LC\s+nº/i.test(t)) return 'lei complementar';
  if (/\(Decreto(?:-Lei)?\s+nº/i.test(t)) return 'decreto';
  if (/\(Lei\s+nº/i.test(t)) return 'lei';
  if (/CONSTITUIÇÃO/i.test(t)) return 'constituição';
  return '';
}

// Valida o título contra o padrão ouro e retorna avisos
function validateTitle(titulo: string): string[] {
  const warnings: string[] = [];
  const t = titulo.trim();
  if (!t) return warnings;

  if (t.length > 120) warnings.push('Título muito longo (máx. 120 caracteres). Remova a ementa — use só o nome descritivo.');
  if (t.includes(' - ') && !t.includes('—') && (t.startsWith('SÚMULA') || t.startsWith('TEMA') || t.startsWith('JURISPRUDÊNCIA')))
    warnings.push('Use travessão (—) como separador em súmulas/temas/jurisprudências, não hífen ( - ).');
  if (/^LEI\s+Nº\s+[\d.]+,\s+DE/i.test(t))
    warnings.push('Título no formato de ementa. Use: "Nome Descritivo (Lei nº X/AAAA)" — ex: "Lei de Benefícios (Lei nº 8.213/1991)".');
  if (/^DECRETO\s+Nº/i.test(t) && !/\(Decreto/i.test(t))
    warnings.push('Título no formato de ementa. Use: "Nome Descritivo (Decreto nº X/AAAA)".');
  if (/^EMENDA CONSTITUCIONAL\s+Nº/i.test(t))
    warnings.push('Título no formato de ementa. Use: "Nome Descritivo (EC nº X/AAAA)" — ex: "Reforma da Previdência (EC nº 103/2019)".');
  if (t.includes('ETO') && t.includes('QUADRO'))
    warnings.push('Possível typo detectado no título.');
  if (/^OJ\s+\d+/i.test(t))
    warnings.push('Prefira "ORIENTAÇÃO JURISPRUDENCIAL X ..." em vez da sigla "OJ".');

  return warnings;
};

// ============================================================
// CHUNKING PADRÃO OURO com overlap e sub-split de artigos gigantes
// ============================================================
function chunkLegalText(text: string, maxChars = 2500, overlapChars = 200): string[] {
  const chunks: string[] = [];

  // Sub-divisor semântico para trechos densos sem artigos ou sem quebra de parágrafo duplo
  const subSplit = (txt: string): string[] => {
    const subs: string[] = [];
    const parParts = txt.split(/\n\n+/);
    const splitParts: string[] = [];

    // Se um parágrafo individual for muito longo (> maxChars), quebra por linha simples (\n)
    for (const par of parParts) {
      if (par.length > maxChars) {
        const lines = par.split(/\n+/);
        for (const line of lines) {
          if (line.length > maxChars) {
            // Se a linha ainda for muito longa, quebra por sentenças (. )
            const sentences = line.split(/(?<=\.\s+)/);
            for (const sent of sentences) {
              if (sent.length > maxChars) {
                // Se ainda for muito longa (ex: PDF sem formatação), fatia de forma rígida pelo limite
                let remaining = sent;
                while (remaining.length > 0) {
                  if (remaining.length <= maxChars) {
                    splitParts.push(remaining);
                    break;
                  }
                  let slicePoint = maxChars;
                  const lastSpace = remaining.lastIndexOf(' ', maxChars);
                  if (lastSpace > maxChars * 0.7) {
                    slicePoint = lastSpace;
                  }
                  splitParts.push(remaining.substring(0, slicePoint).trim());
                  remaining = remaining.substring(slicePoint).trim();
                }
              } else {
                splitParts.push(sent);
              }
            }
          } else {
            splitParts.push(line);
          }
        }
      } else {
        splitParts.push(par);
      }
    }

    // Agora agrupa os fragmentos de forma equilibrada respeitando o maxChars e inserindo overlap
    let cur = '';
    for (const part of splitParts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      if ((cur + '\n\n' + trimmedPart).length > maxChars && cur.length > 0) {
        subs.push(cur.trim());
        // Overlap: utiliza as últimas 2 linhas do bloco anterior para contexto
        const lines = cur.split('\n');
        const overlap = lines.slice(-2).join('\n');
        cur = (overlap.length > 5 ? overlap + '\n\n' : '') + trimmedPart;
      } else {
        cur = cur ? cur + '\n\n' + trimmedPart : trimmedPart;
      }
    }

    if (cur.trim().length > 80) {
      subs.push(cur.trim());
    }
    return subs;
  };

  // Passo 1: dividir primeiramente por artigo (Art. X / Artigo X)
  const rawParts = text.split(/(?=\n\s*(?:Art\.|Artigo)\s+\d)/i);

  let currentChunk = '';

  const flushChunk = (chunk: string) => {
    const trimmed = chunk.trim();
    if (trimmed.length < 80) return; // ignora micro-resíduos
    // Se o chunk é grande, sub-divide de forma inteligente usando subSplit
    if (trimmed.length > maxChars) {
      subSplit(trimmed).forEach(sub => chunks.push(sub));
    } else {
      chunks.push(trimmed);
    }
  };

  for (const part of rawParts) {
    const p = part.trim();
    if (!p) continue;

    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      flushChunk(currentChunk);
      // Overlap: repete os últimos overlapChars do chunk anterior
      const overlap = currentChunk.length > overlapChars
        ? currentChunk.slice(-overlapChars)
        : currentChunk;
      currentChunk = overlap + '\n\n' + p;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
    }
  }

  if (currentChunk.trim().length > 80) flushChunk(currentChunk);
  return chunks;
}

export default function KnowledgeBase() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // Manutenção — rechunking
  const [showAdmin, setShowAdmin] = useState(false);
  const [phase, setPhase] = useState<'idle'|'splitting'|'embedding'|'done'>('idle');
  const [status, setStatus] = useState<any>(null); // { large_docs, pending_embeddings, next_doc }
  const [progress, setProgress] = useState({ done: 0, total: 0, titulo: '' });
  const [log, setLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const edgeCall = async (body: any, timeoutMs = 20000): Promise<any> => {
    try {
      if (body.action === 'status') {
        const pending_embeddings = await supabaseService.countChunksNeedingEmbedding();
        const large_docs = await supabaseService.countLargeDocuments(8000);
        let next_doc = null;
        if (large_docs > 0) {
          const docs = await supabaseService.getLargeDocuments(8000, 1);
          if (docs && docs.length > 0) {
            next_doc = {
              titulo: docs[0].metadata?.title || 'Sem título',
              chars: docs[0].content?.length || 0,
              id: docs[0].id
            };
          }
        }
        return {
          pending_embeddings,
          large_docs,
          next_doc
        };
      }
      
      if (body.action === 'split' || body.action === 'split_js') {
        const largeDocs = await supabaseService.getLargeDocuments(8000, 1);
        if (!largeDocs || largeDocs.length === 0) {
          return { done: true, chunks_created: 0, pending_embeddings: 0, large_docs_remaining: 0, titulo: '' };
        }
        
        const largeDoc = largeDocs[0];
        const content = largeDoc.content || '';
        const title = largeDoc.metadata?.title || 'Sem título';
        
        // Chunk direct in browser
        const chunkList = chunkLegalText(content, 2500, 200);
        if (chunkList.length === 0) {
          return { error: 'invalid_split_content', message: 'Nenhum trecho de texto gerado ao subdividir.' };
        }
        
        const chunkEntries = chunkList.map((chunkText, idx) => ({
          content: chunkText,
          metadata: {
            ...largeDoc.metadata,
            title: title,
            tipo: largeDoc.metadata?.tipo || 'outro',
            sourceUrl: largeDoc.metadata?.sourceUrl || null,
            dateAdded: largeDoc.metadata?.dateAdded || new Date().toISOString(),
            chunkIndex: idx,
            totalChunks: chunkList.length,
            chunk_index: idx,
            total_chunks: chunkList.length,
          },
          embedding: null
        }));
        
        // Delete original document
        await supabaseService.deleteLegalDocumentById(largeDoc.id);
        
        // Save smaller chunks
        await supabaseService.saveLegalDocuments(chunkEntries as any);
        
        const pending = await supabaseService.countChunksNeedingEmbedding();
        const remaining = await supabaseService.countLargeDocuments(8000);
        
        return {
          done: false,
          titulo: title,
          chars: content.length,
          chunks_created: chunkList.length,
          large_docs_remaining: remaining,
          pending_embeddings: pending
        };
      }

      if (body.action === 'get_next_chunk') {
        const nextChunk = await supabaseService.getOneChunkNeedingEmbedding();
        if (!nextChunk) {
          return { error: 'sem_chunk' };
        }
        return nextChunk;
      }

      if (body.action === 'save_embedding') {
        await supabaseService.updateEmbedding(body.chunkId, body.embedding);
        return { success: true };
      }

      return { error: 'invalid_action' };
    } catch (e: any) {
      console.error('Local edgeCall error:', e);
      return { error: e.message || 'Erro de rede ou banco' };
    }
  };

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-30), msg]);

  const fetchStatus = async () => {
    const data = await edgeCall({ action: 'status' }).catch(() => null);
    if (data && !data.error) setStatus(data);
    return data;
  };

  // FASE 1: Split do próximo documento (SQL via Edge Function)
  const handleSplit = async () => {
    setIsRunning(true);
    setPhase('splitting');
    addLog('Dividindo documento...');
    try {
      // Tentar split via SQL primeiro
      let data = await edgeCall({ action: 'split' });

      // Se SQL deu timeout, usar split_js (Edge Function faz o split em JS)
      if (data.error === 'timeout_sql' || (data.error && data.error.includes('timeout'))) {
        addLog('SQL lento — usando split alternativo...');
        data = await edgeCall({ action: 'split_js', docId: data.target_id });
      }

      if (data.error) { addLog('Erro: ' + data.error); setPhase('idle'); setIsRunning(false); return; }
      if (data.done) { addLog('Nenhum documento grande encontrado.'); setPhase('done'); setIsRunning(false); return; }

      const titulo = String(data.titulo || '').substring(0, 45);
      const chunks = data.chunks_created || data.pending_embeddings || 0;
      addLog(`Dividido: "${titulo}" -> ${chunks} trechos`);
      addLog(`Docs restantes: ${data.large_docs_remaining} | Pendentes: ${data.pending_embeddings}`);
      setProgress({ done: 0, total: data.pending_embeddings || 0, titulo: data.titulo || '' });
      await fetchStatus();
      handleEmbedLoop(data.pending_embeddings || 0);
    } catch (e: any) { addLog('Erro: ' + e.message); setPhase('idle'); setIsRunning(false); }
  };

  // FASE 2: Gerar embeddings para os chunks pendentes (1 por vez via /api/rag/embed)
  const handleEmbedLoop = async (total: number) => {
    setPhase('embedding');
    let done = 0;
    let consecutiveErrors = 0;

    while (true) {
      // Verificar pendentes (a cada 5 loops para não sobrecarregar)
      if (done % 5 === 0) {
        const st = await edgeCall({ action: 'status' }, 10000).catch(() => null);
        if (st && st.pending_embeddings === 0) { addLog('Todos os embeddings concluídos!'); break; }
      }

      // Buscar 1 chunk pendente de embedding via Edge Function
      let chunk: any = null;
      try {
        const chunkData = await edgeCall({ action: 'get_next_chunk' }, 15000);
        if (chunkData.error === 'sem_chunk' || (!chunkData.id && !chunkData.error)) {
          addLog('Todos os embeddings concluídos!');
          break;
        }
        if (chunkData.error) {
          consecutiveErrors++;
          addLog(`  Falha ${consecutiveErrors}/3: ${chunkData.message || chunkData.error}`);
          if (consecutiveErrors >= 3) { addLog('❌ 3 falhas. Recarregue e tente novamente.'); break; }
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        chunk = chunkData;
        consecutiveErrors = 0;
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors > 3) break;
        continue;
      }
      consecutiveErrors = 0;
      // Gerar embedding via API existente
      try {
        const embedCtrl = new AbortController();
        const embedTimer = setTimeout(() => embedCtrl.abort(), 30000);
        let resp: Response;
        try {
          resp = await apiFetch('/api/rag/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunk.content }),
            signal: embedCtrl.signal
          });
          clearTimeout(embedTimer);
        } catch (fetchErr: any) {
          clearTimeout(embedTimer);
          consecutiveErrors++;
          addLog(`  Embed timeout/erro: ${fetchErr.message}`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        if (!resp.ok) { consecutiveErrors++; await new Promise(r => setTimeout(r, 1000)); continue; }
        const { embedding } = await resp.json();
        if (!embedding?.length) { consecutiveErrors++; continue; }

        // Salvar via Edge Function (usa service role key)
        await edgeCall({ action: 'save_embedding', chunkId: chunk.id, embedding });
        done++;
        // Delay para não sobrecarregar o WAL do Supabase com inserts muito rápidos
        await new Promise(r => setTimeout(r, 1500));
        setProgress(p => ({ ...p, done, total: total }));
        // Atualizar a última linha de progresso
        setLog(prev => {
          const clean = prev.filter(l => !l.startsWith('  Embedding'));
          return [...clean, `  Embedding ${done}/${total}...`];
        });
      } catch { consecutiveErrors++; await new Promise(r => setTimeout(r, 500)); }
    }

    const nextStatus = await fetchStatus();
    if (nextStatus && nextStatus.large_docs > 0) {
      addLog(`✨ Bloco concluído! Há mais ${nextStatus.large_docs} documento(s) grande(s). Iniciando próximo automaticamente em 1s...`);
      await new Promise(r => setTimeout(r, 1000));
      handleSplit();
    } else {
      setPhase('idle');
      setIsRunning(false);
      addLog(`🎉 Sucesso! Base de conhecimento totalmente otimizada (0 documentos grandes, 0 embeddings pendentes).`);
    }
  };

  const handleRechunk = async () => {
    if (isRunning) return;
    const s = await fetchStatus();
    if (!s) { addLog('Erro ao verificar status.'); return; }

    // Se há chunks pendentes de embedding, continuar de onde parou
    if (s.pending_embeddings > 0) {
      if (!confirm(`Continuar gerando embeddings? (${s.pending_embeddings} pendentes)`)) return;
      setIsRunning(true);
      handleEmbedLoop(s.pending_embeddings);
      return;
    }

    // Se há docs grandes, iniciar split do próximo de forma contínua
    if (s.large_docs > 0) {
      const titulo = s.next_doc?.titulo || '';
      const chars = (s.next_doc?.chars || 0).toLocaleString();
      if (!confirm(`Iniciar otimização contínua automática de todos os ${s.large_docs} documentos?\n\nPróximo documento: "${titulo}" (${chars} chars).`)) return;
      handleSplit();
      return;
    }

    alert('Base jurídica já está totalmente otimizada!');
    setPhase('done');
  }

  // Validação em tempo real do título
  const titleWarnings = useMemo(() => validateTitle(title), [title]);
  const tipoDetectado = useMemo(() => detectTipoDoc(title), [title]);

  useEffect(() => { fetchDocs(); }, []);

  const fetchDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await supabaseService.getLegalDocumentTitles();
      setExistingDocs(docs);
    } catch (error) {
      console.error('Error fetching docs:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const filteredDocs = existingDocs.filter(doc =>
    doc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (docTitle: string) => {
    if (!confirm(`Excluir "${docTitle}" da base de conhecimento?`)) return;
    try {
      await supabaseService.deleteLegalDocumentByTitle(docTitle);
      setExistingDocs(prev => prev.filter(t => t !== docTitle));
    } catch (error) {
      alert('Erro ao excluir documento.');
    }
  };

  const handleSelectExample = (titulo: string) => {
    setTitle(titulo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowGuide(false);
  };

  const handleProcess = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage({ text: 'Título e conteúdo são obrigatórios.', type: 'error' });
      return;
    }
    if (titleWarnings.length > 0) {
      if (!confirm('O título tem avisos de padronização. Deseja continuar mesmo assim?')) return;
    }

    setIsProcessing(true);
    setMessage({ text: 'Verificando base...', type: 'info' });
    setUploadProgress({ current: 0, total: 0 });

    try {
      await supabaseService.deleteLegalDocumentByTitle(title.trim());

      // Chunking padrão ouro com overlap
      const chunks = chunkLegalText(content, 2500, 200);
      if (chunks.length === 0) throw new Error('Nenhum trecho de texto gerado. Verifique o conteúdo.');

      setUploadProgress({ current: 0, total: chunks.length });
      setMessage({ text: `Gerando embeddings para ${chunks.length} trechos...`, type: 'info' });

      let processedChunks: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setUploadProgress({ current: i + 1, total: chunks.length });

        const response = await apiFetch('/api/rag/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Falha no trecho ${i + 1}`);
        }

        const { embedding } = await response.json();

        processedChunks.push({
          content: chunk,
          metadata: {
            title: title.trim(),
            tipo: tipoDetectado,
            sourceUrl: sourceUrl.trim() || null,
            dateAdded: new Date().toISOString(),
            chunkIndex: i,
            totalChunks: chunks.length,
          },
          embedding
        });

        // Salva em lotes de 10
        if (processedChunks.length >= 10 || i === chunks.length - 1) {
          setMessage({ text: `Salvando... (${i + 1}/${chunks.length} trechos)`, type: 'info' });
          await supabaseService.saveLegalDocuments(processedChunks);
          processedChunks = [];
        }
      }

      setMessage({ text: `✅ Salvo com sucesso! ${chunks.length} trechos indexados.`, type: 'success' });
      setIsSuccess(true);
      fetchDocs();
    } catch (error: any) {
      setMessage({ text: error.message || 'Erro ao processar documento.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Tela de sucesso ──────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="bg-white dark:bg-bordeaux-950/60 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/20 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Documento Indexado!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          A IA já pode usar este documento nas petições e respostas jurídicas.
        </p>
        <button
          onClick={() => { setIsSuccess(false); setTitle(''); setContent(''); setSourceUrl(''); setMessage({ text: '', type: '' }); }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={20} /> Adicionar Mais
        </button>
      </div>
    );
  }

  // ── Interface principal ──────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Header Row with Maintenance Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-bordeaux-950/60 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-gold-500/20 gap-3">
        <div>
          <h1 className="text-lg font-serif font-semibold text-slate-800 dark:text-cream-55">
            Gestão da Base de Conhecimento
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gerenciamento, indexação de documentos jurídicos e otimização de trechos (Rechunking).
          </p>
        </div>
        <button
          onClick={() => {
            const nextVal = !showAdmin;
            setShowAdmin(nextVal);
            if (nextVal) {
              fetchStatus();
            }
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
            showAdmin
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400'
              : 'bg-slate-50 hover:bg-slate-100 dark:bg-bordeaux-900/40 dark:hover:bg-bordeaux-900/60 border-slate-200 dark:border-gold-500/15 text-slate-700 dark:text-gold-400'
          }`}
        >
          <Wrench size={14} />
          {showAdmin ? 'Fechar Painel Otimizador' : 'Otimizar Chunks da Base (Admin)'}
        </button>
      </div>

      {/* Painel de manutenção — Otimizar Chunks */}
      {showAdmin && (
        <div className="bg-white dark:bg-bordeaux-950/60 border border-slate-200 dark:border-gold-500/20 rounded-xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gold-500/10 pb-3">
            <Wrench className="text-indigo-500 animate-pulse" size={18} />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 font-serif">
              Otimizador de Chunks (Padrão Ouro — 2.500 chars com overlap)
            </h2>
          </div>

          {/* Grid de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-bordeaux-900/30 border border-slate-100 dark:border-gold-500/10 rounded-lg p-3">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Documentos Grandes (&gt;8k chars)
              </span>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">
                {status?.large_docs !== undefined ? status.large_docs : '—'}
              </span>
            </div>
            
            <div className="bg-slate-50 dark:bg-bordeaux-900/30 border border-slate-100 dark:border-gold-500/10 rounded-lg p-3">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Trechos sem Embedding
              </span>
              <span className="text-xl font-bold text-red-600 dark:text-red-400 font-mono">
                {status?.pending_embeddings !== undefined ? status.pending_embeddings : '—'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-bordeaux-900/30 border border-slate-100 dark:border-gold-500/10 rounded-lg p-3">
              <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Estado do Otimizador
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200/40">
                {isRunning ? 'Ativo...' : 'Inativo'}
              </span>
            </div>
          </div>

          {/* Próximo Documento */}
          {status?.next_doc && (
            <div className="bg-slate-50 dark:bg-bordeaux-900/20 border border-slate-100 dark:border-gold-500/10 rounded-lg p-4 space-y-1">
              <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                Próximo a processar (O maior documento)
              </span>
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate" title={status.next_doc.titulo}>
                  📋 {status.next_doc.titulo}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono shrink-0">
                  {status.next_doc.chars.toLocaleString()} chars
                </span>
              </div>
            </div>
          )}

          {/* Progresso de Execução */}
          {phase !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>FASE: {
                  phase === 'splitting' ? '✂️ Dividindo documento...' :
                  phase === 'embedding' ? '⚙️ Gerando embeddings...' :
                  'Pronto'
                }</span>
                {phase === 'embedding' && progress.total > 0 && (
                  <span>{progress.done} de {progress.total} chunks ({Math.round((progress.done / progress.total) * 100)}%)</span>
                )}
              </div>
              {phase === 'embedding' && progress.total > 0 && (
                <div className="h-1.5 bg-slate-100 dark:bg-bordeaux-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Console de Logs */}
          {log.length > 0 && (
            <div className="space-y-1">
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Logs de Processamento
              </span>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1 leading-relaxed shadow-inner">
                {log.map((line, idx) => (
                  <div key={idx} className={
                    line.includes('❌') || line.includes('Erro') ? 'text-red-400 font-semibold' :
                    line.includes('⚠️') ? 'text-amber-400 font-semibold' :
                    line.includes('✅') || line.includes('🎉') ? 'text-emerald-400 font-semibold' :
                    'text-slate-300'
                  }>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={async () => {
                if (isRunning) return;
                setIsRunning(true);
                addLog('Iniciando atualização de status...');
                await fetchStatus();
                setIsRunning(false);
              }}
              disabled={isRunning}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-all ${
                isRunning
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 dark:bg-bordeaux-900/20 dark:hover:bg-bordeaux-900/30 text-slate-700 dark:text-gold-400 border-slate-200 dark:border-gold-500/15'
              }`}
            >
              🔄 Atualizar Status
            </button>
            <button
              onClick={handleRechunk}
              disabled={isRunning || (!status?.pending_embeddings && !status?.large_docs)}
              className={`px-5 py-2 text-xs font-semibold rounded-lg text-white transition-all flex items-center gap-1.5 shadow-sm ${
                isRunning || (!status?.pending_embeddings && !status?.large_docs)
                  ? 'bg-indigo-300 dark:bg-indigo-950/50 cursor-not-allowed text-indigo-100'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/10 font-bold'
              }`}
            >
              <Wrench size={13} />
              {status?.pending_embeddings > 0 ? `Gerar Embeddings (${status.pending_embeddings} pendentes)` : 'Iniciar Otimização'}
            </button>
          </div>
        </div>
      )}

      {/* Guia de Nomenclatura */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Padrão Ouro de Nomenclatura — Base de Conhecimento Felix & Castro
            </span>
          </div>
          <span className="text-amber-600 dark:text-amber-400 text-xs">{showGuide ? '▲ fechar' : '▼ ver guia'}</span>
        </button>

        {showGuide && (
          <div className="mt-4 space-y-4">
            {NAMING_GUIDE.map((item) => (
              <div key={item.tipo} className="bg-white dark:bg-bordeaux-900/40 rounded-lg p-3 border border-amber-100 dark:border-amber-800/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">{item.tipo}</span>
                </div>
                <code className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded block mb-2">
                  {item.padrao}
                </code>
                <div className="space-y-1">
                  {item.exemplos.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleSelectExample(ex)}
                      className="w-full text-left text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors truncate"
                      title={`Usar "${ex}" como título`}
                    >
                      → {ex}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de upload */}
        <div className="lg:col-span-2 bg-white dark:bg-bordeaux-950/60 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/20 p-6">
          <h2 className="fc-page-title text-xl font-serif font-semibold text-slate-800 dark:text-cream-50 mb-1 inline-block">
            Base de Conhecimento
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
            Adicione leis, súmulas, jurisprudências e normas. A IA cita exclusivamente o que está aqui.
          </p>

          <div className="space-y-4">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Título do Documento *
                {tipoDetectado && (
                  <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    ✓ {tipoDetectado} detectado
                  </span>
                )}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: SÚMULA 47 TNU — PREVIDENCIÁRIO — Incapacidade parcial e condições pessoais"
                className={`w-full p-2 bg-white dark:bg-bordeaux-900/40 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm ${
                  titleWarnings.length > 0
                    ? 'border-amber-400 dark:border-amber-600'
                    : title && titleWarnings.length === 0
                    ? 'border-emerald-400 dark:border-emerald-600'
                    : 'border-slate-300 dark:border-gold-500/15'
                }`}
              />
              {/* Avisos de padronização */}
              {titleWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 mt-1.5">
                  <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
                </div>
              ))}
              {/* Contador de caracteres */}
              <p className={`text-xs mt-1 text-right ${title.length > 120 ? 'text-red-500' : 'text-slate-400'}`}>
                {title.length}/120 caracteres
              </p>
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL da Fonte (Opcional)</label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Ex: https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm"
                className="w-full p-2 bg-white dark:bg-bordeaux-900/40 border border-slate-300 dark:border-gold-500/15 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>

            {/* Conteúdo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Conteúdo do Documento *
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {content.length > 0 && `${content.length.toLocaleString()} chars · ~${chunkLegalText(content).length} trechos`}
                </span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole o texto integral da lei, súmula, ementa do acórdão ou jurisprudência aqui..."
                rows={12}
                className="w-full p-2 bg-white dark:bg-bordeaux-900/40 border border-slate-300 dark:border-gold-500/15 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-900 dark:text-slate-100"
              />
              {content.length > 100 && (
                <p className="text-xs text-slate-400 mt-1">
                  Chunking automático: divisão por artigo com sobreposição de 200 chars (padrão ouro).
                </p>
              )}
            </div>

            {/* Progresso */}
            {isProcessing && uploadProgress.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Processando trecho {uploadProgress.current} de {uploadProgress.total}</span>
                  <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mensagem */}
            {message.text && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' :
                message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              }`}>
                {isProcessing && <Loader2 size={14} className="inline animate-spin mr-2" />}
                {message.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleProcess}
                disabled={isProcessing || !title.trim() || !content.trim()}
                className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors flex items-center gap-2 ${
                  isProcessing || !title.trim() || !content.trim()
                    ? 'bg-indigo-300 dark:bg-indigo-800 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <><Plus size={16} /> Indexar na Base</>}
              </button>
            </div>
          </div>
        </div>

        {/* Painel lateral — documentos existentes */}
        <div className="bg-white dark:bg-bordeaux-950/60 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/20 p-6 flex flex-col">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <BookOpen className="text-indigo-500" size={18} />
            Documentos Indexados
            {!isLoadingDocs && (
              <span className="ml-auto text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {existingDocs.length}
              </span>
            )}
          </h3>

          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 text-sm bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 mb-3"
          />

          <div className="flex-1 overflow-y-auto pr-1 max-h-[480px] space-y-1.5">
            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 size={22} className="animate-spin mb-2" />
                <p className="text-xs">Carregando...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-xs">{searchTerm ? 'Nenhum resultado.' : 'Nenhum documento indexado.'}</p>
              </div>
            ) : (
              filteredDocs.map((docTitle) => {
                const tipo = detectTipoDoc(docTitle);
                const icon =
                  tipo === 'súmula' ? '⚖️' :
                  tipo === 'tema' ? '🎯' :
                  tipo === 'jurisprudência' ? '📰' :
                  tipo === 'instrução normativa' ? '📑' :
                  tipo === 'orientação jurisprudencial' ? '🔍' :
                  tipo === 'quadro anexo' ? '📊' :
                  tipo === 'emenda constitucional' ? '🏛️' :
                  tipo === 'decreto' ? '📜' :
                  tipo === 'constituição' ? '🇧🇷' :
                  '📋';
                return (
                  <div
                    key={docTitle}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-100 dark:border-gold-500/10 rounded-lg hover:border-indigo-200 dark:hover:border-indigo-700/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm flex-shrink-0">{icon}</span>
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate" title={docTitle}>
                        {docTitle}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(docTitle)}
                      className="ml-2 p-1 text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Painel de manutenção desativado temporariamente */}
    </div>
  );
}