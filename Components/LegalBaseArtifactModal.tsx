import React, { useState } from "react";
import { X, BookOpen, Copy, Check, Scale, Trash2, Filter } from "lucide-react";
import type { LegalBaseArtifact } from "./PersonaChat";

interface LegalBaseArtifactModalProps {
  onClose: () => void;
  artifact?: LegalBaseArtifact;
  onClear?: () => void;
  onRemoveItem?: (id: string) => void;
  onCleanIrrelevant?: () => void;
  activeDomainName?: string;
}

export function LegalBaseArtifactModal({ onClose, artifact, onClear, onRemoveItem, onCleanIrrelevant, activeDomainName }: LegalBaseArtifactModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const items = artifact?.items || [];

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const copyAll = () => {
    const full = items.map(it => `FONTE: ${it.title}\n${it.content}`).join('\n\n---\n\n');
    copy(full, 'all');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Scale size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Base Legal desta Conversa</h2>
              <p className="text-sm text-indigo-600/80 font-medium">
                {items.length} dispositivo{items.length !== 1 ? 's' : ''} legal{items.length !== 1 ? 'is' : ''} recuperado{items.length !== 1 ? 's' : ''} da base de conhecimento
                {artifact?.updatedAt ? ` · atualizado às ${new Date(artifact.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && onCleanIrrelevant && (
              <button
                onClick={() => {
                  if (window.confirm(`Deseja limpar automaticamente dispositivos que não pertencem ao tema atual (${activeDomainName || 'da conversa'})?`)) {
                    onCleanIrrelevant();
                  }
                }}
                className="px-3 py-1.5 hover:bg-indigo-100 rounded-lg text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-200"
                title="Limpar dispositivos fora do tema do caso"
              >
                <Filter size={14} />
                Limpar Fora do Tema
              </button>
            )}
            {items.length > 0 && onClear && (
              <button
                onClick={() => { if (window.confirm("Limpar toda a Base Legal desta conversa? Os dispositivos já encontrados serão removidos; novas buscas voltam a preenchê-la.")) onClear(); }}
                className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                title="Limpar todos os itens da base legal"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          {items.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-xl bg-white">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhum dispositivo legal recuperado ainda nesta conversa.</p>
              <p className="text-sm text-gray-400 mt-1">Assim que uma pergunta jurídica acionar a base de conhecimento, os dispositivos encontrados ficam salvos aqui automaticamente.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={copyAll}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                >
                  {copiedId === 'all' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === 'all' ? 'Copiado!' : 'Copiar tudo'}
                </button>
              </div>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-bold text-gray-800 flex-1">{item.title || 'Fonte não identificada'}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copy(`FONTE: ${item.title}\n${item.content}`, item.id)}
                          className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                          title="Copiar este dispositivo"
                        >
                          {copiedId === item.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                        {onRemoveItem && (
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                            title="Remover este dispositivo da Base Legal"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6 hover:line-clamp-none transition-all">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
