import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { CheckCircle2, Plus, Trash2, BookOpen, Loader2 } from 'lucide-react';

export default function KnowledgeBase() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const suggestedLaws = [
    "Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)",
    "Lei Orgânica da Seguridade Social (Lei nº 8.212/1991)",
    "Lei Orgânica da Assistência Social - LOAS (Lei nº 8.742/1993)",
    "Lei do FGTS (Lei nº 8.036/1990)",
    "Lei do Seguro-Desemprego (Lei nº 7.998/1990)",
    "Lei do Trabalho Doméstico (LC nº 150/2015)",
    "Reforma Trabalhista (Lei nº 13.467/2017)",
    "Reforma da Previdência (EC nº 103/2019)",
    "Regulamento da Previdência Social (Decreto nº 3.048/1999)"
  ];

  useEffect(() => {
    fetchDocs();
  }, []);

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

  const handleSelectSuggested = (law: string) => {
    setTitle(law);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (docTitle: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${docTitle}" da base de conhecimento?`)) return;
    
    try {
      await supabaseService.deleteLegalDocumentByTitle(docTitle);
      setExistingDocs(prev => prev.filter(t => t !== docTitle));
    } catch (error) {
      console.error('Error deleting doc:', error);
      alert('Erro ao excluir documento.');
    }
  };

  const handleProcess = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage({ text: 'Título e conteúdo são obrigatórios.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setMessage({ text: 'Preparando documento...', type: 'info' });

    try {
      // 0. Delete existing document with the same title to allow replacement
      setMessage({ text: 'Verificando se o documento já existe...', type: 'info' });
      await supabaseService.deleteLegalDocumentByTitle(title);

      // 1. Chunk the text on the frontend (Smarter Legal Chunking)
      // Split primarily by "Art. " to keep articles and their paragraphs together
      const rawParts = content.split(/(?=\n\s*Art\.\s|\n\s*Artigo\s)/i);
      const chunks: string[] = [];
      let currentChunk = "";
      
      for (const part of rawParts) {
        const p = part.trim();
        if (!p) continue;

        // If adding this part exceeds a safe limit (e.g., 2500 chars) and we already have something,
        // push the current chunk and start a new one.
        if (currentChunk.length + p.length > 2500 && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        currentChunk += (currentChunk ? "\n\n" : "") + p;

        // If a single article is massive (like Art 5 of CF) and exceeds 2500, 
        // we push it immediately after adding to avoid giant chunks.
        if (currentChunk.length >= 2500) {
           // If it's way too big (e.g. > 4000), we might need to sub-split, but Gemini handles up to 10k bytes well.
           chunks.push(currentChunk.trim());
           currentChunk = "";
        }
      }
      
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }

      if (chunks.length === 0) {
        throw new Error('Nenhum trecho de texto gerado.');
      }

      // 2. Process each chunk sequentially to avoid timeouts
      let processedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        setMessage({ text: `Processando trecho ${i + 1} de ${chunks.length}... (Isso pode levar alguns minutos para leis grandes)`, type: 'info' });

        const response = await fetch('/api/rag/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Falha ao processar o trecho ${i + 1}`);
        }

        const { embedding } = await response.json();

        processedChunks.push({
          content: chunk,
          metadata: {
            title,
            sourceUrl,
            dateAdded: new Date().toISOString()
          },
          embedding
        });
        
        // Save in batches of 10 to avoid losing everything if it fails halfway
        if (processedChunks.length >= 10 || i === chunks.length - 1) {
           setMessage({ text: `Salvando trechos no banco de dados (${i + 1}/${chunks.length})...`, type: 'info' });
           await supabaseService.saveLegalDocuments(processedChunks);
           processedChunks = []; // clear array
        }
      }

      setMessage({ text: 'Documento salvo com sucesso na Base de Conhecimento!', type: 'success' });
      setTitle('');
      setContent('');
      setSourceUrl('');
      setIsSuccess(true);
      fetchDocs(); // Refresh list
    } catch (error: any) {
      console.error('Erro no RAG:', error);
      setMessage({ text: error.message || 'Erro ao processar documento.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Documento Salvo com Sucesso!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          A legislação/jurisprudência foi processada e adicionada à base de conhecimento. A IA já pode utilizar essas informações em suas respostas.
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setMessage({ text: '', type: '' });
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={20} />
          Adicionar Mais Leis
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Base de Conhecimento (Treinar IA)</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          Adicione leis, jurisprudências ou documentos padrão aqui. A IA usará essas informações para responder com mais precisão e embasamento jurídico.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título do Documento *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Lei 8.213/91 - Planos de Benefícios da Previdência Social"
              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL da Fonte (Opcional)</label>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Ex: http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm"
              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conteúdo do Documento *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole o texto da lei ou jurisprudência aqui..."
              rows={10}
              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          {message.text && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' :
              message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
              'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                isProcessing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isProcessing ? 'Processando...' : 'Processar e Salvar'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <BookOpen className="text-indigo-500" size={20} />
          Documentos na Base
        </h3>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Pesquisar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 max-h-[400px] custom-scrollbar">
          {isLoadingDocs ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={24} className="animate-spin mb-2" />
              <p className="text-sm">Carregando...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">{searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhum documento cadastrado.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((docTitle) => (
                <div 
                  key={docTitle}
                  className="group flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate pr-2" title={docTitle}>
                    {docTitle}
                  </span>
                  <button
                    onClick={() => handleDelete(docTitle)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Excluir documento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Leis Sugeridas para Adicionar</h4>
          <div className="space-y-2">
            {suggestedLaws.filter(law => !existingDocs.includes(law)).slice(0, 5).map(law => (
              <button
                key={law}
                onClick={() => handleSelectSuggested(law)}
                className="w-full text-left p-2 text-xs bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors truncate"
              >
                + {law}
              </button>
            ))}
            {suggestedLaws.filter(law => !existingDocs.includes(law)).length === 0 && (
              <p className="text-xs text-slate-400 italic">Todas as leis sugeridas já estão na base.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
