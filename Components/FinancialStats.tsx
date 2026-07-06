
import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, WalletIcon, BanknotesIcon, MagnifyingGlassIcon, ChartBarIcon, DocumentCheckIcon, DocumentTextIcon, ClockIcon, CurrencyDollarIcon, PresentationChartLineIcon } from '@heroicons/react/24/outline';
import { ContractRecord } from '../types';
import { formatCurrency } from '../utils';
import MonthlyDetailsModal from './MonthlyDetailsModal';

const FinancialStats = ({ contracts }: { contracts: ContractRecord[] }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentMonthStr = String(currentMonth).padStart(2, '0');
    
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [activeModalType, setActiveModalType] = useState<'revenue' | 'michel' | 'luana' | 'portfolio' | 'total_concluded' | null>(null);
    const [showExpanded, setShowExpanded] = useState(false);

    // Extrair anos disponíveis nos pagamentos e na criação dos contratos
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(currentYear);
        contracts.forEach(c => {
            if(c.payments) {
                c.payments.forEach(p => {
                    const refDate = p.dueDate || p.date;
                    if (refDate) {
                        const pYear = parseInt(refDate.split('-')[0]);
                        if (!isNaN(pYear)) years.add(pYear);
                    }
                });
                if (c.status === 'Concluído' && c.payments.length > 0) {
                    const sorted = [...c.payments].sort((a, b) => a.date.localeCompare(b.date));
                    const cYear = parseInt(sorted[0].date.split('-')[0]);
                    if (!isNaN(cYear)) years.add(cYear);
                }
            }
            if (c.createdAt) {
                const cYear = new Date(c.createdAt).getFullYear();
                if (!isNaN(cYear)) years.add(cYear);
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
        let totalConcludedValue = 0;
        
        // Expanded metrics
        let concludedCount = 0;
        let inProgressCount = 0;
        let pendingCount = 0;
        let paymentsReceivedCount = 0;
        let paymentsPendingCount = 0;
        
        let currentMonthReceivedValue = 0;
        let currentMonthExpectedValue = 0;

        contracts.forEach(c => {
            const responsible = c.lawyer;
            
            // Status counts (global, regardless of year to show total pipeline)
            if (c.status === 'Concluído') concludedCount++;
            else if (c.status === 'Em Andamento') inProgressCount++;
            else pendingCount++;
            
            // Valor Total de Concluídos
            if (c.status === 'Concluído') {
                const conclusionDateStr = c.concludedAt || c.createdAt;
                const conclusionYear = conclusionDateStr ? parseInt(conclusionDateStr.split('-')[0]) : currentYear;
                if (selectedYear === 0 || conclusionYear === selectedYear) {
                    totalConcludedValue += Number(c.totalFee || 0);
                }
            }
            
            // Portfolio Split
            (c.payments || []).forEach(p => {
                if (p.isPaid) return;
                
                const referenceDate = p.dueDate || p.date;
                if (!referenceDate) return;

                const parts = referenceDate.split('-');
                const pYear = parseInt(parts[0]);
                const pMonth = parts[1];
                
                // Count pending payments
                paymentsPendingCount++;
                
                // Current month expected
                if (pYear === currentYear && pMonth === currentMonthStr) {
                    currentMonthExpectedValue += Number(p.amount);
                }
                
                if (selectedYear === 0 || pYear === selectedYear) {
                    const amount = Number(p.amount);
                    totalPortfolio += amount;
                    
                    const split = (c.lawyerSplit ?? 60) / 100;
                    if (responsible === 'Michel') {
                        michelPortfolio += amount * split;
                        luanaPortfolio += amount * (1 - split);
                    } else if (responsible === 'Luana') {
                        luanaPortfolio += amount * split;
                        michelPortfolio += amount * (1 - split);
                    }
                }
            });

            // Yearly Cash Flow
            (c.payments || []).forEach(p => {
                if (!p.isPaid) return;
                
                const referenceDate = p.dueDate || p.date;
                if (!referenceDate) return;

                const parts = referenceDate.split('-');
                const pYear = parseInt(parts[0]);
                const pMonth = parts[1];
                
                // Count received payments
                paymentsReceivedCount++;
                
                // Current month received
                if (pYear === currentYear && pMonth === currentMonthStr) {
                    currentMonthReceivedValue += Number(p.amount);
                }
                
                if (selectedYear === 0 || pYear === selectedYear) {
                    const amount = Number(p.amount);
                    yearlyIncome += amount;
                    
                    const splitR = (c.lawyerSplit ?? 60) / 100;
                    if (responsible === 'Michel') {
                        michelIncome += amount * splitR;
                        luanaIncome += amount * (1 - splitR);
                    } else if (responsible === 'Luana') {
                        luanaIncome += amount * splitR;
                        michelIncome += amount * (1 - splitR);
                    }
                }
            });
        });

        return { 
            totalPortfolio, yearlyIncome, michelIncome, luanaIncome, michelPortfolio, luanaPortfolio, totalConcludedValue,
            concludedCount, inProgressCount, pendingCount,
            paymentsReceivedCount, paymentsPendingCount,
            currentMonthReceivedValue, currentMonthExpectedValue
        };
    }, [contracts, selectedYear, currentYear, currentMonthStr]);

    return (
        <div className="space-y-4 mb-6">
            <MonthlyDetailsModal 
                isOpen={!!activeModalType} 
                onClose={() => setActiveModalType(null)} 
                year={selectedYear} 
                contracts={contracts} 
                type={activeModalType} 
            />

            <div className="flex justify-between items-center bg-white/50 dark:bg-bordeaux-900/20 p-2 rounded-xl border border-slate-200 dark:border-gold-500/10">
                <button 
                    onClick={() => setShowExpanded(!showExpanded)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gold-200 bg-white dark:bg-bordeaux-800 rounded-lg shadow-sm border border-slate-200 dark:border-gold-500/20 hover:bg-slate-50 dark:hover:bg-bordeaux-700 transition-colors"
                >
                    <PresentationChartLineIcon className="w-4 h-4" />
                    {showExpanded ? 'Ocultar Painel Detalhado' : 'Painel de Insights Padrão Ouro'}
                </button>
                <div className="relative inline-block">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="appearance-none bg-white dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 text-slate-700 dark:text-slate-200 py-2 pl-4 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                    >
                        <option value={0}>Todo o Período</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <ChevronDownIcon className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Main Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div 
                    onClick={() => setActiveModalType('total_concluded')}
                    className="bg-white dark:bg-bordeaux-900/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15 relative overflow-hidden group cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-md"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BanknotesIcon className="h-24 w-24 text-blue-600" />
                    </div>
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor Total ({selectedYear === 0 ? 'Tudo' : selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(stats.totalConcludedValue)}</p>
                    <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                        <span>Total dos processos concluídos</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveModalType('portfolio')}
                    className="bg-white dark:bg-bordeaux-900/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15 relative overflow-hidden group cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-md"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <WalletIcon className="h-24 w-24 text-indigo-600" />
                    </div>
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor em Carteira ({selectedYear === 0 ? 'Tudo' : selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.totalPortfolio)}</p>
                    <div className="mt-3 text-[10px] text-slate-400 flex justify-between">
                        <span>Potencial a receber</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveModalType('revenue')}
                    className="bg-white dark:bg-bordeaux-900/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15 relative overflow-hidden group cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-md"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BanknotesIcon className="h-24 w-24 text-green-600" />
                    </div>
                    <div className="flex justify-between items-start">
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Receita ({selectedYear === 0 ? 'Tudo' : selectedYear})</p>
                         <MagnifyingGlassIcon className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-extrabold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.yearlyIncome)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Total recebido no período</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('michel')}
                    className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Lucro Dr. Michel ({selectedYear === 0 ? 'Tudo' : selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.michelIncome)}</p>
                    <p className="text-[10px] text-blue-200 mt-1">Divisão de lucros no período</p>
                </div>

                <div 
                    onClick={() => setActiveModalType('luana')}
                    className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg shadow-purple-500/20 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                >
                     <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-purple-200 uppercase tracking-wide">Lucro Dra. Luana ({selectedYear === 0 ? 'Tudo' : selectedYear})</p>
                        <MagnifyingGlassIcon className="h-4 w-4 text-white opacity-60" />
                    </div>
                    <p className="text-2xl font-extrabold mt-1">{formatCurrency(stats.luanaIncome)}</p>
                    <p className="text-[10px] text-purple-200 mt-1">Divisão de lucros no período</p>
                </div>
            </div>

            {/* Expanded Dashboard Row */}
            {showExpanded && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Pipeline de Contratos */}
                    <div className="bg-white dark:bg-bordeaux-900/40 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-gold-200">
                            <DocumentTextIcon className="w-5 h-5" />
                            <h3 className="font-semibold">Pipeline de Contratos (Global)</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600 dark:text-slate-300">Concluídos</span>
                                    <span className="font-bold text-green-600 dark:text-green-400">{stats.concludedCount}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.concludedCount / Math.max(contracts.length, 1)) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600 dark:text-slate-300">Em Andamento</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{stats.inProgressCount}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.inProgressCount / Math.max(contracts.length, 1)) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600 dark:text-slate-300">Pendentes</span>
                                    <span className="font-bold text-amber-500 dark:text-amber-400">{stats.pendingCount}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.pendingCount / Math.max(contracts.length, 1)) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Faturamento do Mês Atual */}
                    <div className="bg-white dark:bg-bordeaux-900/40 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-gold-200">
                            <ChartBarIcon className="w-5 h-5" />
                            <h3 className="font-semibold">Desempenho ({currentMonthStr}/{currentYear})</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 h-[calc(100%-2rem)]">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg flex flex-col justify-center border border-slate-100 dark:border-slate-700/50">
                                <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">Previsto no Mês</span>
                                <span className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(stats.currentMonthExpectedValue)}</span>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex flex-col justify-center border border-green-100 dark:border-green-800/30">
                                <span className="text-xs text-green-600 dark:text-green-400 mb-1">Recebido no Mês</span>
                                <span className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.currentMonthReceivedValue)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Volume de Parcelas */}
                    <div className="bg-white dark:bg-bordeaux-900/40 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-gold-200">
                            <CurrencyDollarIcon className="w-5 h-5" />
                            <h3 className="font-semibold">Volume de Parcelas</h3>
                        </div>
                        <div className="flex items-center justify-center gap-8 h-[calc(100%-2rem)]">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 mb-2">
                                    <DocumentCheckIcon className="w-6 h-6" />
                                </div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.paymentsReceivedCount}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Recebidas</div>
                            </div>
                            <div className="w-px h-16 bg-slate-200 dark:bg-slate-700"></div>
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mb-2">
                                    <ClockIcon className="w-6 h-6" />
                                </div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.paymentsPendingCount}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">A Receber</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialStats;
