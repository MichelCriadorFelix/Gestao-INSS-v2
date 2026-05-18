
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

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <UserGroupIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Total Clientes</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                    <DocumentTextIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Casos BPC</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.bpc}</p>
                </div>
            </div>
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                    <ScaleIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Auxílios</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.aux}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg">
                    <StarIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Prioridades</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.priority}</p>
                </div>
            </div>
            <button 
                onClick={onOpenAgenda}
                className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:border-primary-500 transition"
            >
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg">
                    <CalendarIcon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Próximos Compromissos</p>
                    <p className="text-sm font-bold text-primary-600 dark:text-primary-400">Ver Agenda</p>
                </div>
            </button>
        </div>
    )
}

export default StatsCards;
