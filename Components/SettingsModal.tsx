
import React, { useState, useEffect } from 'react';
import { CloudIcon, CheckIcon, ExclamationTriangleIcon, ArchiveBoxArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getDbConfig, DB_CONFIG_KEY, validateSupabaseConnection } from '../supabaseClient';
import { safeSetLocalStorage, getMinWage, setMinWage } from '../utils';

const SettingsModal = ({ isOpen, onClose, onSave, onRestoreBackup }: { isOpen: boolean, onClose: () => void, onSave: () => void, onRestoreBackup: () => void }) => {
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [isEnvManaged, setIsEnvManaged] = useState(false);
    const [minWage, setMinWageState] = useState(1621.00);
    const [testStatus, setTestStatus] = useState<{ loading: boolean, success?: boolean, message?: string } | null>(null);

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

    const handleTestConnection = async () => {
        setTestStatus({ loading: true });
        
        // Se for manual, salva temporariamente no localStorage para o initSupabase ler
        if (!isEnvManaged) {
            safeSetLocalStorage(DB_CONFIG_KEY, JSON.stringify({ url, key }));
        }

        const result = await validateSupabaseConnection();
        setTestStatus({ loading: false, success: result.success, message: result.message });
        
        if (result.success) {
            setTimeout(() => setTestStatus(null), 3000);
        }
    };

    const handleCleanupHeavyData = async () => {
        if (!confirm("Esta ação irá remover o conteúdo integral de texto dos documentos das conversas de IA para reduzir o tamanho do banco de dados. Os resumos e o histórico de mensagens serão preservados. Deseja continuar?")) {
            return;
        }

        setTestStatus({ loading: true, message: 'Otimizando banco de dados...' });
        try {
            const { supabaseService } = await import('../services/supabaseService');
            const michelSessions = await supabaseService.getAIConversations('michel');
            const luanaSessions = await supabaseService.getAIConversations('luana');
            
            const allSessions = [...michelSessions, ...luanaSessions];
            let count = 0;

            for (const session of allSessions) {
                const hasFullText = session.documents?.some((d: any) => d.fullText);
                const hasLongMessages = session.messages?.some((m: any) => m.content.length > 50000);

                if (hasFullText || hasLongMessages) {
                    const sanitized = {
                        ...session,
                        documents: session.documents?.map((d: any) => ({ ...d, fullText: undefined })),
                        messages: session.messages?.map((m: any) => {
                            if (m.content.length > 50000) {
                                return { ...m, content: m.content.substring(0, 50000) + '... [Truncado]' };
                            }
                            return m;
                        })
                    };
                    await supabaseService.saveAIConversation({
                        ...sanitized,
                        ai_name: session.ai_name || (michelSessions.includes(session) ? 'michel' : 'luana')
                    });
                    count++;
                }
            }

            setTestStatus({ loading: false, success: true, message: `Limpeza concluída! ${count} sessões otimizadas.` });
            setTimeout(() => setTestStatus(null), 5000);
        } catch (error) {
            console.error("Cleanup failed:", error);
            setTestStatus({ loading: false, success: false, message: "Erro ao realizar limpeza. Verifique a conexão." });
        }
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
                        <div className="relative">
                            <input type="password" value={key} onChange={e => setKey(e.target.value)} disabled={isEnvManaged} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed font-mono text-slate-600 dark:text-slate-300" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." />
                            <button 
                                onClick={handleTestConnection}
                                disabled={testStatus?.loading || !url || !key}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition disabled:opacity-30"
                                title="Testar Conexão"
                            >
                                <ArrowPathIcon className={`h-4 w-4 ${testStatus?.loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {testStatus && (
                    <div className={`mt-4 p-3 rounded-lg text-xs border ${testStatus.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <p className="font-bold">{testStatus.success ? "Sucesso!" : "Erro de Conexão:"}</p>
                        <p className="mt-0.5">{testStatus.message}</p>
                    </div>
                )}
                
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <button onClick={handleCleanupHeavyData} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg text-sm font-medium transition border border-amber-200 dark:border-amber-800">
                        <ArchiveBoxArrowDownIcon className="h-4 w-4" /> Otimizar Banco (Limpar Cache AI)
                    </button>
                    <button onClick={handleRestore} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition">
                        <ArchiveBoxArrowDownIcon className="h-4 w-4" /> Restaurar Dados Iniciais (Backup)
                    </button>
                    <p className="text-[10px] text-center text-slate-400">Use isto caso a tabela esteja vazia (0 registros).</p>
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
