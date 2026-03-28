import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { AgendaEvent, User } from '../types';

interface ResolutionNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  event: AgendaEvent | null;
  user: User;
}

const ResolutionNoteModal: React.FC<ResolutionNoteModalProps> = ({ isOpen, onClose, onConfirm, event, user }) => {
  const [note, setNote] = useState('');

  if (!isOpen || !event) return null;

  const handleConfirm = () => {
    onConfirm(note);
    setNote('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Concluir Compromisso</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Compromisso</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{event.clientName || 'Sem cliente'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{event.description}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
              O que ocorreu na conclusão?
            </label>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Tudo resolvido, cliente compareceu à perícia, prorrogação requerida..."
              className="w-full h-32 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 italic">
            <span>Registrado por: <strong>{user.firstName} {user.lastName}</strong></span>
            <span>•</span>
            <span>{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-white dark:hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
          >
            Confirmar Conclusão
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResolutionNoteModal;
