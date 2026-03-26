
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, CameraIcon, PhotoIcon, ArrowsPointingOutIcon, CheckIcon, DocumentDuplicateIcon, TrashIcon, PlusIcon, ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";
import { ScannedDocument, ScannerModalProps } from '../types';

const DOCUMENT_TYPES = [
    "Identidade", "CPF", "Comprovante de residência", "Laudos", 
    "Exames/Documentos médicos", "Carteira de Trabalho", 
    "Perfil Profissiográfico (PPP)", "Contra-cheques", 
    "Prints de Conversa no Whatsapp", "Termo de Rescisão",
    "Certidão de Nascimento", "Certidão de Casamento", 
    "Certidão de Óbito", "Outro Documento"
];

const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onSave }) => {
    const [step, setStep] = useState<'select' | 'crop' | 'preview'>('select');
    const [docType, setDocType] = useState('');
    
    const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
    const [pages, setPages] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 }); 
    const [rotation, setRotation] = useState(0);
    const [dragHandle, setDragHandle] = useState<string | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setStep('select');
            setDocType('');
            setCurrentImageSrc(null);
            setPages([]);
            setCrop({ x: 10, y: 10, w: 80, h: 80 });
            setRotation(0);
        }
    }, [isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setCurrentImageSrc(ev.target.result.toString());
                    setStep('crop');
                    setCrop({ x: 10, y: 10, w: 80, h: 80 });
                    setRotation(0);
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, handle: string) => {
        e.stopPropagation();
        setDragHandle(handle);
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!dragHandle || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

        setCrop(prev => {
            let newCrop = { ...prev };
            
            if (dragHandle === 'tl') {
                const right = prev.x + prev.w;
                const bottom = prev.y + prev.h;
                newCrop.x = Math.min(xPct, right - 10);
                newCrop.y = Math.min(yPct, bottom - 10);
                newCrop.w = right - newCrop.x;
                newCrop.h = bottom - newCrop.y;
            } else if (dragHandle === 'br') {
                newCrop.w = Math.max(10, xPct - prev.x);
                newCrop.h = Math.max(10, yPct - prev.y);
            } else if (dragHandle === 'tr') {
                const bottom = prev.y + prev.h;
                newCrop.y = Math.min(yPct, bottom - 10);
                newCrop.h = bottom - newCrop.y;
                newCrop.w = Math.max(10, xPct - prev.x);
            } else if (dragHandle === 'bl') {
                const right = prev.x + prev.w;
                newCrop.x = Math.min(xPct, right - 10);
                newCrop.w = right - newCrop.x;
                newCrop.h = Math.max(10, yPct - prev.y);
            }

            return newCrop;
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragHandle) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragHandle) {
            e.preventDefault(); 
            handleMove(e.clientX, e.clientY);
        }
    };

    const handleEnd = () => {
        setDragHandle(null);
    };

    const confirmCrop = () => {
        if (!currentImageSrc || !imgRef.current || !containerRef.current) return;

        const image = imgRef.current;
        const container = containerRef.current;

        const contW = container.clientWidth;
        const contH = container.clientHeight;
        const natW = image.naturalWidth;
        const natH = image.naturalHeight;

        const imgRatio = natW / natH;
        const contRatio = contW / contH;
        
        let rendW, rendH, offX, offY;

        if (imgRatio > contRatio) {
            rendW = contW;
            rendH = contW / imgRatio;
            offX = 0;
            offY = (contH - rendH) / 2;
        } else {
            rendH = contH;
            rendW = contH * imgRatio;
            offX = (contW - rendW) / 2;
            offY = 0;
        }

        const cropBoxX = (crop.x / 100) * contW;
        const cropBoxY = (crop.y / 100) * contH;
        const cropBoxW = (crop.w / 100) * contW;
        const cropBoxH = (crop.h / 100) * contH;

        let startX = cropBoxX - offX;
        let startY = cropBoxY - offY;
        let finalW = cropBoxW;
        let finalH = cropBoxH;

        const scale = natW / rendW;

        const sourceX = startX * scale;
        const sourceY = startY * scale;
        const sourceW = finalW * scale;
        const sourceH = finalH * scale;

        const canvas = document.createElement('canvas');
        
        // Ajustar dimensões baseado na rotação
        const isRotated = rotation === 90 || rotation === 270;
        
        const MAX_DIMENSION = 1600; 
        let targetW = isRotated ? sourceH : sourceW;
        let targetH = isRotated ? sourceW : sourceH;

        if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
            const ratio = targetW / targetH;
            if (targetW > targetH) {
                targetW = MAX_DIMENSION;
                targetH = MAX_DIMENSION / ratio;
            } else {
                targetH = MAX_DIMENSION;
                targetW = MAX_DIMENSION * ratio;
            }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Resetar transformações
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            // Rotacionar o canvas
            if (rotation === 90) {
                ctx.translate(targetW, 0);
                ctx.rotate(Math.PI / 2);
            } else if (rotation === 180) {
                ctx.translate(targetW, targetH);
                ctx.rotate(Math.PI);
            } else if (rotation === 270) {
                ctx.translate(0, targetH);
                ctx.rotate((3 * Math.PI) / 2);
            }
            
            ctx.drawImage(
                image, 
                sourceX, sourceY, sourceW, sourceH,
                0, 0, isRotated ? targetH : targetW, isRotated ? targetW : targetH
            );
            
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            
            setPages(prev => [...prev, base64]);
            setCurrentImageSrc(null);
            setStep('preview');
        }
    };

    const handleFinalizePDF = async () => {
        if (pages.length === 0) return;
        setIsProcessing(true);

        try {
            // @ts-ignore
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();
                
                const imgData = pages[i];
                
                const imgProps = pdf.getImageProperties(imgData);
                const imgRatio = imgProps.width / imgProps.height;
                
                let w = pdfWidth - 20;
                let h = w / imgRatio;
                
                if (h > (pdfHeight - 20)) {
                    h = pdfHeight - 20;
                    w = h * imgRatio;
                }
                
                const x = (pdfWidth - w) / 2;
                const y = 10;

                pdf.addImage(imgData, 'JPEG', x, y, w, h);
            }

            const pdfBase64 = pdf.output('datauristring');
            
            const newDoc: ScannedDocument = {
                id: Math.random().toString(36).substr(2, 9),
                name: docType || 'Documento Digitalizado',
                type: 'application/pdf',
                url: pdfBase64,
                date: new Date().toLocaleDateString('pt-BR')
            };
            
            onSave(newDoc);
            onClose();

        } catch (error) {
            console.error("Erro detalhado ao gerar PDF:", error);
            // Tentar mostrar o erro na tela de forma mais visível para celular
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            alert(`Erro ao gerar PDF: ${errorMessage}. Detalhes: ${JSON.stringify(error)}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200"
            onMouseUp={handleEnd}
            onTouchEnd={handleEnd}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-4 bg-primary-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg">Scanner de Documentos</h3>
                        <p className="text-xs text-primary-200">
                            {step === 'select' ? '1. Selecione a fonte' : 
                             step === 'crop' ? '2. Recorte a imagem' : 
                             '3. Revisão e PDF'}
                        </p>
                    </div>
                    <button onClick={onClose}><XMarkIcon className="h-6 w-6 text-white/80 hover:text-white" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                    {step === 'select' && (
                        <div className="flex-1 flex flex-col justify-center space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Documento</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                >
                                    <option value="">Selecione o tipo...</option>
                                    {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => {
                                        if(!docType) { alert("Selecione o tipo de documento primeiro."); return; }
                                        cameraInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                                >
                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full group-hover:scale-110 transition">
                                        <CameraIcon className="h-8 w-8 text-primary-600" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Câmera</span>
                                </button>
                                
                                <button 
                                    onClick={() => {
                                        if(!docType) { alert("Selecione o tipo de documento primeiro."); return; }
                                        galleryInputRef.current?.click();
                                    }}
                                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                                >
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full group-hover:scale-110 transition">
                                        <PhotoIcon className="h-8 w-8 text-purple-600" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Galeria</span>
                                </button>
                            </div>
                            
                            <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" capture="environment" onChange={handleFileChange} />
                            <input type="file" accept="image/*, application/pdf" ref={galleryInputRef} className="hidden" onChange={handleFileChange} />

                            {pages.length > 0 && (
                                <button onClick={() => setStep('preview')} className="w-full py-3 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                                    Voltar para Revisão ({pages.length} págs)
                                </button>
                            )}
                        </div>
                    )}

                    {step === 'crop' && currentImageSrc && (
                        <div className="flex flex-col h-full">
                            <p className="text-xs text-center text-slate-500 mb-2 flex items-center justify-center gap-2">
                                <ArrowsPointingOutIcon className="h-3 w-3" /> Arraste os cantos azuis para ajustar
                            </p>
                            
                            <div className="relative bg-black/90 rounded-xl overflow-hidden flex-1 touch-none select-none flex items-center justify-center" ref={containerRef} style={{ touchAction: 'none' }}>
                                <img 
                                    ref={imgRef} 
                                    src={currentImageSrc} 
                                    alt="Crop Target" 
                                    className="max-w-full max-h-full object-contain pointer-events-none select-none" 
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                    draggable={false} 
                                />
                                
                                <div 
                                    className="absolute border-2 border-primary-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                                    style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
                                >
                                    <div className="absolute -top-4 -left-4 w-10 h-10 bg-transparent flex items-center justify-center z-20" onMouseDown={(e) => handleTouchStart(e, 'tl')} onTouchStart={(e) => handleTouchStart(e, 'tl')}>
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                    <div className="absolute -top-4 -right-4 w-10 h-10 bg-transparent flex items-center justify-center z-20" onMouseDown={(e) => handleTouchStart(e, 'tr')} onTouchStart={(e) => handleTouchStart(e, 'tr')}>
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                    <div className="absolute -bottom-4 -left-4 w-10 h-10 bg-transparent flex items-center justify-center z-20" onMouseDown={(e) => handleTouchStart(e, 'bl')} onTouchStart={(e) => handleTouchStart(e, 'bl')}>
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-transparent flex items-center justify-center z-20" onMouseDown={(e) => handleTouchStart(e, 'br')} onTouchStart={(e) => handleTouchStart(e, 'br')}>
                                        <div className="w-5 h-5 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 flex gap-3 shrink-0">
                                <button onClick={() => setStep('select')} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200">Cancelar</button>
                                <button onClick={() => setRotation(r => (r + 90) % 360)} className="py-3 px-4 text-slate-700 font-bold bg-slate-200 dark:bg-slate-700 rounded-xl hover:bg-slate-300"><ArrowPathIcon className="h-5 w-5" /></button>
                                <button onClick={confirmCrop} className="flex-[2] py-3 text-white font-bold bg-green-600 hover:bg-green-700 rounded-xl shadow-lg flex items-center justify-center gap-2"><CheckIcon className="h-5 w-5" /> Confirmar</button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><DocumentDuplicateIcon className="h-5 w-5" /> Páginas ({pages.length})</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {pages.map((p, idx) => (
                                        <div key={idx} className="relative group aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={p} alt={`Página ${idx+1}`} className="w-full h-full object-contain" />
                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">{idx + 1}</div>
                                            <button onClick={() => setPages(pages.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm"><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => setStep('select')} className="aspect-[3/4] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-400 hover:text-primary-600">
                                        <PlusIcon className="h-8 w-8" /><span className="text-xs font-bold">Adicionar Pág.</span>
                                    </button>
                                </div>
                            </div>
                            <div className="shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={handleFinalizePDF} disabled={isProcessing || pages.length === 0} className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                                    {isProcessing ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Gerando PDF...</> : <><DocumentTextIcon className="h-5 w-5" /> Salvar Arquivo PDF</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScannerModal;
