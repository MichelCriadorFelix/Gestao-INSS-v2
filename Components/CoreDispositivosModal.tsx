import React, { useState, useEffect } from "react";
import { X, Search, Trash2, Plus, Scale, Info } from "lucide-react";
import { supabaseService } from "../services/supabaseService";
import { CORE_DISPOSITIVOS_CASE_TYPES } from "./coreDispositivosConfig";

interface CoreDispositivosModalProps {
  onClose: () => void;
}

interface CuratedItem {
  linkId: string;
  id: number;
  title: string;
  content: string;
}

interface SearchResultItem {
  id: number;
  content: string;
  metadata?: { title?: string };
}

export function CoreDispositivosModal({ onClose }: CoreDispositivosModalProps) {
  const [caseType, setCaseType] = useState(CORE_DISPOSITIVOS_CASE_TYPES[0].key);
  const [curated, setCurated] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const fetchCurated = async (type: string) => {
    setLoading(true);
    try {
      const items = await supabaseService.listCoreDispositivosByType(type);
      setCurated(items);
    } catch (err) {
      console.error("Erro ao carregar dispositivos núcleo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurated(caseType);
    setSearchQuery("");
    setSearchResults([]);
  }, [caseType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await supabaseService.keywordSearchLegalDocuments(searchQuery.trim(), 15);
      setSearchResults(results as SearchResultItem[]);
    } catch (err) {
      console.error("Erro ao buscar dispositivos:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (legalDocumentId: number) => {
    setAddingId(legalDocumentId);
    try {
      await supabaseService.addCoreDispositivo(caseType, legalDocumentId);
      await fetchCurated(caseType);
    } catch (err) {
      console.error("Erro ao adicionar dispositivo núcleo:", err);
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (linkId: string) => {
    setCurated(prev => prev.filter(c => c.linkId !== linkId));
    try {
      await supabaseService.removeCoreDispositivo(linkId);
    } catch (err) {
      console.error("Erro ao remover dispositivo núcleo:", err);
      fetchCurated(caseType);
    }
  };

  const curatedIds = new Set(curated.map(c => c.id));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">

        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Scale size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dispositivos Núcleo por Tipo de Caso</h2>
              <p className="text-sm text-emerald-600/80 font-medium">Curadoria manual — evita busca RAG repetida pros itens sempre usados</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">

          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <Info size={16} className="shrink-0 text-blue-500 mt-0.5" />
            <span>Escolha o tipo de caso e selecione os artigos/súmulas que SEMPRE se aplicam a ele. Esses itens vão direto pra peça sem passar pela busca RAG — só o que for específico do caso continua indo por busca.</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Tipo de caso</label>
            <select
              value={caseType}
              onChange={e => setCaseType(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {CORE_DISPOSITIVOS_CASE_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Search size={16} className="text-emerald-600" /> Buscar dispositivo pra adicionar
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: Súmula 48 TNU, Art. 20 Lei 8.742..."
                className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map(r => {
                  const already = curatedIds.has(r.id);
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.metadata?.title || `Documento #${r.id}`}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{r.content?.slice(0, 140)}</p>
                      </div>
                      <button
                        onClick={() => handleAdd(r.id)}
                        disabled={already || addingId === r.id}
                        className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${already ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                      >
                        {already ? 'Já no núcleo' : (addingId === r.id ? 'Adicionando...' : <><Plus size={13} /> Adicionar</>)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Scale size={16} className="text-gray-500" /> Núcleo atual ({curated.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : curated.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-xl bg-white">
              <Scale size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhum dispositivo curado ainda pra este tipo de caso.</p>
              <p className="text-sm text-gray-400 mt-1">Busque acima e adicione os artigos/súmulas que sempre se aplicam.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {curated.map(item => (
                <div key={item.linkId} className="flex items-start justify-between p-4 rounded-xl border bg-white border-emerald-100 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.title || `Documento #${item.id}`}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content?.slice(0, 160)}</p>
                  </div>
                  <button onClick={() => handleRemove(item.linkId)} className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
