
import React, { useMemo } from 'react';
import { UserGroupIcon, DocumentTextIcon, ScaleIcon, StarIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { ClientRecord } from '../types';

const StatsCards = ({ records, onOpenAgenda }: { records: ClientRecord[], onOpenAgenda: () => void }) => {
    const stats = useMemo(() => {
        const total = records.length;
        const bpc = records.filter(r => r.type?.toLowerCase().includes('bpc')).length;
        const aux = records.filter(r => r.type?.toLowerCase().includes('aux')).length;
        const priority = records.filter(r => r.isDailyAttention).length;
        return { total, bpc, aux, priority };
    }, [records]);

    const cardBase = "relative bg-white dark:bg-bordeaux-950/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gold-500/15 flex items-center gap-4 transition hover:shadow-md hover:border-gold-500/40 overflow-hidden";

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className={cardBase}>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></span>
                <div className="p-3 bg-primary-50 dark:bg-bordeaux-900/40 text-primary-700 dark:text-gold-300 rounded-lg ring-1 ring-primary-200/50 dark:ring-gold-500/20">
                    <UserGroupIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 dark:text-cream-100/60 font-semibold uppercase tracking-wider">Total Clientes</p>
                    <p className="text-2xl font-serif font-semibold text-slate-800 dark:text-cream-50">{stats.total}</p>
                </div>
            </div>
            <div className={cardBase}>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></span>
                <div className="p-3 bg-primary-50 dark:bg-bordeaux-900/40 text-primary-700 dark:text-gold-300 rounded-lg ring-1 ring-primary-200/50 dark:ring-gold-500/20">
                    <DocumentTextIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 dark:text-cream-100/60 font-semibold uppercase tracking-wider">Casos BPC</p>
                    <p className="text-2xl font-serif font-semibold text-slate-800 dark:text-cream-50">{stats.bpc}</p>
                </div>
            </div>
             <div className={cardBase}>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></span>
                <div className="p-3 bg-primary-50 dark:bg-bordeaux-900/40 text-primary-700 dark:text-gold-300 rounded-lg ring-1 ring-primary-200/50 dark:ring-gold-500/20">
                    <ScaleIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 dark:text-cream-100/60 font-semibold uppercase tracking-wider">Auxílios</p>
                    <p className="text-2xl font-serif font-semibold text-slate-800 dark:text-cream-50">{stats.aux}</p>
                </div>
            </div>
            <div className={cardBase}>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></span>
                <div className="p-3 bg-gold-50 dark:bg-gold-500/10 text-gold-700 dark:text-gold-300 rounded-lg ring-1 ring-gold-300/50 dark:ring-gold-500/20">
                    <StarIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 dark:text-cream-100/60 font-semibold uppercase tracking-wider">Prioridades</p>
                    <p className="text-2xl font-serif font-semibold text-slate-800 dark:text-cream-50">{stats.priority}</p>
                </div>
            </div>
            <button 
                onClick={onOpenAgenda}
                className={`${cardBase} hover:bg-cream-50 dark:hover:bg-bordeaux-900/60 cursor-pointer text-left`}
            >
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></span>
                <div className="p-3 bg-primary-50 dark:bg-bordeaux-900/40 text-primary-700 dark:text-gold-300 rounded-lg ring-1 ring-primary-200/50 dark:ring-gold-500/20">
                    <CalendarIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 dark:text-cream-100/60 font-semibold uppercase tracking-wider">Próximos Compromissos</p>
                    <p className="text-sm font-bold text-primary-700 dark:text-gold-300">Ver Agenda →</p>
                </div>
            </button>
        </div>
    )
}

export default StatsCards;
