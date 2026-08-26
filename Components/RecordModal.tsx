
// v1.0.1 - Unified OCR Enabled
import React, { useState, useEffect, useRef } from 'react';
import { PencilSquareIcon, PlusIcon, XMarkIcon, CameraIcon, DocumentTextIcon, ScaleIcon, ClipboardDocumentCheckIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon, DocumentPlusIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, TagIcon, ArrowPathIcon, CloudIcon, BoltIcon } from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";
import { ClientRecord, RecordModalProps, ScannedDocument } from '../types';
import { parseDate, addDays, formatDate } from '../utils';
import { compressPDF, compressImage } from '../utils/compressionUtils';
import ScannerModal from './ScannerModal';
import ClientTimeline from './ClientTimeline';
import { supabaseService } from '../services/supabaseService';
import { apiFetch } from '../services/apiService';
import { extractTextFromPDF } from '../src/utils/pdfParser';

const downloadFileRobust = async (docUrl: string, docName: string) => {
    try {
        // BUCKETS PRIVADOS: converte URL pública gravada no banco em URL assinada (1h)
        docUrl = await supabaseService.resolveStorageUrl(docUrl);
        let downloadUrl = docUrl;
        let isObjectURL = false;
        let finalDocName = docName || 'documento.pdf';
        
        // Identificar se é PDF, imagem ou texto de antemão por url ou nome
        let isPdf = finalDocName.toLowerCase().endsWith('.pdf') || docUrl.toLowerCase().includes('.pdf') || docUrl.startsWith('data:application/pdf');
        let isPng = finalDocName.toLowerCase().endsWith('.png') || docUrl.toLowerCase().includes('.png') || docUrl.startsWith('data:image/png');
        let isJpg = finalDocName.toLowerCase().endsWith('.jpg') || finalDocName.toLowerCase().endsWith('.jpeg') || docUrl.toLowerCase().includes('.jpg') || docUrl.toLowerCase().includes('.jpeg') || docUrl.startsWith('data:image/jpeg');
        let isTxt = finalDocName.toLowerCase().endsWith('.txt') || docUrl.toLowerCase().includes('.txt') || docUrl.startsWith('data:text/plain');

        if (docUrl.startsWith('data:')) {
            // Fix for sometimes malformed or very long base64 strings
            const parts = docUrl.split('base64,');
            if (parts.length === 2) {
                let mimeType = 'application/pdf';
                const headerPart = parts[0].split(';')[0];
                if (headerPart && headerPart.startsWith('data:')) {
                    mimeType = headerPart.substring(5);
                }
                
                if (mimeType.toLowerCase().includes('pdf') || mimeType === 'application/pdf') isPdf = true;
                if (mimeType.toLowerCase().includes('png') || mimeType === 'image/png') isPng = true;
                if (mimeType.toLowerCase().includes('jpeg') || mimeType.toLowerCase().includes('jpg') || mimeType === 'image/jpeg') isJpg = true;
                if (mimeType.toLowerCase().includes('plain') || mimeType === 'text/plain') isTxt = true;

                // Remove any invalid characters (spaces, newlines, etc)
                const safeBase64 = parts[1].replace(/[^A-Za-z0-9+/=]/g, '');
                
                try {
                    const bstr = atob(safeBase64);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], {type: mimeType});
                    downloadUrl = window.URL.createObjectURL(blob);
                    isObjectURL = true;
                } catch (atobErr) {
                    console.error("Erro no 'atob' do base64:", atobErr);
                    // Fallback to fetch API which sometimes handles data URIs natively
                    const response = await fetch(docUrl);
                    if (!response.ok) throw new Error("Network error with data URI");
                    const blob = await response.blob();
                    
                    if (blob.type.toLowerCase().includes('pdf') || blob.type === 'application/pdf') isPdf = true;
                    if (blob.type.toLowerCase().includes('png') || blob.type === 'image/png') isPng = true;
                    if (blob.type.toLowerCase().includes('jpeg') || blob.type.toLowerCase().includes('jpg') || blob.type === 'image/jpeg') isJpg = true;
                    if (blob.type.toLowerCase().includes('plain') || blob.type === 'text/plain') isTxt = true;

                    downloadUrl = window.URL.createObjectURL(blob);
                    isObjectURL = true;
                }
            }
        } else {
            const response = await fetch(docUrl);
            if (!response.ok) throw new Error("Network error fetching url");
            const blob = await response.blob();
            
            if (blob.type.toLowerCase().includes('pdf') || blob.type === 'application/pdf') isPdf = true;
            if (blob.type.toLowerCase().includes('png') || blob.type === 'image/png') isPng = true;
            if (blob.type.toLowerCase().includes('jpeg') || blob.type.toLowerCase().includes('jpg') || blob.type === 'image/jpeg') isJpg = true;
            if (blob.type.toLowerCase().includes('plain') || blob.type === 'text/plain') isTxt = true;

            downloadUrl = window.URL.createObjectURL(blob);
            isObjectURL = true;
        }

        // Aplicar extensão correta se faltar no filename original
        if (isPdf && !finalDocName.toLowerCase().endsWith('.pdf')) {
            finalDocName = finalDocName + '.pdf';
        } else if (isPng && !finalDocName.toLowerCase().endsWith('.png')) {
            finalDocName = finalDocName + '.png';
        } else if (isJpg && !finalDocName.toLowerCase().endsWith('.jpg') && !finalDocName.toLowerCase().endsWith('.jpeg')) {
            finalDocName = finalDocName + '.jpg';
        } else if (isTxt && !finalDocName.toLowerCase().endsWith('.txt')) {
            finalDocName = finalDocName + '.txt';
        }

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = finalDocName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (isObjectURL) {
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
        }
    } catch (error) {
        console.error("Falha detalhada no download:", error);
        alert("Falha ao baixar o arquivo. Talvez ele esteja corrompido ou o link expirou.");
        
        // Ultimate fallback
        try {
            let finalDocName = docName || 'documento.pdf';
            const isPdf = finalDocName.toLowerCase().endsWith('.pdf') || docUrl.toLowerCase().includes('.pdf');
            if (isPdf && !finalDocName.toLowerCase().endsWith('.pdf')) {
                finalDocName = finalDocName + '.pdf';
            }
            
            const link = document.createElement('a');
            link.href = docUrl;
            link.download = finalDocName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch(e) {}
    }
};

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSave, initialData, onOpenPetition, agendaEvents, user }) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({
      nationality: 'Brasileira',
      maritalStatus: 'Solteiro(a)',
      profession: ''
  });
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'docs' | 'petitions' | 'certidao'>('info');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [syncStatus, setSyncStatus] = useState<Record<string, 'syncing' | 'error' | 'success' | 'compressing'>>({});
  const [activeTagMenu, setActiveTagMenu] = useState<string | null>(null);
  const [isGeneratingOCR, setIsGeneratingOCR] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false); // UX: feedback visível durante o upload de anexos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const certidaoFileInputRef = useRef<HTMLInputElement>(null);

  const handleCertidaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsAttaching(true); // mostra "Enviando..." imediatamente
      const newDocs: ScannedDocument[] = [];
      const newSyncStatus: Record<string, 'syncing' | 'error' | 'success'> = {};
      const clientId = formData.id || 'temp';

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Accept pdf or text
          if (file.type !== 'application/pdf' && file.type !== 'text/plain') continue;

          const id = Date.now().toString() + 'cert' + i;
          newSyncStatus[id] = 'syncing';
          
          try {
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
              });
              reader.readAsDataURL(file);
              const base64Url = await base64Promise;

              // Tenta fazer upload para o Supabase Storage
              let finalUrl = base64Url;
              try {
                  const storageUrl = await supabaseService.uploadFile('client-documents', `${clientId}/certidao_${id}`, base64Url);
                  if (storageUrl) {
                      finalUrl = storageUrl;
                  }
              } catch (storageErr) {
                  console.warn("Storage upload failed for file:", file.name, storageErr);
              }

              let ocrText: string | undefined = undefined;
              if (file.type === 'application/pdf') {
                  try {
                      const pdfResult = await extractTextFromPDF(file);
                      if (pdfResult && pdfResult.text && pdfResult.text.trim().length > 100) {
                          console.log(`[GED CERTIDAO] ⚡️ OCR local extraído para ${file.name} (${pdfResult.text.trim().length} chars)`);
                          ocrText = pdfResult.text;
                      }
                  } catch (pdfErr) {
                      console.warn("Erro ao extrair texto local em tempo de upload:", pdfErr);
                  }
              }

              const newDoc: ScannedDocument = {
                  id,
                  name: file.name,
                  type: file.type || 'application/pdf',
                  url: finalUrl,
                  date: new Date().toISOString(),
                  ocrText: ocrText
              };
              
              newDocs.push(newDoc);
          } catch (error) {
              console.error("Error reading file:", error);
              newSyncStatus[id] = 'error';
          }
      }

      setIsAttaching(false);
      if (newDocs.length > 0) {
          const updatedDocs = [...(formData.narrativeCertificates || []), ...newDocs];
          const updatedFormData = { ...formData, narrativeCertificates: updatedDocs };
          setFormData(updatedFormData);
          setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));

          try {
              await onSave(updatedFormData as ClientRecord);
              newDocs.forEach(doc => newSyncStatus[doc.id] = 'success');
              setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));
          } catch (e) {
              console.error("Error saving uploaded certificates:", e);
              newDocs.forEach(doc => newSyncStatus[doc.id] = 'error');
              setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));
          }
      }
      
      if (e.target) {
          e.target.value = '';
      }
  };

  const AVAILABLE_TAGS = [
      { id: 'pessoal', label: 'Pessoal', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      { id: 'trabalhista', label: 'Trabalhista', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      { id: 'medico', label: 'Médico', color: 'bg-red-100 text-red-700 border-red-200' },
      { id: 'previdenciario', label: 'Previdenciário', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      { id: 'outro', label: 'Outro', color: 'bg-slate-100 text-slate-700 border-slate-200' }
  ];

  useEffect(() => {
    if (initialData) {
      const formattedData = { ...initialData };
      const formatCpf = (val: string) => {
        if (!val) return val;
        let v = val.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      };
      const formatDateStr = (val: string) => {
        if (!val) return val;
        let v = val.replace(/\D/g, "");
        if (v.length > 8) v = v.slice(0, 8);
        return v.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
      };

      if (formattedData.cpf) formattedData.cpf = formatCpf(formattedData.cpf);
      if (formattedData.legalRepresentativeCpf) formattedData.legalRepresentativeCpf = formatCpf(formattedData.legalRepresentativeCpf);

      ['der', 'medExpertiseDate', 'socialExpertiseDate', 'extensionDate', 'dcbDate', 'ninetyDaysDate', 'securityMandateDate'].forEach(dateField => {
        if ((formattedData as any)[dateField]) {
            (formattedData as any)[dateField] = formatDateStr((formattedData as any)[dateField]);
        }
      });
      
      setFormData(formattedData);
    } else {
      setFormData({
          nationality: 'brasileiro',
          maritalStatus: 'Solteiro(a)',
          profession: ''
      });
    }
    setActiveTab('info');
  }, [initialData, isOpen]);

  useEffect(() => {
    if (formData.der && formData.der.length === 10) {
       const derDate = parseDate(formData.der);
       if (derDate) {
         const calculatedDate = addDays(derDate, 90);
         const formatted = formatDate(calculatedDate);
         if (formData.ninetyDaysDate !== formatted) {
           setFormData(prev => ({ ...prev, ninetyDaysDate: formatted }));
         }
       }
    }
  }, [formData.der]);

  if (!isOpen) return null;

  const handleCompressDocument = async (doc: ScannedDocument) => {
    if (!doc.url) return;
    
    setSyncStatus(prev => ({ ...prev, [doc.id]: 'compressing' }));
    
    try {
      // 1. Download document if it's a URL
      let file: File;
      if (doc.url.startsWith('http')) {
        const fetchableUrl = await supabaseService.resolveStorageUrl(doc.url);
        const response = await fetch(fetchableUrl);
        const blob = await response.body ? await response.blob() : null;
        if (!blob) throw new Error("Falha ao baixar arquivo para compressão.");
        file = new File([blob], doc.name, { type: doc.type });
      } else {
        // Base64
        const res = await fetch(doc.url);
        const blob = await res.blob();
        file = new File([blob], doc.name, { type: doc.type });
      }

      // 2. Compress based on type
      let compressedFile: File;
      if (file.type === 'application/pdf') {
        compressedFile = await compressPDF(file);
      } else if (file.type.startsWith('image/')) {
        compressedFile = await compressImage(file);
      } else {
        throw new Error("Formato não suportado para compressão.");
      }

      // 3. Upload compressed version
      const clientId = formData.id || 'temp';
      const timestamp = Date.now();
      const sanitizedName = compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageUrl = await supabaseService.uploadFile('client-documents', `${clientId}/${timestamp}_${sanitizedName}`, compressedFile);
      
      if (!storageUrl) throw new Error("Falha ao salvar arquivo comprimido.");

      // 4. Update state
      const newDoc: ScannedDocument = {
        ...doc,
        id: Math.random().toString(36).substr(2, 9),
        name: `${doc.name} (Comprimido)`,
        url: storageUrl,
        date: new Date().toLocaleDateString('pt-BR')
      };

      const updatedDocs = [...(formData.documents || []), newDoc];
      const updatedFormData = { ...formData, documents: updatedDocs };
      setFormData(updatedFormData);
      
      // Attempt to save to master list if possible
      await onSave(updatedFormData as ClientRecord);
      
      setSyncStatus(prev => ({ ...prev, [doc.id]: 'success' }));
      alert("Documento comprimido com sucesso! A nova versão foi adicionada à lista.");
    } catch (error: any) {
      console.error("Erro na compressão:", error);
      alert(`Falha ao comprimir documento: ${error.message}`);
      setSyncStatus(prev => ({ ...prev, [doc.id]: 'error' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    if (e.target.name === 'cpf' || e.target.name === 'legalRepresentativeCpf') {
      let v = value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      value = v
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else if (['der', 'medExpertiseDate', 'socialExpertiseDate', 'extensionDate', 'dcbDate', 'ninetyDaysDate', 'securityMandateDate'].includes(e.target.name)) {
      let v = value.replace(/\D/g, "");
      if (v.length > 8) v = v.slice(0, 8);
      value = v
        .replace(/(\d{2})(\d)/, "$1/$2")
        .replace(/(\d{2})(\d)/, "$1/$2");
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ClientRecord);
  };

  const handleRemoveDocument = (docId: string) => {
      const updatedDocs = (formData.documents || []).filter(d => d.id !== docId);
      setFormData({ ...formData, documents: updatedDocs });
  }

  const handleRemoveCertidao = (docId: string) => {
      const updatedDocs = (formData.narrativeCertificates || []).filter(d => d.id !== docId);
      setFormData({ ...formData, narrativeCertificates: updatedDocs });
  }

  const handleUnifiedOCR = async () => {
      if (!formData.documents || formData.documents.length === 0) {
          alert("Nenhum documento disponível para extração de OCR.");
          return;
      }

      setIsGeneratingOCR(true);
      try {
          const docsToProcess = formData.documents.filter(doc => 
              doc.type === 'application/pdf' || doc.type.startsWith('image/')
          );

          if (docsToProcess.length === 0) {
               alert("Há apenas arquivos impossíveis de executar OCR (ex: outros TXTs ou áudios).");
               setIsGeneratingOCR(false);
               return;
          }

          // BUCKET PRIVADO: o backend baixa estes arquivos — envia URLs assinadas
          const documentsToProcess = await Promise.all(docsToProcess.map(async doc => {
              const resolvedUrl = await supabaseService.resolveStorageUrl(doc.url);
              let base64Images: string[] = [];
              try {
                  const res = await fetch(resolvedUrl);
                  const blob = await res.blob();
                  const localFile = new File([blob], doc.name, { type: doc.type });
                  const pdfResult = await extractTextFromPDF(localFile);
                  if (pdfResult && pdfResult.images) {
                      base64Images = pdfResult.images;
                  }
              } catch (err) {
                  console.error("Falha ao preparar imagens locais para transcrever documento no GED:", err);
              }
              return {
                  url: resolvedUrl,
                  mimeType: doc.type,
                  name: doc.name,
                  images: base64Images
              };
          }));

          const ocrRes = await apiFetch('/api/ocr-unified', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ documents: documentsToProcess })
          });
          
          if (!ocrRes.ok) throw new Error("Falha na geração do OCR unificado no servidor.");
          const ocrData = await ocrRes.json();
          
          if (ocrData.text) {
               const blob = new Blob([ocrData.text], { type: 'text/plain' });
               const file = new File([blob], 'OCR_Unificado.txt', { type: 'text/plain' });
               const clientId = formData.id || 'temp';
               const timestamp = Date.now();
               const storageUrl = await supabaseService.uploadFile('client-documents', `${clientId}/${timestamp}_OCR_Unificado.txt`, file);
               
               if (storageUrl) {
                   const newDoc: ScannedDocument = {
                       id: Math.random().toString(36).substr(2, 9),
                       name: `📄 OCR Unificado Inteligente`,
                       type: 'text/plain',
                       date: new Date().toLocaleDateString('pt-BR'),
                       url: storageUrl,
                       tags: ['previdenciario']
                   };
                   const updatedDocs = [...(formData.documents || []), newDoc];
                   const updatedFormData = { ...formData, documents: updatedDocs };
                   setFormData(updatedFormData);
                   await onSave(updatedFormData as ClientRecord);
                   alert("OCR Unificado gerado com sucesso e anexado nos arquivos do cliente!");
               } else {
                   throw new Error("Erro ao salvar TXT no Storage");
               }
          }
      } catch (err: any) {
          console.error(err);
          alert(`Erro na extração de OCR: ${err.message}`);
      } finally {
          setIsGeneratingOCR(false);
      }
  };

  const handleScannerSave = async (doc: ScannedDocument) => {
      setSyncStatus(prev => ({ ...prev, [doc.id]: 'syncing' }));
      
      try {
          // Tenta fazer upload para o Supabase Storage se disponível
          let finalUrl = doc.url;
          try {
              const clientId = formData.id || 'temp';
              const storageUrl = await supabaseService.uploadFile('client-documents', `${clientId}/${doc.id}`, doc.url);
              if (storageUrl) {
                  finalUrl = storageUrl;
              }
          } catch (storageErr) {
              console.warn("Storage upload failed, falling back to base64:", storageErr);
          }

          const updatedDoc = { ...doc, url: finalUrl };
          const updatedDocs = [...(formData.documents || []), updatedDoc];
          const updatedFormData = { ...formData, documents: updatedDocs };
          setFormData(updatedFormData);
          
          await onSave(updatedFormData as ClientRecord);
          setSyncStatus(prev => ({ ...prev, [doc.id]: 'success' }));
      } catch (e) {
          console.error("Error saving document:", e);
          setSyncStatus(prev => ({ ...prev, [doc.id]: 'error' }));
      }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsAttaching(true); // mostra "Enviando..." imediatamente
      const newDocs: ScannedDocument[] = [];
      const newSyncStatus: Record<string, 'syncing' | 'error' | 'success'> = {};
      const clientId = formData.id || 'temp';

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Accept pdf or text
          if (file.type !== 'application/pdf' && file.type !== 'text/plain') continue;

          const id = Date.now().toString() + i;
          newSyncStatus[id] = 'syncing';
          
          try {
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
              });
              reader.readAsDataURL(file);
              const base64Url = await base64Promise;

              // Tenta fazer upload para o Supabase Storage
              let finalUrl = base64Url;
              try {
                  const storageUrl = await supabaseService.uploadFile('client-documents', `${clientId}/${id}`, base64Url);
                  if (storageUrl) {
                      finalUrl = storageUrl;
                  }
              } catch (storageErr) {
                  console.warn("Storage upload failed for file:", file.name, storageErr);
              }

              let ocrText: string | undefined = undefined;
              if (file.type === 'application/pdf') {
                  try {
                      const pdfResult = await extractTextFromPDF(file);
                      if (pdfResult && pdfResult.text && pdfResult.text.trim().length > 100) {
                          console.log(`[GED UPLOAD] ⚡️ OCR local extraído para ${file.name} (${pdfResult.text.trim().length} chars)`);
                          ocrText = pdfResult.text;
                      }
                  } catch (pdfErr) {
                      console.warn("Erro ao extrair texto local em tempo de upload:", pdfErr);
                  }
              }

              const newDoc: ScannedDocument = {
                  id,
                  name: file.name,
                  type: file.type || 'application/pdf',
                  url: finalUrl,
                  date: new Date().toISOString(),
                  ocrText: ocrText
              };
              
              newDocs.push(newDoc);
          } catch (error) {
              console.error("Error reading file:", error);
              newSyncStatus[id] = 'error';
          }
      }

      setIsAttaching(false);
      if (newDocs.length > 0) {
          const updatedDocs = [...(formData.documents || []), ...newDocs];
          const updatedFormData = { ...formData, documents: updatedDocs };
          setFormData(updatedFormData);
          setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));

          try {
              await onSave(updatedFormData as ClientRecord);
              newDocs.forEach(doc => newSyncStatus[doc.id] = 'success');
              setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));
          } catch (e) {
              console.error("Error saving uploaded documents:", e);
              newDocs.forEach(doc => newSyncStatus[doc.id] = 'error');
              setSyncStatus(prev => ({ ...prev, ...newSyncStatus }));
          }
      }
      
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const retryUpload = async (docId: string) => {
      setSyncStatus(prev => ({ ...prev, [docId]: 'syncing' }));
      try {
          await onSave(formData as ClientRecord);
          setSyncStatus(prev => ({ ...prev, [docId]: 'success' }));
      } catch (e) {
          console.error("Error retrying document upload:", e);
          setSyncStatus(prev => ({ ...prev, [docId]: 'error' }));
      }
  };

  const moveDocument = (index: number, direction: 'up' | 'down') => {
      const docs = [...(formData.documents || [])];
      if (direction === 'up' && index > 0) {
          [docs[index - 1], docs[index]] = [docs[index], docs[index - 1]];
      } else if (direction === 'down' && index < docs.length - 1) {
          [docs[index + 1], docs[index]] = [docs[index], docs[index + 1]];
      }
      setFormData({ ...formData, documents: docs });
  };

  const startEditingDoc = (doc: ScannedDocument) => {
      setEditingDocId(doc.id);
      setEditDocName(doc.name);
  };

  const saveDocName = (docId: string) => {
      const docs = (formData.documents || []).map(d => d.id === docId ? { ...d, name: editDocName } : d);
      setFormData({ ...formData, documents: docs });
      setEditingDocId(null);
  };

  const toggleTag = (docId: string, tagId: string) => {
      const docs = (formData.documents || []).map(d => {
          if (d.id === docId) {
              const tags = d.tags || [];
              const newTags = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId];
              return { ...d, tags: newTags };
          }
          return d;
      });
      setFormData({ ...formData, documents: docs });
  };

  const handleRemovePetition = (petitionId: string) => {
      const updatedPetitions = (formData.petitions || []).filter(p => p.id !== petitionId);
      setFormData({ ...formData, petitions: updatedPetitions });
  }

  const getDocumentHTML = (type: 'procuracao' | 'hipossuficiencia' | 'renuncia' | 'contrato_honorarios') => {
      const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
      const clientName = formData.name?.toUpperCase() || "__________________________";
      const clientCPF = formData.cpf || "___.___.___-__";
      const clientAddress = formData.address || "__________________________";
      const clientNationality = formData.nationality || "brasileiro(a)";
      const clientMarital = formData.maritalStatus || "estado civil";
      const clientProfession = formData.profession || "profissão";
      const isMinor = !!formData.legalRepresentative;

      if (type === 'procuracao') {
          let outorganteText = "";
          if (isMinor) {
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.legalRepresentativeNationality || formData.nationality || "brasileira";
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress;
              const isMaleRep = formData.legalRepresentativeGender === 'M';
              const repTitle = isMaleRep ? 'seu genitor' : 'sua genitora';
              const repInscrito = isMaleRep ? 'inscrito' : 'inscrita';
              outorganteText = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito(a) no CPF sob o nº ${clientCPF}, representado(a) por ${repTitle} e outorgante, ${repName}, ${repNacionality}, ${repCivil}, ${repProf}, ${repInscrito} no CPF sob o nº ${repCPF}, residente e domiciliado(a) à ${repAddress}.`;
          } else {
              outorganteText = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}.`;
          }

          return `<h2 class="no-indent" style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 24px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">PROCURAÇÃO AD JUDICIA ET EXTRA</h2>
<p class="no-indent" style="margin-bottom: 14px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>OUTORGANTE:</strong> ${outorganteText}</p>
<p class="no-indent" style="margin-bottom: 14px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>OUTORGADO:</strong> MICHEL SANTOS FELIX, inscrito na OAB/RJ sob o nº 231.640 e no CPF/MF nº 142.805.877-01, e LUANA DE OLIVEIRA CASTRO PACHECO, inscrita na OAB/RJ sob o nº 226.749 e inscrita no CPF/MF sob o nº 113.599.127-89, com endereço eletrônico felixecastroadv@gmail.com, e endereço profissional sito na Av. Prefeito José de Amorim, nº 500, apto. 204, Jardim Meriti – São João de Meriti/RJ, CEP 25.555-201.</p>
<p class="no-indent" style="margin-bottom: 24px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>PODERES:</strong> Pelo presente instrumento o outorgante confere ao outorgado amplos poderes para o foro em geral, com cláusula ad judicia et extra, para representá-lo nos órgãos públicos e privados, agências do INSS, Juízos, Instâncias ou Tribunais, possibilitando propor ações de direito competentes e defendê-lo até o final da decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para requerer concessão/revisão de benefícios previdenciários, obter cópias de expedientes e processos administrativos, acessar laudos sociais e periciais, acessar e manejar extratos, sistemas e telas do INSS, agendar serviços e atendimentos no INSS, receber valores e dar quitação, levantar valores, incluindo RPVs e precatórios (podendo para tanto assinar declaração de isenção de imposto de renda), obter extratos de contas judiciais, requerer expedição/retificação de certidões, incluindo Certidões de Tempo de Contribuição, obter cópia de documentos, Perfis Profissiográficos Previdenciários e laudos técnicos, obter cópia de documentos médicos e prontuários, firmar compromissos ou acordos, receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, assinar declaração de hipossuficiência econômica e substabelecer a outrem, com ou sem reservas de iguais poderes, para agir em conjunto ou separadamente com o substabelecido.</p>
<p class="no-indent" style="margin-top: 32px; margin-bottom: 40px; text-align: left; font-size: 11pt;">São João de Meriti/RJ, ${currentDate}.</p>
<div class="no-indent" style="text-align: center; margin-top: 40px;">
  <p class="no-indent" style="margin-bottom: 4px;">____________________________________________________</p>
  <p class="no-indent" style="font-weight: bold; margin-top: 4px; font-size: 11pt;">${clientName}</p>
  ${isMinor ? `<p class="no-indent" style="font-size: 10pt; color: #475569; margin-top: 2px;">(representado por: ${formData.legalRepresentative?.toUpperCase()})</p>` : ''}
</div>`;
      }

      if (type === 'hipossuficiencia') {
          let text = "";
          if (isMinor) {
              const isMaleRep = formData.legalRepresentativeGender === 'M';
              const repNacionalidade = isMaleRep ? 'brasileiro' : 'brasileira';
              const repInscrito = isMaleRep ? 'inscrito' : 'inscrita';
              const repDomiciliado = isMaleRep ? 'domiciliado' : 'domiciliada';
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress;
              text = `Eu, ${formData.legalRepresentative?.toUpperCase()}, ${repNacionalidade}, representante legal de ${clientName}, ${repInscrito} no CPF sob o nº ${repCPF}, residente e ${repDomiciliado} à ${repAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          } else {
              text = `Eu, ${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          }

          return `<h2 class="no-indent" style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 24px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA</h2>
<p class="no-indent" style="margin-bottom: 32px; text-align: justify; line-height: 1.8; font-size: 11pt;">${text}</p>
<p class="no-indent" style="margin-top: 32px; margin-bottom: 40px; text-align: left; font-size: 11pt;">São João de Meriti/RJ, ${currentDate}.</p>
<div class="no-indent" style="text-align: center; margin-top: 40px;">
  <p class="no-indent" style="margin-bottom: 4px;">____________________________________________________</p>
  <p class="no-indent" style="font-weight: bold; margin-top: 4px; font-size: 11pt;">${clientName}</p>
  ${isMinor ? `<p class="no-indent" style="font-size: 10pt; color: #475569; margin-top: 2px;">(representado por: ${formData.legalRepresentative?.toUpperCase()})</p>` : ''}
</div>`;
      }

      if (type === 'renuncia') {
          let text = "";
          if (isMinor) {
              text = `${clientName}, CPF nº ${clientCPF}, neste ato representado por ${formData.legalRepresentative?.toUpperCase()}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          } else {
              text = `${clientName}, CPF nº ${clientCPF}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          }

          return `<h2 class="no-indent" style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #1e293b; text-transform: uppercase;">TERMO DE RENÚNCIA AOS VALORES EXCEDENTES</h2>
<h3 class="no-indent" style="text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 24px; color: #475569; text-transform: uppercase;">AO TETO DO JEF</h3>
<p class="no-indent" style="margin-bottom: 32px; text-align: justify; line-height: 1.8; font-size: 11pt;">${text}</p>
<p class="no-indent" style="margin-top: 32px; margin-bottom: 40px; text-align: left; font-size: 11pt;">São João de Meriti/RJ, ${currentDate}.</p>
<div class="no-indent" style="text-align: center; margin-top: 40px;">
  <p class="no-indent" style="margin-bottom: 4px;">____________________________________________________</p>
  <p class="no-indent" style="font-weight: bold; margin-top: 4px; font-size: 11pt;">${clientName}</p>
  ${isMinor ? `<p class="no-indent" style="font-size: 10pt; color: #475569; margin-top: 2px;">(representado por: ${formData.legalRepresentative?.toUpperCase()})</p>` : ''}
</div>`;
      }

      if (type === 'contrato_honorarios') {
          let contratanteQualif = "";
          if (isMinor) {
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.legalRepresentativeNationality || formData.nationality || "brasileira";
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress;
              contratanteQualif = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito(a) no CPF sob o nº ${clientCPF}, neste ato representado(a) por ${repName}, ${repNacionality}, ${repCivil}, ${repProf}, inscrito(a) no CPF sob o nº ${repCPF}, residente e domiciliado(a) à ${repAddress}, doravante denominado(a) <strong>CONTRATANTE</strong>;`;
          } else {
              contratanteQualif = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, doravante denominado(a) <strong>CONTRATANTE</strong>;`;
          }

          return `<h2 class="no-indent" style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">CONTRATO DE HONORÁRIOS ADVOCATÍCIOS PREVIDENCIÁRIOS</h2>

<p class="no-indent" style="margin-bottom: 10px; text-align: justify; line-height: 1.6; font-size: 11pt;">Pelo presente instrumento particular, de um lado:</p>

<p class="no-indent" style="margin-bottom: 10px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>CONTRATANTE:</strong> ${contratanteQualif}</p>

<p class="no-indent" style="margin-bottom: 10px; text-align: justify; line-height: 1.6; font-size: 11pt;">E de outro lado:</p>

<p class="no-indent" style="margin-bottom: 14px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>CONTRATADOS:</strong> Os advogados <strong>LUANA DE OLIVEIRA CASTRO PACHECO</strong>, inscrita na OAB/RJ sob o nº 226.749 e no CPF sob o nº 113.599.127-89, e <strong>MICHEL SANTOS FELIX</strong>, inscrito na OAB/RJ sob o nº 231.640 e no CPF sob o nº 142.805.877-01, ambos com endereço eletrônico felixecastroadv@gmail.com e escritório profissional sito na Av. Prefeito José de Amorim, nº 500, Ap. 204, Vilar dos Teles, São João de Meriti/RJ, CEP 25555-201, doravante denominados <strong>CONTRATADOS</strong>.</p>

<p class="no-indent" style="margin-bottom: 18px; text-align: justify; line-height: 1.6; font-size: 11pt;">Têm entre si, justo e contratado, o presente Contrato de Honorários Advocatícios, mediante as cláusulas e condições seguintes:</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA PRIMEIRA – DO OBJETO</p>
<p class="no-indent" style="margin-bottom: 12px; text-align: justify; line-height: 1.6; font-size: 11pt;">O presente contrato tem como objeto a prestação de serviços advocatícios pelos <strong>CONTRATADOS</strong> em favor do(a) <strong>CONTRATANTE</strong>, visando à concessão e/ou revisão de benefício previdenciário junto ao Instituto Nacional do Seguro Social (INSS), seja na esfera administrativa ou judicial.</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA SEGUNDA – DOS HONORÁRIOS ADVOCATÍCIOS</p>
<p class="no-indent" style="margin-bottom: 10px; text-align: justify; line-height: 1.6; font-size: 11pt;">O(A) <strong>CONTRATANTE</strong> pagará aos <strong>CONTRATADOS</strong>, a título de honorários advocatícios, os valores e condições estabelecidas a seguir:</p>

<p class="no-indent" style="font-weight: bold; font-size: 10.5pt; margin-top: 10px; margin-bottom: 4px;">2.1. PARA BENEFÍCIOS DE CARÁTER DEFINITIVO (APOSENTADORIAS, PENSÃO POR MORTE, BENEFÍCIO DE PRESTAÇÃO CONTINUADA – BPC, ENTRE OUTROS):</p>
<p class="no-indent" style="margin-left: 16px; margin-bottom: 4px; text-align: justify; line-height: 1.5; font-size: 10.5pt;">( &nbsp; ) a) <strong>Na esfera administrativa:</strong> Os <strong>CONTRATADOS</strong> farão jus a 02 (dois) salários do benefício concedido, pagos pelo(a) <strong>CONTRATANTE</strong> diretamente aos <strong>CONTRATADOS</strong>, mediante desconto autorizado na primeira parcela do benefício ou por outro meio a ser acordado, após a efetiva concessão e disponibilização do benefício.</p>
<p class="no-indent" style="margin-left: 16px; margin-bottom: 10px; text-align: justify; line-height: 1.5; font-size: 10.5pt;">( <strong>X</strong> ) b) <strong>Na esfera judicial:</strong> Os <strong>CONTRATADOS</strong> farão jus a 02 (dois) salários do benefício concedido, pagos pelo(a) <strong>CONTRATANTE</strong> diretamente aos <strong>CONTRATADOS</strong>, mediante desconto autorizado na primeira parcela do benefício ou por outro meio a ser acordado, após a efetiva concessão e disponibilização do benefício.</p>

<p class="no-indent" style="font-weight: bold; font-size: 10.5pt; margin-top: 10px; margin-bottom: 4px;">2.2. PARA BENEFÍCIOS TEMPORÁRIOS (BENEFÍCIO POR INCAPACIDADE, AUXÍLIO-ACIDENTE, SALÁRIO-MATERNIDADE, ENTRE OUTROS):</p>
<p class="no-indent" style="margin-left: 16px; margin-bottom: 4px; text-align: justify; line-height: 1.5; font-size: 10.5pt;">( &nbsp; ) a) <strong>Na esfera administrativa:</strong> Os <strong>CONTRATADOS</strong> farão jus a 01 (um) salário do benefício pretendido, pago pelo(a) <strong>CONTRATANTE</strong> diretamente aos <strong>CONTRATADOS</strong>, após a efetiva concessão e disponibilização do benefício.</p>
<p class="no-indent" style="margin-left: 16px; margin-bottom: 10px; text-align: justify; line-height: 1.5; font-size: 10.5pt;">( &nbsp; ) b) <strong>Na esfera judicial:</strong> Os <strong>CONTRATADOS</strong> farão jus a 30% (trinta por cento) sobre o valor total dos atrasados, corrigidos monetariamente e acrescidos de juros, a serem recebidos pelo(a) <strong>CONTRATANTE</strong> ao final da demanda judicial, além de eventual condenação do INSS em honorários de sucumbência, que pertencerão integralmente aos <strong>CONTRATADOS</strong>.</p>

<p class="no-indent" style="margin-bottom: 12px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>2.3.</strong> As partes convencionam que os honorários estabelecidos nas Cláusulas 2.1 e 2.2 não são cumulativos, aplicando-se o maior valor devido em caso de transição entre esferas (administrativa para judicial).</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA TERCEIRA – DAS DESPESAS</p>
<p class="no-indent" style="margin-bottom: 12px; text-align: justify; line-height: 1.6; font-size: 11pt;">Todas as despesas judiciais e/ou administrativas (custas, taxas, emolumentos, deslocamentos, cópias, certidões, perícias, etc.) necessárias ao andamento do processo serão de responsabilidade exclusiva do(a) <strong>CONTRATANTE</strong>, não estando incluídas nos honorários ora contratados. Os <strong>CONTRATADOS</strong> se obrigam a prestar contas de toda e qualquer despesa realizada, mediante apresentação de comprovantes.</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA QUARTA – DAS OBRIGAÇÕES DAS PARTES</p>
<p class="no-indent" style="margin-bottom: 6px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>4.1. Dos CONTRATADOS:</strong> Atuar com zelo e diligência na defesa dos interesses do(a) <strong>CONTRATANTE</strong>, prestando informações sobre o andamento do processo sempre que solicitado ou quando houver movimentação relevante.</p>
<p class="no-indent" style="margin-bottom: 12px; text-align: justify; line-height: 1.6; font-size: 11pt;"><strong>4.2. Do(a) CONTRATANTE:</strong> Fornecer todas as informações e documentos necessários para a defesa de seus interesses, bem como comparecer aos atos processuais que exigirem sua presença, sempre que solicitado pelos <strong>CONTRATADOS</strong>.</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA QUINTA – DA RESCISÃO</p>
<p class="no-indent" style="margin-bottom: 12px; text-align: justify; line-height: 1.6; font-size: 11pt;">O presente contrato poderá ser rescindido por qualquer das partes, a qualquer tempo, mediante comunicação escrita. Em caso de rescisão unilateral por parte do(a) <strong>CONTRATANTE</strong> sem justa causa antes do término dos serviços, serão devidos honorários proporcionais ao trabalho já realizado, além do reembolso das despesas.</p>

<p class="no-indent" style="font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 4px; text-transform: uppercase;">CLÁUSULA SEXTA – DO FORO</p>
<p class="no-indent" style="margin-bottom: 16px; text-align: justify; line-height: 1.6; font-size: 11pt;">Fica eleito o foro da Comarca de São João de Meriti, Estado do Rio de Janeiro, para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

<p class="no-indent" style="margin-bottom: 20px; line-height: 1.6; font-size: 11pt;">E por estarem assim justos e contratados, as partes assinam o presente em 02 (duas) vias de igual teor e forma, na presença das duas testemunhas abaixo.</p>

<p class="no-indent" style="margin-top: 20px; margin-bottom: 16px; font-size: 11pt;">São João de Meriti/RJ, ${currentDate}.</p>

<table style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 1px solid #000; font-family: 'Times New Roman', Times, serif; font-size: 11px;">
  <thead>
    <tr style="border-bottom: 1px solid #000; background-color: #f8fafc;">
      <th style="border-right: 1px solid #000; padding: 6px 10px; text-align: left; font-weight: bold; width: 65%;">IDENTIFICAÇÃO:</th>
      <th style="padding: 6px 10px; text-align: left; font-weight: bold; width: 35%;">ASSINATURA:</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #000;">
      <td style="border-right: 1px solid #000; padding: 8px 10px; font-weight: bold; vertical-align: middle;">MICHEL SANTOS FELIX - OAB/RJ: 231.640 (CONTRATADO)</td>
      <td style="padding: 8px 10px; height: 32px;"></td>
    </tr>
    <tr style="border-bottom: 1px solid #000;">
      <td style="border-right: 1px solid #000; padding: 8px 10px; font-weight: bold; vertical-align: middle;">LUANA DE OLIVEIRA CASTRO PACHECO - OAB/RJ: 226.749 (CONTRATADA)</td>
      <td style="padding: 8px 10px; height: 32px;"></td>
    </tr>
    <tr>
      <td style="border-right: 1px solid #000; padding: 8px 10px; font-weight: bold; vertical-align: middle;">
        ${clientName} - CPF: ${clientCPF} (CONTRATANTE)
        ${isMinor ? `<br/><span style="font-size: 10px; font-weight: normal; color: #475569;">(representado por: ${formData.legalRepresentative?.toUpperCase()})</span>` : ''}
      </td>
      <td style="padding: 8px 10px; height: 32px;"></td>
    </tr>
  </tbody>
</table>`;
      }

      return '';
  };

  const handleOpenInEditor = (type: 'procuracao' | 'hipossuficiencia' | 'renuncia' | 'contrato_honorarios' | 'custom', customDocName?: string, customDocUrl?: string) => {
      let title = customDocName || 'Documento sem título';
      let htmlContent = '';

      if (type !== 'custom') {
          const titleMap = {
              procuracao: `Procuração Ad Judicia - ${formData.name || 'Cliente'}`,
              hipossuficiencia: `Declaração de Hipossuficiência - ${formData.name || 'Cliente'}`,
              renuncia: `Termo de Renúncia Teto JEF - ${formData.name || 'Cliente'}`,
              contrato_honorarios: `Contrato de Honorários Previdenciários - ${formData.name || 'Cliente'}`
          };
          title = titleMap[type];
          htmlContent = getDocumentHTML(type);
      } else {
          htmlContent = `<h2 class="no-indent" style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">${title}</h2><p class="no-indent">Documento de ${formData.name || 'Cliente'} do processo previdenciário.</p>`;
      }

      const petition = {
          id: 'doc_' + Math.random().toString(36).substr(2, 9),
          title,
          content: htmlContent,
          category: type === 'contrato_honorarios' ? 'Contrato Previdenciário' : 'Documento / Procuração',
          type: 'concrete' as const,
          lastModified: new Date().toLocaleString('pt-BR')
      };

      if (onOpenPetition) {
          onOpenPetition(petition, formData.id);
      }
  };

  const generatePDF = (type: 'procuracao' | 'hipossuficiencia' | 'renuncia' | 'contrato_honorarios') => {
      // @ts-ignore
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20; // 20mm padronizado
      const maxLineWidth = pageWidth - (margin * 2);
      
      const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const clientName = formData.name?.toUpperCase() || "__________________________";
      const clientCPF = formData.cpf || "___.___.___-__";
      const clientAddress = formData.address || "__________________________";
      const clientNationality = formData.nationality || "brasileiro(a)";
      const clientMarital = formData.maritalStatus || "estado civil";
      const clientProfession = formData.profession || "profissão";
      const isMinor = !!formData.legalRepresentative;

      let cursorY = 25;

      // Helper universal para escrever texto formatado e gerenciar quebra de páginas com precisão
      const writeText = (
          text: string, 
          opts: { 
              fontStyle?: 'normal' | 'bold' | 'italic', 
              fontSize?: number, 
              align?: 'left' | 'center' | 'justify', 
              marginTop?: number, 
              marginBottom?: number,
              indent?: number
          } = {}
      ) => {
          const fontStyle = opts.fontStyle || 'normal';
          const fontSize = opts.fontSize || 10;
          const align = opts.align || 'justify';
          const marginTop = opts.marginTop !== undefined ? opts.marginTop : 0;
          const marginBottom = opts.marginBottom !== undefined ? opts.marginBottom : 3;
          const indent = opts.indent || 0;

          doc.setFont("times", fontStyle);
          doc.setFontSize(fontSize);

          cursorY += marginTop;
          const effectiveWidth = maxLineWidth - indent;
          const words = text.split(/\s+/).filter(Boolean);
          const spaceWidth = doc.getTextWidth(" ");

          const lines: string[][] = [];
          let currentLine: string[] = [];
          let currentLineWidth = 0;

          for (const word of words) {
              const wWidth = doc.getTextWidth(word);
              if (currentLine.length > 0 && currentLineWidth + spaceWidth + wWidth > effectiveWidth) {
                  lines.push(currentLine);
                  currentLine = [word];
                  currentLineWidth = wWidth;
              } else {
                  if (currentLine.length > 0) currentLineWidth += spaceWidth;
                  currentLine.push(word);
                  currentLineWidth += wWidth;
              }
          }
          if (currentLine.length > 0) lines.push(currentLine);

          const lineHeight = fontSize * 0.45; // altura da linha em mm

          lines.forEach((lineWords, lineIdx) => {
              if (cursorY + lineHeight > pageHeight - 20) {
                  doc.addPage();
                  cursorY = 25;
              }

              const isLastLine = lineIdx === lines.length - 1;
              const startX = margin + indent;

              if (align === 'center') {
                  doc.text(lineWords.join(" "), pageWidth / 2, cursorY, { align: "center" });
              } else if (align === 'left' || isLastLine) {
                  let x = startX;
                  lineWords.forEach((w) => {
                      doc.text(w, x, cursorY);
                      x += doc.getTextWidth(w) + spaceWidth;
                  });
              } else {
                  // Alinhamento Justificado com distribuição de espaços uniforme
                  const wordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = gaps > 0 ? (effectiveWidth - wordsWidth) / gaps : 0;

                  let x = startX;
                  lineWords.forEach((w, wIdx) => {
                      doc.text(w, x, cursorY);
                      if (wIdx < gaps) x += doc.getTextWidth(w) + extraSpace;
                  });
              }
              cursorY += lineHeight;
          });

          cursorY += marginBottom;
      };

      if (type === 'procuracao') {
          writeText("PROCURAÇÃO AD JUDICIA ET EXTRA", { fontStyle: 'bold', fontSize: 14, align: 'center', marginBottom: 15 });

          let outorganteText = "";
          if (isMinor) {
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.legalRepresentativeNationality || formData.nationality || "brasileira";
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress;
              const isMaleRep = formData.legalRepresentativeGender === 'M';
              const repTitle = isMaleRep ? 'seu genitor' : 'sua genitora';
              const repInscrito = isMaleRep ? 'inscrito' : 'inscrita';
              outorganteText = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito(a) no CPF sob o nº ${clientCPF}, representado(a) por ${repTitle} e outorgante, ${repName}, ${repNacionality}, ${repCivil}, ${repProf}, ${repInscrito} no CPF sob o nº ${repCPF}, residente e domiciliado(a) à ${repAddress}.`;
          } else {
              outorganteText = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}.`;
          }

          writeText(`OUTORGANTE: ${outorganteText}`, { fontStyle: 'normal', fontSize: 11, align: 'justify', marginBottom: 6 });
          writeText(`OUTORGADO: MICHEL SANTOS FELIX, inscrito na OAB/RJ sob o nº 231.640 e no CPF/MF nº 142.805.877-01, e LUANA DE OLIVEIRA CASTRO PACHECO, inscrita na OAB/RJ sob o nº 226.749 e inscrita no CPF/MF sob o nº 113.599.127-89, com endereço eletrônico felixecastroadv@gmail.com, e endereço profissional sito na Av. Prefeito José de Amorim, nº 500, apto. 204, Jardim Meriti – São João de Meriti/RJ, CEP 25.555-201.`, { fontStyle: 'normal', fontSize: 11, align: 'justify', marginBottom: 6 });
          writeText(`PODERES: Pelo presente instrumento o outorgante confere ao outorgado amplos poderes para o foro em geral, com cláusula ad judicia et extra, para representá-lo nos órgãos públicos e privados, agências do INSS, Juízos, Instâncias ou Tribunais, possibilitando propor ações de direito competentes e defendê-lo até o final da decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para requerer concessão/revisão de benefícios previdenciários, obter cópias de expedientes e processos administrativos, acessar laudos sociais e periciais, acessar e manejar extratos, sistemas e telas do INSS, agendar serviços e atendimentos no INSS, receber valores e dar quitação, levantar valores, incluindo RPVs e precatórios (podendo para tanto assinar declaração de isenção de imposto de renda), obter extratos de contas judiciais, requerer expedição/retificação de certidões, incluindo Certidões de Tempo de Contribuição, obter cópia de documentos, Perfis Profissiográficos Previdenciários e laudos técnicos, obter cópia de documentos médicos e prontuários, firmar compromissos ou acordos, receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, assinar declaração de hipossuficiência econômica e substabelecer a outrem, com ou sem reservas de iguais poderes, para agir em conjunto ou separadamente com o substabelecido.`, { fontStyle: 'normal', fontSize: 11, align: 'justify', marginBottom: 12 });

          writeText(`São João de Meriti/RJ, ${currentDate}.`, { fontStyle: 'normal', fontSize: 11, align: 'left', marginTop: 10, marginBottom: 25 });

          if (cursorY + 30 > pageHeight - 20) { doc.addPage(); cursorY = 30; }
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          cursorY += 5;
          writeText(clientName, { fontStyle: 'bold', fontSize: 11, align: 'center', marginBottom: 0 });
          if (isMinor) {
              writeText(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, { fontStyle: 'normal', fontSize: 9.5, align: 'center', marginBottom: 0 });
          }

      } else if (type === 'hipossuficiencia') {
          writeText("DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA", { fontStyle: 'bold', fontSize: 14, align: 'center', marginBottom: 20 });

          let text = "";
          if (isMinor) {
               const isMaleRep = formData.legalRepresentativeGender === 'M';
               const repNacionalidade = isMaleRep ? 'brasileiro' : 'brasileira';
               const repInscrito = isMaleRep ? 'inscrito' : 'inscrita';
               const repDomiciliado = isMaleRep ? 'domiciliado' : 'domiciliada';
               const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
               const repAddress = formData.legalRepresentativeAddress || clientAddress;
               text = `Eu, ${formData.legalRepresentative?.toUpperCase()}, ${repNacionalidade}, representante legal de ${clientName}, ${repInscrito} no CPF sob o nº ${repCPF}, residente e ${repDomiciliado} à ${repAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          } else {
               text = `Eu, ${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          }

          writeText(text, { fontStyle: 'normal', fontSize: 11, align: 'justify', marginBottom: 15 });
          writeText(`São João de Meriti/RJ, ${currentDate}.`, { fontStyle: 'normal', fontSize: 11, align: 'left', marginTop: 15, marginBottom: 30 });

          if (cursorY + 30 > pageHeight - 20) { doc.addPage(); cursorY = 30; }
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          cursorY += 5;
          writeText(clientName, { fontStyle: 'bold', fontSize: 11, align: 'center', marginBottom: 0 });
          if (isMinor) {
              writeText(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, { fontStyle: 'normal', fontSize: 9.5, align: 'center', marginBottom: 0 });
          }

      } else if (type === 'renuncia') {
          writeText("TERMO DE RENÚNCIA AOS VALORES EXCEDENTES", { fontStyle: 'bold', fontSize: 14, align: 'center', marginBottom: 2 });
          writeText("AO TETO DO JEF", { fontStyle: 'bold', fontSize: 12, align: 'center', marginBottom: 20 });

          let text = "";
          if (isMinor) {
              text = `${clientName}, CPF nº ${clientCPF}, neste ato representado por ${formData.legalRepresentative?.toUpperCase()}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          } else {
              text = `${clientName}, CPF nº ${clientCPF}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          }

          writeText(text, { fontStyle: 'normal', fontSize: 11, align: 'justify', marginBottom: 15 });
          writeText(`São João de Meriti/RJ, ${currentDate}.`, { fontStyle: 'normal', fontSize: 11, align: 'left', marginTop: 15, marginBottom: 30 });

          if (cursorY + 30 > pageHeight - 20) { doc.addPage(); cursorY = 30; }
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          cursorY += 5;
          writeText(clientName, { fontStyle: 'bold', fontSize: 11, align: 'center', marginBottom: 0 });
          if (isMinor) {
              writeText(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, { fontStyle: 'normal', fontSize: 9.5, align: 'center', marginBottom: 0 });
          }

      } else if (type === 'contrato_honorarios') {
          writeText("CONTRATO DE HONORÁRIOS ADVOCATÍCIOS PREVIDENCIÁRIOS", { fontStyle: 'bold', fontSize: 13, align: 'center', marginBottom: 10 });
          
          let contratanteQualif = "";
          if (isMinor) {
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.legalRepresentativeNationality || formData.nationality || "brasileira";
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress;
              contratanteQualif = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito(a) no CPF sob o nº ${clientCPF}, neste ato representado(a) por ${repName}, ${repNacionality}, ${repCivil}, ${repProf}, inscrito(a) no CPF sob o nº ${repCPF}, residente e domiciliado(a) à ${repAddress}, doravante denominado(a) CONTRATANTE;`;
          } else {
              contratanteQualif = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, doravante denominado(a) CONTRATANTE;`;
          }

          writeText("Pelo presente instrumento particular, de um lado:", { fontSize: 10, align: 'justify', marginBottom: 2 });
          writeText(`CONTRATANTE: ${contratanteQualif}`, { fontSize: 10, align: 'justify', marginBottom: 2 });
          writeText("E de outro lado:", { fontSize: 10, align: 'justify', marginBottom: 2 });
          writeText(`CONTRATADOS: Os advogados LUANA DE OLIVEIRA CASTRO PACHECO, inscrita na OAB/RJ sob o nº 226.749 e no CPF sob o nº 113.599.127-89, e MICHEL SANTOS FELIX, inscrito na OAB/RJ sob o nº 231.640 e no CPF sob o nº 142.805.877-01, ambos com endereço eletrônico felixecastroadv@gmail.com e escritório profissional sito na Av. Prefeito José de Amorim, nº 500, Ap. 204, Vilar dos Teles, São João de Meriti/RJ, CEP 25555-201, doravante denominados CONTRATADOS.`, { fontSize: 10, align: 'justify', marginBottom: 3 });
          writeText("Têm entre si, justo e contratado, o presente Contrato de Honorários Advocatícios, mediante as cláusulas e condições seguintes:", { fontSize: 10, align: 'justify', marginBottom: 4 });

          writeText("CLÁUSULA PRIMEIRA – DO OBJETO", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("O presente contrato tem como objeto a prestação de serviços advocatícios pelos CONTRATADOS em favor do(a) CONTRATANTE, visando à concessão e/ou revisão de benefício previdenciário junto ao Instituto Nacional do Seguro Social (INSS), seja na esfera administrativa ou judicial.", { fontSize: 10, align: 'justify', marginBottom: 3 });

          writeText("CLÁUSULA SEGUNDA – DOS HONORÁRIOS ADVOCATÍCIOS", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("O(A) CONTRATANTE pagará aos CONTRATADOS, a título de honorários advocatícios, os valores e condições estabelecidas a seguir:", { fontSize: 10, align: 'justify', marginBottom: 2 });

          writeText("2.1. PARA BENEFÍCIOS DE CARÁTER DEFINITIVO (APOSENTADORIAS, PENSÃO POR MORTE, BENEFÍCIO DE PRESTAÇÃO CONTINUADA – BPC, ENTRE OUTROS):", { fontStyle: 'bold', fontSize: 9.5, align: 'left', marginTop: 1, marginBottom: 1 });
          writeText("(   ) a) Na esfera administrativa: Os CONTRATADOS farão jus a 02 (dois) salários do benefício concedido, pagos pelo(a) CONTRATANTE diretamente aos CONTRATADOS, mediante desconto autorizado na primeira parcela do benefício ou por outro meio a ser acordado, após a efetiva concessão e disponibilização do benefício.", { fontSize: 9.5, align: 'justify', indent: 4, marginBottom: 1 });
          writeText("( X ) b) Na esfera judicial: Os CONTRATADOS farão jus a 02 (dois) salários do benefício concedido, pagos pelo(a) CONTRATANTE diretamente aos CONTRATADOS, mediante desconto autorizado na primeira parcela do benefício ou por outro meio a ser acordado, após a efetiva concessão e disponibilização do benefício.", { fontSize: 9.5, align: 'justify', indent: 4, marginBottom: 3 });

          writeText("2.2. PARA BENEFÍCIOS TEMPORÁRIOS (BENEFÍCIO POR INCAPACIDADE, AUXÍLIO-ACIDENTE, SALÁRIO-MATERNIDADE, ENTRE OUTROS):", { fontStyle: 'bold', fontSize: 9.5, align: 'left', marginTop: 1, marginBottom: 1 });
          writeText("(   ) a) Na esfera administrativa: Os CONTRATADOS farão jus a 01 (um) salário do benefício pretendido, pago pelo(a) CONTRATANTE diretamente aos CONTRATADOS, após a efetiva concessão e disponibilização do benefício.", { fontSize: 9.5, align: 'justify', indent: 4, marginBottom: 1 });
          writeText("(   ) b) Na esfera judicial: Os CONTRATADOS farão jus a 30% (trinta por cento) sobre o valor total dos atrasados, corrigidos monetariamente e acrescidos de juros, a serem recebidos pelo(a) CONTRATANTE ao final da demanda judicial, além de eventual condenação do INSS em honorários de sucumbência, que pertencerão integralmente aos CONTRATADOS.", { fontSize: 9.5, align: 'justify', indent: 4, marginBottom: 3 });

          writeText("2.3. As partes convencionam que os honorários estabelecidos nas Cláusulas 2.1 e 2.2 não são cumulativos, aplicando-se o maior valor devido em caso de transição entre esferas (administrativa para judicial).", { fontSize: 10, align: 'justify', marginBottom: 3 });

          writeText("CLÁUSULA TERCEIRA – DAS DESPESAS", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("Todas as despesas judiciais e/ou administrativas (custas, taxas, emolumentos, deslocamentos, cópias, certidões, perícias, etc.) necessárias ao andamento do processo serão de responsabilidade exclusiva do(a) CONTRATANTE, não estando incluídas nos honorários ora contratados. Os CONTRATADOS se obrigam a prestar contas de toda e qualquer despesa realizada, mediante apresentação de comprovantes.", { fontSize: 10, align: 'justify', marginBottom: 3 });

          writeText("CLÁUSULA QUARTA – DAS OBRIGAÇÕES DAS PARTES", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("4.1. Dos CONTRATADOS: Atuar com zelo e diligência na defesa dos interesses do(a) CONTRATANTE, prestando informações sobre o andamento do processo sempre que solicitado ou quando houver movimentação relevante.", { fontSize: 10, align: 'justify', marginBottom: 1 });
          writeText("4.2. Do(a) CONTRATANTE: Fornecer todas as informações e documentos necessários para a defesa de seus interesses, bem como comparecer aos atos processuais que exigirem sua presença, sempre que solicitado pelos CONTRATADOS.", { fontSize: 10, align: 'justify', marginBottom: 3 });

          writeText("CLÁUSULA QUINTA – DA RESCISÃO", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("O presente contrato poderá ser rescindido por qualquer das partes, a qualquer tempo, mediante comunicação escrita. Em caso de rescisão unilateral por parte do(a) CONTRATANTE sem justa causa antes do término dos serviços, serão devidos honorários proporcionais ao trabalho já realizado, além do reembolso das despesas.", { fontSize: 10, align: 'justify', marginBottom: 3 });

          writeText("CLÁUSULA SEXTA – DO FORO", { fontStyle: 'bold', fontSize: 10, align: 'left', marginTop: 2, marginBottom: 1 });
          writeText("Fica eleito o foro da Comarca de São João de Meriti, Estado do Rio de Janeiro, para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia a qualquer outro, por mais privileged que seja.", { fontSize: 10, align: 'justify', marginBottom: 4 });

          writeText("E por estarem assim justos e contratados, as partes assinam o presente em 02 (duas) vias de igual teor e forma, na presença das duas testemunhas abaixo.", { fontSize: 10, align: 'justify', marginBottom: 4 });

          writeText(`São João de Meriti/RJ, ${currentDate}.`, { fontSize: 10, align: 'left', marginBottom: 6 });

          // Tabela de Assinaturas no Contrato
          const tableX = margin;
          const tableW = maxLineWidth;
          const col1W = tableW * 0.65;
          const headerH = 6;
          const rowH = 8;
          const numRows = 3;
          const totalTableH = headerH + (rowH * numRows);

          if (cursorY + totalTableH > pageHeight - 15) {
              doc.addPage();
              cursorY = 25;
          }

          doc.setLineWidth(0.3);
          doc.setDrawColor(0);

          const tableTopY = cursorY;
          doc.rect(tableX, tableTopY, tableW, totalTableH);
          doc.line(tableX + col1W, tableTopY, tableX + col1W, tableTopY + totalTableH);
          doc.line(tableX, tableTopY + headerH, tableX + tableW, tableTopY + headerH);
          for (let r = 1; r < numRows; r++) {
              doc.line(tableX, tableTopY + headerH + (rowH * r), tableX + tableW, tableTopY + headerH + (rowH * r));
          }

          doc.setFont("times", "bold");
          doc.setFontSize(8.5);
          doc.text("IDENTIFICAÇÃO:", tableX + 3, tableTopY + 4.5);
          doc.text("ASSINATURA:", tableX + col1W + 3, tableTopY + 4.5);

          doc.setFontSize(8);
          let rY = tableTopY + headerH;
          doc.text("MICHEL SANTOS FELIX - OAB/RJ: 231.640 (CONTRATADO)", tableX + 3, rY + 5.5);
          rY += rowH;
          doc.text("LUANA DE OLIVEIRA CASTRO PACHECO - OAB/RJ: 226.749 (CONTRATADA)", tableX + 3, rY + 5.5);
          rY += rowH;
          
          let contratanteLabel = `${clientName} - CPF: ${clientCPF} (CONTRATANTE)`;
          if (isMinor) {
              contratanteLabel += ` (rep: ${formData.legalRepresentative?.toUpperCase()})`;
          }
          doc.text(contratanteLabel, tableX + 3, rY + 5.5);
      }

      const pdfBase64 = doc.output('datauristring');
      let docName = 'Documento';
      if (type === 'procuracao') docName = 'Procuração (Gerada)';
      if (type === 'hipossuficiencia') docName = 'Hipossuficiência (Gerada)';
      if (type === 'renuncia') docName = 'Termo de Renúncia (Gerado)';
      if (type === 'contrato_honorarios') docName = 'Contrato de Honorários (Gerado)';

      const newDoc: ScannedDocument = {
          id: Math.random().toString(36).substr(2, 9),
          name: docName,
          type: 'application/pdf',
          url: pdfBase64,
          date: new Date().toLocaleDateString('pt-BR')
      };
      
      const updatedDocs = [...(formData.documents || []), newDoc];
      setFormData({ ...formData, documents: updatedDocs });
  };

  const fields = [
    { label: "Nome Completo", name: "name", type: "text", width: "full" },
    { label: "Nacionalidade", name: "nationality", type: "text", width: "third" },
    { label: "Estado Civil", name: "maritalStatus", type: "select", width: "third", options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"] },
    { label: "Profissão", name: "profession", type: "text", width: "third" },
    { label: "Gênero", name: "gender", type: "select", width: "third", options: ["M", "F"] },
    { label: "CPF", name: "cpf", type: "text", width: "third" },
    { label: "Senha INSS", name: "password", type: "text", width: "third" },
    { label: "WhatsApp", name: "whatsapp", type: "text", placeholder: "55219XXXXXXXX", width: "third" },
    { label: "Endereço Completo", name: "address", type: "text", width: "full" },
    
    // CAMPOS DO REPRESENTANTE LEGAL (Expandidos)
    { label: "Rep. Legal - Nome", name: "legalRepresentative", type: "text", width: "half" },
    { label: "Rep. Legal - Gênero", name: "legalRepresentativeGender", type: "select", width: "half", options: ["M", "F"] },
    { label: "Rep. Legal - CPF", name: "legalRepresentativeCpf", type: "text", width: "half" },
    { label: "Rep. Legal - Nacionalidade", name: "legalRepresentativeNationality", type: "text", width: "half" },
    { label: "Rep. Legal - Est. Civil", name: "legalRepresentativeMaritalStatus", type: "select", width: "half", options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"] },
    { label: "Rep. Legal - Profissão", name: "legalRepresentativeProfession", type: "text", width: "half" },
    { label: "Rep. Legal - Endereço Completo (c/ CEP)", name: "legalRepresentativeAddress", type: "text", width: "full" },

    { label: "Tipo Benefício", name: "type", type: "text", width: "half" },
    { label: "DER", name: "der", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Perícia Médica", name: "medExpertiseDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Perícia Social", name: "socialExpertiseDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "Prorrogação", name: "extensionDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "DCB", name: "dcbDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
    { label: "90 Dias (Auto)", name: "ninetyDaysDate", type: "text", width: "half", readOnly: true },
    { label: "Mand. Segurança", name: "securityMandateDate", type: "text", placeholder: "DD/MM/AAAA", width: "half" },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-bordeaux-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] h-full sm:h-auto flex flex-col border border-slate-200 dark:border-gold-500/20 overflow-hidden">
        {/* Fixed Header & Tabs Container - Never Scrolls Away */}
        <div className="shrink-0 bg-white dark:bg-bordeaux-950 border-b border-slate-100 dark:border-gold-500/20 z-10">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-gold-500/10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${initialData ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                  {initialData ? <PencilSquareIcon className="h-6 w-6" /> : <PlusIcon className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {initialData ? 'Editar Processo' : 'Novo Processo'}
                  </h3>
                  {formData.name && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-bordeaux-900/60 text-slate-700 dark:text-slate-200 font-bold max-w-[200px] truncate hidden sm:inline-block">
                      {formData.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gerencie informações cadastrais, histórico, documentos anexos e petições.
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-2 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-xl"
              title="Fechar Janela"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Prominent Fixed Tabs Bar */}
          <div className="flex items-center gap-1 px-6 pt-2 overflow-x-auto no-scrollbar bg-slate-50/70 dark:bg-bordeaux-900/20">
              <button 
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'info' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-bordeaux-950 rounded-t-lg shadow-sm' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                  <span>📋 Informações</span>
              </button>

              <button 
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'history' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-bordeaux-950 rounded-t-lg shadow-sm' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                  <span>⏳ Histórico do Caso</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'history'
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                      {formData.eventHistory?.length || 0}
                  </span>
              </button>

              <button 
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'docs' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-bordeaux-950 rounded-t-lg shadow-sm' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                  <span>📁 Documentos</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'docs'
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                      {formData.documents?.length || 0}
                  </span>
              </button>

              <button 
                  type="button"
                  onClick={() => setActiveTab('petitions')}
                  className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'petitions' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-bordeaux-950 rounded-t-lg shadow-sm' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                  <span>⚖️ Petições</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'petitions'
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                      {formData.petitions?.length || 0}
                  </span>
              </button>

              <button 
                  type="button"
                  onClick={() => setActiveTab('certidao')}
                  className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'certidao' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-bordeaux-950 rounded-t-lg shadow-sm' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                  <span>📜 Certidão Narratória</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'certidao'
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                      {formData.narrativeCertificates?.length || 0}
                  </span>
              </button>
          </div>
        </div>
        
        {/* Scrollable Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white dark:bg-bordeaux-950/50">
            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-6">
                {fields.map((field) => {
                    let spanClass = 'md:col-span-6';
                    if (field.width === 'half') spanClass = 'md:col-span-3';
                    if (field.width === 'third') spanClass = 'md:col-span-2';

                    return (
                        <div key={field.name} className={spanClass}>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                {field.label}
                            </label>
                            {field.type === 'select' ? (
                                <select
                                    name={field.name}
                                    value={(formData as any)[field.name] || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                >
                                    <option value="">Selecione...</option>
                                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            ) : (
                                <input
                                    type={field.type}
                                    name={field.name}
                                    value={(formData as any)[field.name] || ''}
                                    onChange={handleChange}
                                    placeholder={field.placeholder || ''}
                                    readOnly={field.readOnly}
                                    className={`w-full px-4 py-2.5 border rounded-xl outline-none transition text-sm
                                        ${field.readOnly 
                                            ? 'bg-slate-50 dark:bg-bordeaux-900/40/50 text-slate-500 cursor-not-allowed border-slate-200 dark:border-gold-500/15' 
                                            : 'bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500'
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
                
                <div className="md:col-span-6 mt-2 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 dark:border-gold-500/15 rounded-xl hover:bg-slate-50 dark:hover:bg-bordeaux-900/50/50 transition group">
                        <input 
                            type="checkbox" 
                            checked={formData.isReferral || false}
                            onChange={(e) => setFormData({...formData, isReferral: e.target.checked})}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                        />
                        <div>
                            <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                                Cliente Indicado
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Marque se este cliente foi indicado por alguém.
                            </span>
                        </div>
                    </label>

                    {formData.isReferral && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-slate-200 dark:border-gold-500/15 rounded-xl bg-slate-50 dark:bg-bordeaux-900/40/50">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Nome do Indicador
                                </label>
                                <input
                                    type="text"
                                    name="referrerName"
                                    value={formData.referrerName || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Porcentagem (%)
                                </label>
                                <input
                                    type="number"
                                    name="referrerPercentage"
                                    value={formData.referrerPercentage || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Total Honorários (R$)
                                </label>
                                <input
                                    type="number"
                                    name="totalFee"
                                    value={formData.totalFee || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-bordeaux-900/40 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                />
                            </div>
                        </div>
                    )}
                    
                    <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 dark:border-gold-500/15 rounded-xl hover:bg-slate-50 dark:hover:bg-bordeaux-900/50/50 transition group">
                        <input 
                            type="checkbox" 
                            checked={formData.isDailyAttention || false}
                            onChange={(e) => setFormData({...formData, isDailyAttention: e.target.checked})}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                        />
                        <div>
                            <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                                Monitoramento Diário (Prioridade)
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Marque esta opção para destacar este cliente na lista.
                            </span>
                        </div>
                    </label>
                </div>

                <div className="md:col-span-6 flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-gold-500/20">
                    <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 hover:bg-slate-50 dark:hover:bg-bordeaux-900/60 rounded-xl transition shadow-sm"
                    >
                    Cancelar
                    </button>
                    <button
                    type="submit"
                    className="px-5 py-2.5 text-white font-medium bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition flex items-center gap-2 transform active:scale-95"
                    >
                    <CheckIcon className="h-5 w-5" />
                    Salvar Alterações
                    </button>
                </div>
                </form>
            ) : activeTab === 'history' ? (
                <ClientTimeline 
                    client={formData as ClientRecord}
                    agendaEvents={agendaEvents}
                    user={user}
                    onUpdateHistory={(updatedHistory) => {
                        const updated = { ...formData, eventHistory: updatedHistory };
                        setFormData(updated);
                    }}
                    onSaveClientDirectly={async (updatedClient) => {
                        setFormData(updatedClient);
                        await onSave(updatedClient);
                    }}
                />
            ) : activeTab === 'docs' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Documentos Digitalizados</h4>
                        <div className="flex items-center gap-2">
                            {formData.documents?.some(d => d.type === 'application/pdf') && (
                                <button 
                                    onClick={async () => {
                                        const pdfDocs = formData.documents?.filter(d => d.type === 'application/pdf') || [];
                                        for (const doc of pdfDocs) {
                                            await downloadFileRobust(doc.url, doc.name);
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-slate-100 dark:bg-bordeaux-900/40 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-gold-500/15 hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 transition"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Baixar PDFs
                                </button>
                            )}
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,image/*,.txt"
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-bordeaux-900/40 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-gold-500/15 hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 transition"
                            >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Upload
                            </button>
                            {isAttaching && (
                                <span className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Enviando arquivo(s)... aguarde
                                </span>
                            )}
                            <button 
                                onClick={handleUnifiedOCR}
                                disabled={isGeneratingOCR || !formData.documents || formData.documents.length === 0}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {isGeneratingOCR ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <BoltIcon className="h-4 w-4" />}
                                {isGeneratingOCR ? 'Lendo...' : 'Gerar OCR Unificado'}
                            </button>
                            <button 
                                onClick={() => setIsScannerOpen(true)}
                                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-primary-700 transition"
                            >
                                <CameraIcon className="h-4 w-4" />
                                Nova Digitalização
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        {/* Procuração */}
                        <div className="flex flex-col p-3 bg-slate-50 dark:bg-bordeaux-900/40 rounded-xl border border-slate-200 dark:border-gold-500/15 justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <DocumentTextIcon className="h-5 w-5 text-blue-500 shrink-0" />
                                <span>Procuração</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenInEditor('procuracao')}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                    title="Abrir no Editor do Escritório"
                                >
                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                    Editor
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => generatePDF('procuracao')}
                                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold transition"
                                    title="Baixar PDF direto"
                                >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                    PDF
                                </button>
                            </div>
                        </div>

                        {/* Declaração */}
                        <div className="flex flex-col p-3 bg-slate-50 dark:bg-bordeaux-900/40 rounded-xl border border-slate-200 dark:border-gold-500/15 justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <ScaleIcon className="h-5 w-5 text-purple-500 shrink-0" />
                                <span>Declaração</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenInEditor('hipossuficiencia')}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                    title="Abrir no Editor do Escritório"
                                >
                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                    Editor
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => generatePDF('hipossuficiencia')}
                                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold transition"
                                    title="Baixar PDF direto"
                                >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                    PDF
                                </button>
                            </div>
                        </div>

                        {/* Renúncia */}
                        <div className="flex flex-col p-3 bg-slate-50 dark:bg-bordeaux-900/40 rounded-xl border border-slate-200 dark:border-gold-500/15 justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500 shrink-0" />
                                <span>Renúncia Teto</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenInEditor('renuncia')}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                    title="Abrir no Editor do Escritório"
                                >
                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                    Editor
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => generatePDF('renuncia')}
                                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold transition"
                                    title="Baixar PDF direto"
                                >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                    PDF
                                </button>
                            </div>
                        </div>

                        {/* Contrato de Honorários Previdenciário */}
                        <div className="flex flex-col p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-300/40 dark:border-amber-500/20 justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                <DocumentTextIcon className="h-5 w-5 text-amber-600 shrink-0" />
                                <span>Contrato Honorários</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenInEditor('contrato_honorarios')}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                    title="Abrir Contrato de Honorários Previdenciário no Editor"
                                >
                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                    Editor
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => generatePDF('contrato_honorarios')}
                                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-200 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-lg text-[11px] font-bold transition"
                                    title="Baixar PDF do Contrato"
                                >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                    PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {formData.documents && formData.documents.length > 0 ? (
                            formData.documents.map((doc, idx) => (
                                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl gap-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => moveDocument(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
                                            <button onClick={() => moveDocument(idx, 'down')} disabled={idx === formData.documents!.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
                                        </div>
                                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                            <DocumentTextIcon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {editingDocId === doc.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editDocName} 
                                                        onChange={(e) => setEditDocName(e.target.value)}
                                                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-bordeaux-900/60 dark:border-slate-600 dark:text-white"
                                                        autoFocus
                                                        onKeyDown={(e) => e.key === 'Enter' && saveDocName(doc.id)}
                                                    />
                                                    <button onClick={() => saveDocName(doc.id)} className="text-green-600 hover:text-green-700"><CheckIcon className="h-5 w-5" /></button>
                                                    <button onClick={() => setEditingDocId(null)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="h-5 w-5" /></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate" title={doc.name}>{doc.name}</p>
                                                    {doc.url.startsWith('http') && <CloudIcon className="h-3 w-3 text-blue-500" title="Armazenado na Nuvem" />}
                                                    <button onClick={() => startEditingDoc(doc)} className="text-slate-400 hover:text-primary-600"><PencilSquareIcon className="h-4 w-4" /></button>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <p className="text-xs text-slate-500">{doc.date} • {doc.type === 'application/pdf' ? 'PDF' : 'IMG'}</p>
                                                {doc.tags?.map(tagId => {
                                                    const t = AVAILABLE_TAGS.find(t => t.id === tagId);
                                                    return t ? <span key={tagId} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${t.color}`}>{t.label}</span> : null;
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:ml-auto">
                                        {syncStatus[doc.id] === 'syncing' && <span className="text-xs text-blue-500 flex items-center gap-1"><ArrowPathIcon className="h-3 w-3 animate-spin" /> Salvando...</span>}
                                        {syncStatus[doc.id] === 'compressing' && <span className="text-xs text-amber-500 flex items-center gap-1"><ArrowPathIcon className="h-3 w-3 animate-spin" /> Comprimindo...</span>}
                                        {syncStatus[doc.id] === 'error' && <button onClick={() => retryUpload(doc.id)} className="text-xs text-red-500 flex items-center gap-1 hover:underline"><ArrowPathIcon className="h-3 w-3" /> Tentar Novamente</button>}
                                        
                                        <button 
                                            onClick={() => handleCompressDocument(doc)} 
                                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" 
                                            title="Comprimir Documento"
                                            disabled={syncStatus[doc.id] === 'compressing'}
                                        >
                                            <BoltIcon className="h-5 w-5" />
                                        </button>

                                        <div className="relative">
                                            <button onClick={() => setActiveTagMenu(activeTagMenu === doc.id ? null : doc.id)} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 rounded-lg" title="Etiquetas">
                                                <TagIcon className="h-5 w-5" />
                                            </button>
                                            {activeTagMenu === doc.id && (
                                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl shadow-lg z-10 p-2">
                                                    <p className="text-xs font-bold text-slate-500 mb-2 px-2">Etiquetas</p>
                                                    {AVAILABLE_TAGS.map(t => (
                                                        <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-bordeaux-900/60 rounded cursor-pointer">
                                                            <input type="checkbox" checked={doc.tags?.includes(t.id) || false} onChange={() => toggleTag(doc.id, t.id)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                            <span className={`text-xs px-1.5 py-0.5 rounded-md border ${t.color}`}>{t.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleOpenInEditor('custom', doc.name, doc.url)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" 
                                            title="Abrir no Editor do Escritório"
                                        >
                                            <PencilSquareIcon className="h-5 w-5" />
                                        </button>
                                        <button 
                                            onClick={() => downloadFileRobust(doc.url, doc.name)}
                                            className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" 
                                            title="Baixar"
                                        >
                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleRemoveDocument(doc.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Excluir">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-gold-500/20 rounded-xl">
                                <DocumentPlusIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhum documento anexado.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-gold-500/20 text-right">
                         <button
                            type="button"
                            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
                            className="px-5 py-2.5 text-white font-medium bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition flex items-center gap-2 ml-auto"
                        >
                            <CheckIcon className="h-5 w-5" />
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            ) : activeTab === 'petitions' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Petições do Cliente</h4>
                    </div>

                    <div className="space-y-3">
                        {formData.petitions && formData.petitions.length > 0 ? (
                            formData.petitions.map((petition, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                            <DocumentTextIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{petition.title}</p>
                                            <p className="text-xs text-slate-500">{petition.lastModified} • {petition.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => onOpenPetition?.(petition, formData.id)}
                                            className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" 
                                            title="Editar no Editor"
                                        >
                                            <PencilSquareIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleRemovePetition(petition.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Excluir">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-gold-500/20 rounded-xl">
                                <DocumentPlusIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhuma petição vinculada.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-gold-500/20 text-right">
                         <button
                            type="button"
                            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
                            className="px-5 py-2.5 text-white font-medium bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition flex items-center gap-2 ml-auto"
                        >
                            <CheckIcon className="h-5 w-5" />
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            ) : activeTab === 'certidao' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Certidões Narratórias</h4>
                        <div className="flex items-center gap-2">
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,image/*,.txt"
                                ref={certidaoFileInputRef} 
                                onChange={handleCertidaoUpload} 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => certidaoFileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-bordeaux-900/40 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-gold-500/15 hover:bg-slate-200 dark:hover:bg-bordeaux-900/60 transition"
                            >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Upload
                            </button>
                            {isAttaching && (
                                <span className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Enviando arquivo(s)... aguarde
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {formData.narrativeCertificates && formData.narrativeCertificates.length > 0 ? (
                            formData.narrativeCertificates.map((doc, idx) => (
                                <div key={doc.id || idx} className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-bordeaux-900/40 border border-slate-200 dark:border-gold-500/15 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center shrink-0">
                                                <DocumentTextIcon className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">
                                                    {doc.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {doc.type} • {doc.date ? new Date(doc.date).toLocaleDateString('pt-BR') : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => downloadFileRobust(doc.url, doc.name)}
                                                className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" 
                                                title="Baixar"
                                            >
                                                <ArrowDownTrayIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => handleRemoveCertidao(doc.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Excluir">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full mt-2">
                                        {syncStatus[doc.id] === 'syncing' ? (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 w-fit">Salvando...</span>
                                        ) : syncStatus[doc.id] === 'error' ? (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit">Recarregue e tente novamente</span>
                                        ) : syncStatus[doc.id] === 'success' ? (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 w-fit">Salvo no Supabase</span>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-gold-500/20 rounded-xl">
                                <DocumentTextIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhuma certidão narratória enviada.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
      </div>
      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onSave={handleScannerSave} />
    </div>
    </div>
  );
};

export default RecordModal;
