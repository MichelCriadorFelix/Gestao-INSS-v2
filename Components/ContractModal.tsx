
import React, { useState, useEffect, useRef } from 'react';
import { BriefcaseIcon, XMarkIcon, PlusIcon, TrashIcon, BanknotesIcon, CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ContractRecord, ContractModalProps, PaymentEntry } from '../types';
import { formatCurrency } from '../utils';

const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose, onSave, initialData, clients }) => {
    const [formData, setFormData] = useState<Partial<ContractRecord>>({
        payments: []
    });
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [newPaymentDueDate, setNewPaymentDueDate] = useState(new Date().toISOString().split('T')[0]);

    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const sortedClients = [...(clients || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const filteredClients = sortedClients.filter(c => (c.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase()));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsClientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (initialData) {
            const normalizedPayments = initialData.payments?.map(p => ({
                ...p,
                dueDate: p.dueDate || p.date // Fallback to date if dueDate is missing
            })) || [];
            setFormData({ ...initialData, payments: normalizedPayments });
        } else {
            setFormData({ 
                status: 'Pendente', 
                paymentMethod: 'Parcelado',
                installmentsCount: 1,
                payments: [],
                createdAt: new Date().toISOString().split('T')[0]
            });
        }
        setNewPaymentAmount('');
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (e.target.name === 'clientId') {
            const client = (clients || []).find(c => c.id === e.target.value);
            if (client) {
                const nameParts = (client.name || '').split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                setFormData({ ...formData, clientId: client.id, firstName: firstName, lastName: lastName, cpf: client.cpf });
            } else {
                setFormData({ ...formData, clientId: undefined });
            }
        } else if (e.target.name === 'paymentMethod') {
            const method = e.target.value as 'À Vista' | 'Parcelado';
            const totalFee = Number(formData.totalFee) || 0;
            if (method === 'À Vista' && totalFee > 0 && (formData.payments || []).length === 0) {
                const payment: PaymentEntry = {
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date().toISOString().split('T')[0],
                    dueDate: new Date().toISOString().split('T')[0],
                    amount: totalFee,
                    isPaid: false,
                    note: 'Pagamento à vista'
                };
                setFormData({ ...formData, paymentMethod: method, payments: [payment] });
            } else {
                setFormData({ ...formData, paymentMethod: method });
            }
        } else {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        }
    };

    const handleAddPayment = () => {
        if (!newPaymentAmount || Number(newPaymentAmount) <= 0) return;
        const payment: PaymentEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: newPaymentDate,
            dueDate: newPaymentDueDate,
            amount: Number(newPaymentAmount),
            isPaid: false,
            note: 'Pagamento registrado'
        };
        const updatedPayments = [...(formData.payments || []), payment];
        setFormData({ ...formData, payments: updatedPayments });
        setNewPaymentAmount('');
    };

    const handleRemovePayment = (id: string) => {
        const updatedPayments = (formData.payments || []).filter(p => p.id !== id);
        setFormData({ ...formData, payments: updatedPayments });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as ContractRecord);
    };

    const totalPaid = (formData.payments || []).reduce((sum, p) => p.isPaid ? sum + p.amount : sum, 0);
    const totalFee = Number(formData.totalFee) || 0;
    const remaining = Math.max(0, totalFee - totalPaid);
    const progress = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;
    
    const installments = Number(formData.installmentsCount) || 1;
    const installmentValue = totalFee > 0 ? totalFee / installments : 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                         <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
                             <BriefcaseIcon className="h-6 w-6" />
                         </div>
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                             {initialData ? 'Editar Contrato' : 'Novo Contrato'}
                         </h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="md:col-span-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Dados do Cliente</h4>
                     </div>

                     <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Selecionar Cliente Existente</label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white text-left"
                            >
                                <span className="truncate">
                                    {formData.clientId 
                                        ? (clients || []).find(c => c.id === formData.clientId)?.name 
                                        : 'Novo Cliente'}
                                </span>
                                <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                            </button>

                            {isClientDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                                        <div className="relative">
                                            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente..."
                                                value={clientSearchQuery}
                                                onChange={(e) => setClientSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, clientId: undefined, firstName: '', lastName: '', cpf: '' });
                                                setIsClientDropdownOpen(false);
                                                setClientSearchQuery('');
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition font-medium"
                                        >
                                            Novo Cliente
                                        </button>
                                        {filteredClients.length > 0 ? (
                                            filteredClients.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, clientId: c.id, firstName: c.name, lastName: '', cpf: c.cpf });
                                                        setIsClientDropdownOpen(false);
                                                        setClientSearchQuery('');
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition border-t border-slate-50 dark:border-slate-800"
                                                >
                                                    {c.name}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-4 text-center text-sm text-slate-500">
                                                Nenhum cliente encontrado
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nome <span className="text-red-500">*</span></label>
                        <input type="text" name="firstName" required value={formData.firstName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Sobrenome</label>
                        <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">CPF</label>
                        <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tipo de Serviço</label>
                        <input type="text" name="serviceType" value={formData.serviceType || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                     </div>

                     <div className="md:col-span-2 mt-2">
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Financeiro & Responsável</h4>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Advogado Responsável <span className="text-red-500">*</span></label>
                         <select name="lawyer" required value={formData.lawyer || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="">Selecione...</option>
                             <option value="Michel">Dr. Michel</option>
                             <option value="Luana">Dra. Luana</option>
                         </select>
                         <p className="text-[10px] text-slate-400 mt-1">Define a divisão de lucros (60/40).</p>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Total Honorários (R$)</label>
                         <input type="number" name="totalFee" value={formData.totalFee || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white font-mono" placeholder="0.00" />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Status do Processo <span className="text-red-500">*</span></label>
                         <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="Pendente">Pendente</option>
                             <option value="Em Andamento">Em Andamento</option>
                             <option value="Concluído">Concluído</option>
                         </select>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Forma de Pagamento</label>
                         <select name="paymentMethod" value={formData.paymentMethod || 'Parcelado'} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                             <option value="À Vista">À Vista</option>
                             <option value="Parcelado">Parcelado</option>
                         </select>
                     </div>
                     
                     {formData.paymentMethod === 'Parcelado' && (
                         <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between gap-4">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Qtd. Parcelas</label>
                                 <select 
                                    name="installmentsCount" 
                                    value={formData.installmentsCount || 1} 
                                    onChange={(e) => setFormData({...formData, installmentsCount: Number(e.target.value)})} 
                                    className="w-32 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                                 >
                                     {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                         <option key={num} value={num}>{num}x</option>
                                     ))}
                                 </select>
                             </div>
                             <div className="text-right">
                                 <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase mb-1">Valor por Parcela</p>
                                 <p className="text-xl font-bold text-slate-800 dark:text-white font-mono">
                                     {formatCurrency(installmentValue)}
                                 </p>
                             </div>
                         </div>
                     )}

                     <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mt-2">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Registro de Pagamentos</h4>
                                <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 w-64">
                                    <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Pago: <span className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(totalPaid)}</span> • 
                                    Restante: <span className="text-red-500 dark:text-red-400 font-bold">{formatCurrency(remaining)}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 mb-4 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor</label>
                                <input type="number" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" placeholder="R$ 0,00" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Vencimento</label>
                                <input type="date" value={newPaymentDueDate} onChange={e => setNewPaymentDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm" />
                            </div>
                            <button type="button" onClick={handleAddPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition">
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {formData.payments && formData.payments.length > 0 ? (
                                formData.payments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded ${p.isPaid ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                                <BanknotesIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="block font-bold dark:text-slate-200">{formatCurrency(p.amount)}</span>
                                                <input 
                                                    type="date" 
                                                    value={p.dueDate || p.date || new Date().toISOString().split('T')[0]} 
                                                    onChange={(e) => {
                                                        const updatedPayments = formData.payments!.map(pay => pay.id === p.id ? {...pay, dueDate: e.target.value} : pay);
                                                        setFormData({...formData, payments: updatedPayments});
                                                    }}
                                                    className="text-[10px] text-slate-500 uppercase bg-transparent border-none p-0 focus:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => {
                                                const updatedPayments = formData.payments!.map(pay => pay.id === p.id ? {...pay, isPaid: !pay.isPaid} : pay);
                                                setFormData({...formData, payments: updatedPayments});
                                            }} className={`p-2 rounded-lg transition ${p.isPaid ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <CheckIcon className="h-4 w-4" />
                                            </button>
                                            <button type="button" onClick={() => handleRemovePayment(p.id)} className="text-slate-400 hover:text-red-500 transition">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-xs text-slate-400 py-2">Nenhum pagamento registrado.</p>
                            )}
                        </div>
                     </div>

                     <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition">Cancelar</button>
                        <button type="submit" className="px-5 py-2.5 text-white font-medium bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 transition flex items-center gap-2">
                            <CheckIcon className="h-5 w-5" />
                            Salvar Contrato
                        </button>
                     </div>
                </form>
            </div>
        </div>
    );
};

export default ContractModal;
