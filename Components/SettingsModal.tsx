
import React, { useState, useEffect } from 'react';
import { CloudIcon, CheckIcon, ExclamationTriangleIcon, ArchiveBoxArrowDownIcon } from '@heroicons/react/24/outline';
import { getDbConfig, DB_CONFIG_KEY } from '../supabaseClient';
import { safeSetLocalStorage, getMinWage, setMinWage } from '../utils';

const SettingsModal = ({ isOpen, onClose, onSave, onRestoreBackup }: { isOpen: boolean, onClose: () => void, onSave: () => void, onRestoreBackup: () => void }) => {
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [isEnvManaged, setIsEnvManaged] = useState(false);
    const [minWage, setMinWageState] = useState(1621.00);

    useEffect(() => {
        if (isOpen) {
            const config = getDbConfig();
            if (config) {
                setUrl(config.url || '');
                setKey(config.key || '');
                setIsEnvManaged(!!config.isEnv);
            }
            setMinWageState(getMinWage());
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!isEnvManaged) {
            safeSetLocalStorage(DB_CONFIG_KEY, JSON.stringify({ url, key }));
        }
        setMinWage(minWage);
        onSave();
        onClose();
    };

    const handleClear = () => {
        if(confirm("Isso desconectará o banco de dados. Deseja continuar?")) {
            localStorage.removeItem(DB_CONFIG_KEY);
            setUrl('');
            setKey('');
            setIsEnvManaged(false);
            onSave();
            onClose();
        }
    };
    
    const handleRestore = () => {
        if (confirm("ATENÇÃO: Isso irá apagar os dados atuais da nuvem e substituí-los pelos dados originais de backup (data.ts). Tem certeza?")) {
            onRestoreBackup();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg text-primary-600 dark:text-primary-400">
                        <CloudIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Conexão Nuvem</h3>
                        <p className="text-xs text-slate-500">Sincronize dados entre computadores</p>
                    </div>
                </div>

                {url && key ? (
                    <div className="mb-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-start gap-3">
                        <CheckIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">Conectado à Nuvem!</p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {isEnvManaged ? "Configuração automática ativa." : "Conexão manual estabelecida."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Modo Local (Offline)</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Para ativar o modo online, insira as chaves abaixo.</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Salário Mínimo Vigente (R$)</label>
                        <input type="number" step="0.01" value={minWage} onChange={e => setMinWageState(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="1621.00" />
                        <p className="text-[10px] text-slate-400 mt-1">Usado para definir o rito processual (Sumário, Sumaríssimo, Ordinário).</p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supabase URL</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} disabled={isEnvManaged} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono text-slate-600 dark:text-slate-300" placeholder="https://xyz.supabase.co" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supabase Anon Key</label>
                        <input type="password" value={key} onChange={e => setKey(e.target.value)} disabled={isEnvManaged} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono text-slate-600 dark:text-slate-300" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." />
                    </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={handleRestore} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition">
                        <ArchiveBoxArrowDownIcon className="h-4 w-4" /> Restaurar Dados Iniciais (Backup)
                    </button>
                    <p className="text-[10px] text-center text-slate-400 mt-2">Use isto caso a tabela esteja vazia (0 registros).</p>
                </div>

                <div className="flex gap-3 mt-6">
                    {!isEnvManaged && url && key && <button onClick={handleClear} className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition">Desconectar</button>}
                    <div className="flex-1 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition">Cancelar</button>
                        {!isEnvManaged && <button onClick={handleSave} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary-500/30 transition">Salvar & Conectar</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
