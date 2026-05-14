
import React from 'react';
import { BellAlertIcon, XMarkIcon, ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { NotificationItem } from '../types';

const NotificationsModal = ({ isOpen, onClose, notifications, onResolve }: { isOpen: boolean, onClose: () => void, notifications: NotificationItem[], onResolve: (id: string) => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-end z-[90] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 mt-16 mr-0 md:mr-4 overflow-hidden animate-in slide-in-from-right duration-200">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                         <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg text-orange-600 dark:text-orange-400">
                             <BellAlertIcon className="h-5 w-5" />
                         </div>
                         <h3 className="font-bold text-slate-800 dark:text-white">Alertas Urgentes</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                            <CheckIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma pendência urgente para os próximos 15 dias.</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {notifications.map((notif, idx) => (
                                <li key={`${notif.id}-${idx}`} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50 group relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1 pr-8">{notif.clientName}</span>
                                        <span className="text-[10px] font-mono bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/30">
                                            {notif.date}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-orange-500" />
                                        {notif.type}
                                    </p>
                                    
                                    <button 
                                        onClick={() => onResolve(notif.id)}
                                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-all duration-200"
                                        title="Marcar como resolvido"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Alertas para hoje e próximos 15 dias</p>
                </div>
            </div>
        </div>
    );
}

export default NotificationsModal;
