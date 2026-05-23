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

  // Passo 1: dividir primeiramente por artigo (Art. X / Artigo X)
  const rawParts = text.split(/(?=\n\s*(?:Art\.|Artigo)\s+\d)/i);

  let currentChunk = '';

  const flushChunk = (chunk: string) => {
    const trimmed = chunk.trim();
    if (trimmed.length < 80) return; // ignora micro-resíduos
    // Se o chunk é MUITO grande (artigo único enorme), sub-divide por parágrafo/sentença
    if (trimmed.length > maxChars * 1.5) {
      subSplit(trimmed).forEach(sub => chunks.push(sub));
    } else {
      chunks.push(trimmed);
    }
  };

  // Sub-divisor semântico para artigos gigantes (Art. 5 da CF, etc.)
  const subSplit = (text: string): string[] => {
    const subs: string[] = [];
    const parParts = text.split(/\n\n+/);
    let cur = '';
    for (const par of parParts) {
      if ((cur + '\n\n' + par).length > maxChars && cur.length > 0) {
        subs.push(cur.trim());
        // Overlap: repetir últimas linhas do chunk anterior como contexto
        const overlap = cur.split('\n').slice(-3).join('\n');
        cur = overlap + '\n\n' + par;
      } else {
        cur = cur ? cur + '\n\n' + par : par;
      }
    }
    if (cur.trim().length > 80) subs.push(cur.trim());
    return subs;
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
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // Rechunking admin
  const [showAdmin, setShowAdmin] = useState(false);
  const [isRechunking, setIsRechunking] = useState(false);
  const [rechunkResult, setRechunkResult] = useState<any>(null);
  const [rechunkLog, setRechunkLog] = useState<string[]>([]);

  const handleRechunk = async () => {
    // FASE 1 ou FASE 2 dependendo do estado atual
    const pendingEmbeddings = await supabaseService.countChunksNeedingEmbedding().catch(() => 0);
    const largeDocs = await supabaseService.countLargeDocuments(8000).catch(() => 0);

    if (pendingEmbeddings === 0 && largeDocs === 0) {
      alert('Base ja esta otimizada!');
      return;
    }

    setIsRechunking(true);

    try {
      // FASE 2: há chunks sem embedding — gerar embeddings primeiro
      if (pendingEmbeddings > 0) {
        setRechunkLog(prev => [...prev, `Gerando embeddings: ${pendingEmbeddings} trechos pendentes...`]);
        let remaining = pendingEmbeddings;
        let done_count = 0;

        while (remaining > 0) {
          const chunk = await supabaseService.getOneChunkNeedingEmbedding();
          if (!chunk) break;

          setRechunkLog(prev => {
            const clean = prev.filter(l => !l.startsWith('  '));
            return [...clean, `  Embedding ${done_count + 1}/${pendingEmbeddings}: ID ${chunk.id}`];
          });

          try {
            const resp = await apiFetch('/api/rag/embed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: chunk.content })
            });
            if (resp.ok) {
              const { embedding } = await resp.json();
              if (embedding?.length) {
                await supabaseService.updateEmbedding(chunk.id, embedding);
                done_count++;
              }
            }
          } catch { /* continua no proximo */ }

          remaining = await supabaseService.countChunksNeedingEmbedding().catch(() => 0);
          await new Promise(r => setTimeout(r, 50));
        }

        setRechunkLog(prev => [
          ...prev.filter(l => !l.startsWith('  ')),
          `Embeddings gerados: ${done_count}`,
          largeDocs > 0 ? `${largeDocs} documentos grandes ainda para dividir. Clique novamente.` : 'Base totalmente otimizada!'
        ]);
        setRechunkResult({ done: largeDocs === 0 && remaining === 0, remaining: largeDocs });
        if (largeDocs === 0) fetchDocs();
        return;
      }

      // FASE 1: dividir documento via SQL (sem embedding — rapido)
      if (!confirm(`Dividir proximo documento grande? (${largeDocs} restantes)\nRapido: so divide o texto, sem gerar embeddings agora.`)) {
        setIsRechunking(false);
        return;
      }

      setRechunkLog(prev => [...prev, `Dividindo documento via SQL...`]);
      const result = await supabaseService.splitOneLargeDocument();

      if (result.done) {
        setRechunkLog(prev => [...prev, 'Nenhum documento grande. Clique novamente para gerar embeddings pendentes.']);
      } else {
        setRechunkLog(prev => [...prev,
          `Dividido: "${result.titulo}" -> ${result.chunks_gerados} trechos (sem embedding ainda)`,
          `Clique novamente para gerar os embeddings dos ${result.chunks_gerados} trechos.`
        ]);
      }

      const newLarge = await supabaseService.countLargeDocuments(8000).catch(() => largeDocs);
      const newPending = await supabaseService.countChunksNeedingEmbedding().catch(() => 0);
      setRechunkResult({ done: false, remaining: newLarge, pendingEmbeddings: newPending });

    } catch (err: any) {
      setRechunkLog(prev => [...prev, `Erro: ${err.message}`]);
    } finally {
      setIsRechunking(false);
    }
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
    setProgress({ current: 0, total: 0 });

    try {
      await supabaseService.deleteLegalDocumentByTitle(title.trim());

      // Chunking padrão ouro com overlap
      const chunks = chunkLegalText(content, 2500, 200);
      if (chunks.length === 0) throw new Error('Nenhum trecho de texto gerado. Verifique o conteúdo.');

      setProgress({ current: 0, total: chunks.length });
      setMessage({ text: `Gerando embeddings para ${chunks.length} trechos...`, type: 'info' });

      let processedChunks: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProgress({ current: i + 1, total: chunks.length });

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
    <div className="space-y-4">

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
            {isProcessing && progress.total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Processando trecho {progress.current} de {progress.total}</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
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

      {/* ── Painel Admin — Rechunking ─────────────────────────── */}
      <div className="bg-slate-50 dark:bg-bordeaux-950/40 border border-slate-200 dark:border-gold-500/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-100 dark:hover:bg-bordeaux-900/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wrench size={15} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Manutenção da Base — Otimizar Chunks</span>
          </div>
          {showAdmin ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </button>

        {showAdmin && (
          <div className="px-5 pb-5 pt-2 space-y-3 border-t border-slate-200 dark:border-gold-500/10">
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/20 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">O que faz?</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Documentos maiores que 8.000 caracteres têm embeddings "diluídos" que reduzem a precisão da busca.
                Este processo divide cada um em trechos de ~2.500 chars, gera embeddings precisos para cada trecho
                e substitui o documento original. Roda uma única vez.
              </p>
            </div>

            <button
              onClick={handleRechunk}
              disabled={isRechunking}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                isRechunking ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500'
              }`}
            >
              {isRechunking ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
              {isRechunking
                  ? 'Processando...'
                  : rechunkResult && !rechunkResult.done && rechunkResult.remaining > 0
                  ? `▶ Próximo (${rechunkResult.remaining} restantes)`
                  : 'Executar Rechunking'}
            </button>

            {rechunkResult && (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/20 rounded-lg p-3">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">✅ Concluído</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <div><span className="font-bold">{rechunkResult.processed}</span> documentos processados</div>
                  <div><span className="font-bold">{rechunkResult.new_chunks}</span> novos chunks gerados</div>
                  <div><span className="font-bold">{rechunkResult.errors}</span> erros</div>
                </div>
              </div>
            )}

            {rechunkLog.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                {rechunkLog.map((line, i) => (
                  <p key={i} className="text-xs font-mono text-slate-300 leading-5">{line}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
