
import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, WalletIcon, BanknotesIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ContractRecord } from '../types';
import { formatCurrency } from '../utils';
import MonthlyDetailsModal from './MonthlyDetailsModal';

const FinancialStats = ({ contracts }: { contracts: ContractRecord[] }) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [activeModalType, setActiveModalType] = useState<'revenue' | 'michel' | 'luana' | null>(null);

    // Extrair anos disponíveis nos pagamentos
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(currentYear);
        contracts.forEach(c => {
            if(c.payments) {
                c.payments.forEach(p => {
                    years.add(new Date(p.date).getFullYear());
                });
            }
        });
        return Array.from(years).sort((a, b) => b - a); // Decrescente
    }, [contracts, currentYear]);

    const stats = useMemo(() => {
        let totalPortfolio = 0;
        let yearlyIncome = 0;
        let michelIncome = 0;
        let luanaIncome = 0;
        let michelPortfolio = 0;
        let luanaPortfolio = 0;

        contracts.forEach(c => {
            const contractTotal = Number(c.totalFee) || 0;
            const responsible = c.lawyer;

            // Portfolio Split (Potencial Total)
            if (c.status === 'Concluído') {
                totalPortfolio += contractTotal;
                if (responsible === 'Michel') {
                    michelPortfolio += contractTotal * 0.6;
                    luanaPortfolio += contractTotal * 0.4;
                } else if (responsible === 'Luana') {
                    luanaPortfolio += contractTotal * 0.6;
                    michelPortfolio += contractTotal * 0.4;
                }
            }

            // Yearly Cash Flow (Baseado nos pagamentos realizados)
            (c.payments || []).forEach(p => {
                if (!p.isPaid) return;
                
                // Fix timezone issue by parsing date manually or setting time to noon
                // Here assuming date string YYYY-MM-DD
                const parts = p.date.split('-');
                const pYear = parseInt(parts[0]);
                
                if (pYear === selectedYear) {
                    const amount = Number(p.amount);
                    yearlyIncome += amount;
                    
                    if (responsible === 'Michel') {
                        michelIncome += amount * 0.6;
                        luanaIncome += amount * 0.4;
                    } else if (responsible === 'Luana') {
                        luanaIncome += amount * 0.6;
                        michelIncome += amount * 0.4;
                    }
                }
            });
        });

        return { totalPortfolio, yearlyIncome, michelIncome, luanaIncome, michelPortfolio, luanaPortfolio };
    }, [contracts, selectedYear]);

    return (
        <div className="space-y-4 mb-6">
            <MonthlyDetailsModal 
                isOpen={!!activeModalType} 
                onClose={() => setActiveModalType(null)} 
                year={selectedYear} 
                contracts={contracts} 
                type={activeModalType} 
            />

            <div className="flex justify-end">
                <div className="relative inline-block">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-1.5 pl-4 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <ChevronDownIcon className="h-3 w-3" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <WalletIcon className="h-24 w-24 text-indigo-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor em Carteira (Total)</p>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.totalPortfolio)}</p>
                    <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                        <span>Potencial a receber (Tudo)</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveModalType('revenue')}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-md"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BanknotesIcon className="h-24 w-24 text-green-600" />
                    </div>
                    <div className="flex justify-between items-start">
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Receita ({selectedYear})</p>
                         <MagnifyingGlassIcon className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-extrabold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.yearlyIncome)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Total recebido no ano selecionado</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('michel')}
                    className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Lucro Dr. Michel ({selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.michelIncome)}</p>
                    <p className="text-[10px] text-blue-200 mt-1">Divisão de lucros no ano</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('luana')}
                    className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg shadow-purple-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                     <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">Lucro Dra. Luana ({selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.luanaIncome)}</p>
                    <p className="text-[10px] text-purple-200 mt-1">Divisão de lucros no ano</p>
                </div>
            </div>
        </div>
    );
};

export default FinancialStats;
