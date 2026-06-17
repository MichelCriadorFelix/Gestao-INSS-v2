import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Check, BookOpen, User, Globe } from "lucide-react";
import { supabase } from "../supabaseClient";
import { apiFetch } from "../services/apiService";

interface AiMemoryRule {
  id: string;
  persona: string;
  rule_text: string;
  active: boolean;
  created_at: string;
}

interface AiMemoryModalProps {
  onClose: () => void;
  personaId: string;
}

export function AiMemoryModal({ onClose, personaId }: AiMemoryModalProps) {
  const [rules, setRules] = useState<AiMemoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState("");
  const [targetPersona, setTargetPersona] = useState<string>(personaId || "global");
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err) {
      console.error(err);
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
          <div className="flex gap-2 mt-1.5">
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
