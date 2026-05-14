import React, { useState } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { ClientRecord } from '../types';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientId: string, referrerName: string, referrerPercentage: number, totalFee: number) => void;
  clients: ClientRecord[];
}

const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, onSave, clients }) => {
  const [clientId, setClientId] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referrerPercentage, setReferrerPercentage] = useState(0);
  const [totalFee, setTotalFee] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients
    .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(clientId, referrerName, referrerPercentage, totalFee);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Registrar Indicação</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Buscar Cliente</label>
            <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Digite o nome do cliente..."
                className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 mb-2" 
            />
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" required>
              <option value="">Selecione um cliente...</option>
              {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Indicador</label>
            <input type="text" value={referrerName} onChange={(e) => setReferrerName(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total Honorários (R$)</label>
              <input type="number" value={totalFee} onChange={(e) => setTotalFee(Number(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Porcentagem (%)</label>
              <input type="number" value={referrerPercentage} onChange={(e) => setReferrerPercentage(Number(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700" required />
            </div>
          </div>
          <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 flex items-center justify-center gap-2">
            <CheckIcon className="h-5 w-5" /> Salvar Indicação
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReferralModal;
