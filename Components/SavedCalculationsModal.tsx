import React, { useState, useEffect } from 'react';
import { XCircleIcon, TrashIcon, FolderOpenIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SocialSecurityData } from '../SocialSecurityCalc';
import { supabaseService } from '../services/supabaseService';
import { safeSetLocalStorage } from '../utils';

interface SavedCalculationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (data: SocialSecurityData) => void;
    savedCalculations?: SavedCalculation[];
    onUpdateCalculations?: (list: SavedCalculation[]) => void;
}

interface SavedCalculation {
    id: string;
    date: string;
    clientName: string;
    data: SocialSecurityData;
}

const SavedCalculationsModal: React.FC<SavedCalculationsModalProps> = ({ 
    isOpen, 
    onClose, 
    onLoad,
    savedCalculations,
    onUpdateCalculations
}) => {
    const [calculations, setCalculations] = useState<SavedCalculation[]>(savedCalculations || []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (savedCalculations) {
                setCalculations(savedCalculations);
            } else {
                loadCalculations();
            }
        }
    }, [isOpen, savedCalculations]);

    const loadCalculations = async () => {
        try {
            const dbCalcs = await supabaseService.getCalculations();
            if (dbCalcs && dbCalcs.length > 0) {
                setCalculations(dbCalcs);
            } else {
                // Fallback to local
                const saved = localStorage.getItem('social_security_calculations');
                if (saved) {
                    setCalculations(JSON.parse(saved));
                }
            }
        } catch (error) {
            console.error("Erro ao carregar cálculos:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cálculo?")) {
            try {
                await supabaseService.deleteCalculation(id);
                const newCalculations = calculations.filter(c => c.id !== id);
                setCalculations(newCalculations);
                if (onUpdateCalculations) {
                    onUpdateCalculations(newCalculations);
                } else {
                    safeSetLocalStorage('social_security_calculations', JSON.stringify(newCalculations));
                }
            } catch (error) {
                console.error("Erro ao excluir cálculo do Supabase:", error);
                alert("Erro ao excluir cálculo do banco de dados.");
            }
        }
    };

    const handleLoad = (calc: SavedCalculation) => {
        console.log("SavedCalculationsModal: handleLoad called for", calc.clientName);
        if (!calc.data) {
            console.warn("Cálculo sem dados válidos");
            alert("Este cálculo não possui dados válidos para carregar.");
            return;
        }
        
        try {
            onLoad(calc.data);
            onClose();
        } catch (error) {
            console.error("Erro ao carregar cálculo no componente pai:", error);
            alert("Ocorreu um erro ao tentar carregar este cálculo. Verifique o console para mais detalhes.");
        }
    };

    const startEditing = (calc: SavedCalculation) => {
        setEditingId(calc.id);
        setEditName(calc.clientName);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEditing = async (id: string) => {
        const targetCalc = calculations.find(c => c.id === id);
        if (!targetCalc) return;

        const updatedCalc = { ...targetCalc, clientName: editName, data: { ...targetCalc.data, clientName: editName } };
        
        try {
            await supabaseService.saveCalculation(updatedCalc);
            const newCalculations = calculations.map(c => c.id === id ? updatedCalc : c);
            setCalculations(newCalculations);
            if (onUpdateCalculations) {
                onUpdateCalculations(newCalculations);
            } else {
                safeSetLocalStorage('social_security_calculations', JSON.stringify(newCalculations));
            }
            setEditingId(null);
            setEditName('');
        } catch (error) {
            console.error("Error updating calculation in Supabase:", error);
            alert("Erro ao atualizar nome no banco de dados.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FolderOpenIcon className="h-5 w-5 text-indigo-500" />
                            Cálculos Salvos
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Gerencie seus cálculos previdenciários salvos localmente.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-900/50">
                    {calculations.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <p>Nenhum cálculo salvo encontrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {calculations.map((calc) => (
                                <div 
                                    key={calc.id} 
                                    onClick={() => editingId !== calc.id && handleLoad(calc)}
                                    className={`bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex justify-between items-center group ${editingId !== calc.id ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700' : ''}`}
                                >
                                    <div className="flex-1 mr-4">
                                        {editingId === calc.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveEditing(calc.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                    <CheckIcon className="h-5 w-5" />
                                                </button>
                                                <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                    <XMarkIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                                                    {calc.clientName || "Cliente Sem Nome"}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Salvo em: {new Date(calc.date).toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    Vínculos: {calc.data?.bonds?.length ?? 0} | DER: {calc.data?.der ?? 'N/A'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    
                                    {editingId !== calc.id && (
                                        <div className="flex gap-2 opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLoad(calc);
                                                }}
                                                className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                                                title="Abrir"
                                            >
                                                <FolderOpenIcon className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEditing(calc);
                                                }}
                                                className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
                                                title="Editar Nome"
                                            >
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(calc.id);
                                                }}
                                                className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavedCalculationsModal;
