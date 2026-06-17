import React from 'react';
import { XMarkIcon as XMark, RocketLaunchIcon as RocketLaunch, CpuChipIcon as CpuChip } from '@heroicons/react/24/outline';

interface EliteRedactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (provider: 'gemini' | 'openrouter', model?: string) => void;
  currentModel?: string;
  currentProvider?: string;
}

export default function EliteRedactionModal({ isOpen, onClose, onConfirm, currentModel, currentProvider }: EliteRedactionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-bordeaux-950/60 border border-slate-200 dark:border-gold-500/15 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-gold-500/20 bg-cream-50 dark:bg-bordeaux-950/60/50">
          <div>
            <h3 className="text-xl font-bold gap-2 flex items-center text-slate-800 dark:text-white">
              <CpuChip className="w-6 h-6 text-emerald-500" />
              Modo de Redação de Elite
            </h3>
            <p className="text-sm text-slate-500 mt-1">Identificamos um comando para gerar uma peça.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-bordeaux-900/50 transition-colors">
            <XMark className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Todas as gerações do escritório foram migradas com sucesso para a arquitetura de alta performance da OpenRouter (100% livre das cotas do Google). Escolha o modelo ideal:
          </p>

          <button 
            onClick={() => onConfirm('openrouter', 'deepseek/deepseek-v4-flash')}
            className="w-full text-left p-4 rounded-xl border border-emerald-500/30 bg-slate-50 dark:bg-bordeaux-900/10 hover:border-emerald-500 transition-all group"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-gold-400">
                  Prosseguir com DeepSeek V4 Flash (Rápido)
                </h4>
                <p className="text-xs text-slate-500 mt-1">Usa o modelo rápido via OpenRouter. Excelente para análises jurídicas preliminares.</p>
              </div>
            </div>
          </button>
          
          <button 
            onClick={() => onConfirm('openrouter', 'deepseek/deepseek-v4-flash')}
            className="w-full text-left p-4 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 transition-all group relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <RocketLaunch className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  Usar DeepSeek V4 Flash (Geração Contínua)
                  <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-black">Recomendado</span>
                </h4>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Usa a API da OpenRouter para petições longas com o Padrão Ouro do escritório.</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
