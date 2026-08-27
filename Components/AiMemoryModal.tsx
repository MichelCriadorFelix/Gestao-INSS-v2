import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Check, BookOpen, User, Globe, Sparkles, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";
import { apiFetch } from "../services/apiService";

interface AiMemoryRule {
  id: string;
  persona: string;
  rule_text: string;
  active: boolean;
  created_at: string;
}

interface AnalysisResult {
  contradictions: Array<{ ruleIds: string[]; description: string }>;
  duplicates: Array<{ ruleIds: string[]; description: string }>;
  improvements: Array<{ ruleId: string; originalText: string; suggestedText: string; reason: string }>;
}

interface AiMemoryModalProps {
  onClose: () => void;
  personaId: string;
  initialRule?: string;
}

export function AiMemoryModal({ onClose, personaId, initialRule = "" }: AiMemoryModalProps) {
  const [rules, setRules] = useState<AiMemoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState(initialRule);
  const [targetPersona, setTargetPersona] = useState<string>(personaId || "global");
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRule) {
      setNewRule(initialRule);
    }
  }, [initialRule]);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/ai-memory-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.trim()) return;
    try {
      setSubmitting(true);
      const res = await apiFetch('/api/ai-memory-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: targetPersona,
          rule_text: newRule.trim(),
          active: true
        })
      });
      if (res.ok) {
        const added = await res.json();
        setRules([added, ...rules]);
        setNewRule("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      setRules(rules.map(r => r.id === id ? { ...r, active: !currentActive } : r));
      await apiFetch(`/api/ai-memory-rules/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });
    } catch (err) {
      console.error("Erro ao alternar status da regra", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta regra de memória?")) return;
    try {
      setRules(rules.filter(r => r.id !== id));
      await apiFetch(`/api/ai-memory-rules/${id}`, { method: 'DELETE' });
      
      // Update analysis state if exists
      if (analysis) {
        setAnalysis(prev => {
          if (!prev) return prev;
          return {
            contradictions: prev.contradictions.filter(c => !c.ruleIds.includes(id)),
            duplicates: prev.duplicates.filter(d => !d.ruleIds.includes(id)),
            improvements: prev.improvements.filter(i => i.ruleId !== id)
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeRules = async () => {
    if (rules.length === 0) return;
    try {
      setAnalyzing(true);
      setAnalyzeError(null);
      const res = await apiFetch('/api/ai-memory-rules/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Erro no servidor' }));
        setAnalyzeError(errData.error || "Servidor indisponível no momento. Tente novamente em alguns segundos.");
      }
    } catch (err: any) {
      console.error("Erro na análise", err);
      setAnalyzeError("Falha ao comunicar com o servidor de análise.");
    } finally {
      setAnalyzing(false);
    }
  };

  const resolveDuplicates = async (ruleIds: string[]) => {
    if (ruleIds.length <= 1) return;
    const toDelete = ruleIds.slice(1);
    try {
      setRules(prev => prev.filter(r => !toDelete.includes(r.id)));
      await Promise.all(toDelete.map(id => apiFetch(`/api/ai-memory-rules/${id}`, { method: 'DELETE' })));
      setAnalysis(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          duplicates: prev.duplicates.filter(d => d.ruleIds !== ruleIds),
          contradictions: prev.contradictions.map(c => ({
            ...c,
            ruleIds: c.ruleIds.filter(id => !toDelete.includes(id))
          })).filter(c => c.ruleIds.length > 1),
          improvements: prev.improvements.filter(i => !toDelete.includes(i.ruleId))
        };
      });
    } catch (err) {
      console.error("Erro ao resolver duplicadas:", err);
    }
  };

  const applyImprovement = async (ruleId: string, suggestedText: string) => {
    try {
      // Find the rule to update
      const ruleToUpdate = rules.find(r => r.id === ruleId);
      if (!ruleToUpdate) return;
      
      // Set optimistic state
      setRules(rules.map(r => r.id === ruleId ? { ...r, rule_text: suggestedText } : r));
      
      // Ideally, there should be an endpoint for PUT /api/ai-memory-rules/:id to update text
      // Let's implement it in api/index.ts in the next step, for now just call it
      await apiFetch(`/api/ai-memory-rules/${ruleId}/text`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_text: suggestedText })
      });
      
      // Remove from analysis
      setAnalysis(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          improvements: prev.improvements.filter(i => i.ruleId !== ruleId)
        };
      });
    } catch(e) {
      console.error(e);
      // Revert optimistic state on error (simple reload)
      fetchRules();
    }
  };

  const currentPersonaRules = rules.filter(r => r.persona === personaId);
  const globalRules = rules.filter(r => r.persona === 'global');
  const otherRules = rules.filter(r => r.persona !== personaId && r.persona !== 'global');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Memória Contínua da IA</h2>
              <p className="text-sm text-indigo-600/80 font-medium">Treinamento perene baseado em correções</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Save size={16} className="text-indigo-600" /> Adicionar Aprendizado
            </h3>
            <div className="flex flex-col gap-3">
              <textarea 
                value={newRule}
                onChange={e => setNewRule(e.target.value)}
                placeholder="Ex: Nunca cite a Lei 14.331/2022 em petições rurais. Ou: Sempre inicie com uma saudação formal..."
                className="w-full p-3 border border-gray-300 rounded-lg shadow-inner focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px] resize-y text-sm"
              />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1 rounded-lg">
                  <button 
                    onClick={() => setTargetPersona("global")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${targetPersona === 'global' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                  >
                    <Globe size={14} /> Global (Todas IAs)
                  </button>
                  <button 
                    onClick={() => setTargetPersona(personaId)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${targetPersona === personaId ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                  >
                    <User size={14} /> Apenas para IA Atual
                  </button>
                </div>
                <button 
                  onClick={handleAddRule}
                  disabled={!newRule.trim() || submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 text-sm"
                >
                  {submitting ? 'Salvando...' : 'Gravar Regra'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen size={16} className="text-gray-500" /> Banco de Memória ({rules.length})
            </h3>
            <button 
              onClick={handleAnalyzeRules}
              disabled={analyzing || rules.length === 0}
              className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white text-xs font-medium px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-70"
            >
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? 'Analisando...' : 'Análise Inteligente de Regras'}
            </button>
          </div>

          {analyzeError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-red-500" />
              <span>{analyzeError}</span>
            </div>
          )}

          {analysis && (
            <div className="mb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
              {(analysis.contradictions.length > 0 || analysis.duplicates.length > 0 || analysis.improvements.length > 0) ? (
                <>
                  {analysis.contradictions.map((item, idx) => (
                    <div key={`c-${idx}`} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} /> Contradição Detectada
                      </h4>
                      <p className="text-sm text-red-800 mb-3">{item.description}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-200/60">
                        <span className="text-xs text-red-700 font-medium">Ações rápidas:</span>
                        {item.ruleIds.map((id, index) => (
                          <button
                            key={id}
                            onClick={() => handleDelete(id)}
                            className="bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                            title={`Excluir regra ID: ${id}`}
                          >
                            <Trash2 size={12} /> Excluir Opção {index + 1} ({id.slice(0, 6)}...)
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {analysis.duplicates.map((item, idx) => (
                    <div key={`d-${idx}`} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-amber-700 flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} /> Regras Duplicadas
                      </h4>
                      <p className="text-sm text-amber-800 mb-3">{item.description}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/60">
                        <span className="text-xs text-amber-700 font-medium">
                          {item.ruleIds.length} cópias encontradas
                        </span>
                        <button
                          onClick={() => resolveDuplicates(item.ruleIds)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Trash2 size={13} /> Manter 1ª e Excluir {item.ruleIds.length - 1} Repetida{item.ruleIds.length - 1 > 1 ? 's' : ''}
                        </button>
                      </div>
                    </div>
                  ))}

                  {analysis.improvements.map((item, idx) => (
                    <div key={`i-${idx}`} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-blue-700 flex items-center gap-2 mb-2">
                        <Info size={16} /> Sugestão de Melhoria (ID: {item.ruleId.slice(0, 8)}...)
                      </h4>
                      <p className="text-sm text-blue-800 mb-2">{item.reason}</p>
                      <div className="bg-white/60 p-2 rounded text-xs text-gray-500 mb-2 line-through">
                        Original: {item.originalText}
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-100 text-sm font-medium text-gray-800 mb-3">
                        {item.suggestedText}
                      </div>
                      <button 
                        onClick={() => applyImprovement(item.ruleId, item.suggestedText)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                      >
                        <Check size={14} /> Aplicar Sugestão
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <Check size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800">Tudo Perfeito!</h4>
                    <p className="text-sm text-emerald-600">Não encontramos contradições, duplicações ou necessidade de melhorias nas suas regras.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : (
            <div className="space-y-6">
              
              {currentPersonaRules.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                    <User size={14} className="text-gray-400" /> Regras Específicas: {personaId}
                  </h4>
                  <div className="grid gap-2">
                    {currentPersonaRules.map(rule => <RuleItem key={rule.id} rule={rule} onToggle={handleToggle} onDelete={handleDelete} />)}
                  </div>
                </div>
              )}

              {globalRules.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                    <Globe size={14} className="text-gray-400" /> Regras Globais
                  </h4>
                  <div className="grid gap-2">
                    {globalRules.map(rule => <RuleItem key={rule.id} rule={rule} onToggle={handleToggle} onDelete={handleDelete} />)}
                  </div>
                </div>
              )}

              {otherRules.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Outras Personas</h4>
                  <div className="grid gap-2 opacity-75">
                    {otherRules.map(rule => <RuleItem key={rule.id} rule={rule} onToggle={handleToggle} onDelete={handleDelete} />)}
                  </div>
                </div>
              )}

              {rules.length === 0 && (
                <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-xl bg-white">
                  <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum aprendizado cadastrado ainda.</p>
                  <p className="text-sm text-gray-400 mt-1">Crie diretrizes para corrigir erros recorrentes da IA para sempre.</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleItem({ rule, onToggle, onDelete }: { rule: AiMemoryRule, onToggle: (id:string, a:boolean) => void, onDelete: (id:string) => void }) {
  return (
    <div className={`flex items-start justify-between p-4 rounded-xl border transition-all ${rule.active ? 'bg-white border-indigo-100 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <div className="flex gap-3">
        <button onClick={() => onToggle(rule.id, rule.active)} className={`mt-0.5 shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${rule.active ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
          {rule.active && <Check size={14} className="text-white" />}
        </button>
        <div>
          <p className={`text-sm ${rule.active ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{rule.rule_text}</p>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
              <span className="opacity-50">ID:</span> {rule.id.slice(0, 8)}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {new Date(rule.created_at).toLocaleDateString()}
            </span>
            {rule.persona !== 'global' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                {rule.persona}
              </span>
            )}
          </div>
        </div>
      </div>
      <button onClick={() => onDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
