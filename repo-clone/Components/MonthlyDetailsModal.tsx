
import React, { useMemo } from 'react';
import { XMarkIcon, CalendarDaysIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { MonthlyDetailsModalProps } from '../types';
import { formatCurrency } from '../utils';

const MonthlyDetailsModal: React.FC<MonthlyDetailsModalProps> = ({ isOpen, onClose, year, contracts, type }) => {
    const monthlyData = useMemo(() => {
        if (!type) return [];
        
        // 12 months array (0-11)
        const data = Array(12).fill(null).map(() => ({ total: 0, payments: [] as { client: string, day: string, amount: number, fullAmount: number }[] }));

        contracts.forEach(contract => {
            (contract.payments || []).forEach(payment => {
                const parts = payment.date.split('-'); // YYYY-MM-DD
                const pYear = parseInt(parts[0]);
                const pMonth = parseInt(parts[1]) - 1; 

                if (pYear === year && pMonth >= 0 && pMonth < 12) {
                    let amount = payment.amount;
                    let displayAmount = amount;

                    // Apply Split Logic
                    if (type === 'michel') {
                        if (contract.lawyer === 'Michel') displayAmount = amount * 0.6;
                        else displayAmount = amount * 0.4;
                    } else if (type === 'luana') {
                         if (contract.lawyer === 'Luana') displayAmount = amount * 0.6;
                        else displayAmount = amount * 0.4;
                    }
                    
                    if (displayAmount > 0) {
                        data[pMonth].total += displayAmount;
                        data[pMonth].payments.push({
                            client: `${contract.firstName} ${contract.lastName}`,
                            day: parts[2],
                            amount: displayAmount,
                            fullAmount: amount
                        });
                    }
                }
            });
        });
        return data;
    }, [contracts, year, type]);

    if (!isOpen || !type) return null;

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const getTitle = () => {
        if (type === 'revenue') return `Receita Total - ${year}`;
        if (type === 'michel') return `Lucro Dr. Michel - ${year}`;
        if (type === 'luana') return `Lucro Dra. Luana - ${year}`;
        return '';
    };

    const getThemeColor = () => {
        if (type === 'revenue') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (type === 'michel') return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
        if (type === 'luana') return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
        return '';
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div>
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white">{getTitle()}</h3>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Detalhamento mensal dos pagamentos recebidos</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg transition">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-6 space-y-4">
                    {monthlyData.map((month, idx) => {
                        if (month.total === 0) return null;
                        return (
                            <div key={idx} className={`rounded-xl border p-4 ${getThemeColor()}`}>
                                <div className="flex justify-between items-center mb-3 border-b border-black/5 dark:border-white/10 pb-2">
                                    <h4 className="font-bold uppercase tracking-wide text-sm flex items-center gap-2">
                                        <CalendarDaysIcon className="h-4 w-4" />
                                        {monthNames[idx]}
                                    </h4>
                                    <span className="font-mono font-bold text-lg">{formatCurrency(month.total)}</span>
                                </div>
                                <div className="space-y-1.5 pl-2">
                                    {month.payments.map((p, pIdx) => (
                                        <div key={pIdx} className="flex justify-between text-xs items-center">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                {p.day}/{String(idx + 1).padStart(2, '0')} - {p.client}
                                            </span>
                                            <span className="font-mono opacity-80">{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    {monthlyData.every(m => m.total === 0) && (
                        <div className="text-center py-10 text-slate-400">
                            <BanknotesIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum pagamento registrado neste ano para esta categoria.</p>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
}

export default MonthlyDetailsModal;
