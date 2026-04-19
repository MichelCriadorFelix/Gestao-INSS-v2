
// v1.0.1 - Unified OCR Enabled
import React, { useState, useEffect, useRef } from 'react';
import { PencilSquareIcon, PlusIcon, XMarkIcon, CameraIcon, DocumentTextIcon, ScaleIcon, ClipboardDocumentCheckIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon, DocumentPlusIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, TagIcon, ArrowPathIcon, CloudIcon, BoltIcon } from '@heroicons/react/24/outline';
import { jsPDF } from "jspdf";
import { ClientRecord, RecordModalProps, ScannedDocument } from '../types';
import { parseDate, addDays, formatDate } from '../utils';
import { compressPDF, compressImage } from '../utils/compressionUtils';
import ScannerModal from './ScannerModal';
import { supabaseService } from '../services/supabaseService';

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSave, initialData, onOpenPetition }) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({
      nationality: 'Brasileira',
      maritalStatus: 'Solteiro(a)',
      profession: ''
  });
  const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'petitions'>('info');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [syncStatus, setSyncStatus] = useState<Record<string, 'syncing' | 'error' | 'success' | 'compressing'>>({});
  const [activeTagMenu, setActiveTagMenu] = useState<string | null>(null);
  const [isGeneratingOCR, setIsGeneratingOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const AVAILABLE_TAGS = [
      { id: 'pessoal', label: 'Pessoal', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      { id: 'trabalhista', label: 'Trabalhista', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      { id: 'medico', label: 'Médico', color: 'bg-red-100 text-red-700 border-red-200' },
      { id: 'previdenciario', label: 'Previdenciário', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      { id: 'outro', label: 'Outro', color: 'bg-slate-100 text-slate-700 border-slate-200' }
  ];

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
          nationality: 'Brasileira',
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
        const response = await fetch(doc.url);
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ClientRecord);
  };

  const handleRemoveDocument = (docId: string) => {
      const updatedDocs = (formData.documents || []).filter(d => d.id !== docId);
      setFormData({ ...formData, documents: updatedDocs });
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

          const uploadedToGemini = [];
          for (let i = 0; i < docsToProcess.length; i++) {
               const doc = docsToProcess[i];
               const res = await fetch('/api/upload-from-url', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                       url: doc.url,
                       mimeType: doc.type,
                       fileName: doc.name
                   })
               });
               if (!res.ok) throw new Error(`Falha ao preparar ${doc.name} para a IA`);
               const data = await res.json();
               uploadedToGemini.push({ fileUri: data.fileUri, mimeType: data.mimeType, name: doc.name });
          }

          const ocrRes = await fetch('/api/ocr-unified', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ documents: uploadedToGemini })
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
                       tag: 'medico'
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

              const newDoc: ScannedDocument = {
                  id,
                  name: file.name,
                  type: file.type || 'application/pdf',
                  url: finalUrl,
                  date: new Date().toISOString()
              };
              
              newDocs.push(newDoc);
          } catch (error) {
              console.error("Error reading file:", error);
              newSyncStatus[id] = 'error';
          }
      }

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

  const generatePDF = (type: 'procuracao' | 'hipossuficiencia' | 'renuncia') => {
      // @ts-ignore
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const maxLineWidth = pageWidth - (margin * 2);
      
      const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const clientName = formData.name?.toUpperCase() || "__________________________";
      const clientCPF = formData.cpf || "___.___.___-__";
      const clientAddress = formData.address || "__________________________";
      const clientNationality = formData.nationality || "brasileiro(a)";
      const clientMarital = formData.maritalStatus || "estado civil";
      const clientProfession = formData.profession || "profissão";
      
      // Lógica para menor impúbere / representante legal
      const isMinor = !!formData.legalRepresentative;
      
      // Cores para as linhas decorativas (Tom Vinho/Avermelhado Premium)
      const decorColor = [140, 20, 20]; 

      // --- Desenhar Linha Decorativa Superior ---
      doc.setDrawColor(255, 255, 255); // Branco (invisível)
      doc.setLineWidth(1.5);
      doc.line(margin, 5, pageWidth - margin, 5); // Aproximado da margem
      
      doc.setDrawColor(255, 255, 255); // Branco (invisível)
      doc.setLineWidth(0.5);
      doc.line(margin, 6, pageWidth/3, 6); // Aproximado da margem

      // --- Desenhar Linha Decorativa Inferior ---
      doc.setDrawColor(255, 255, 255); // Branco (invisível)
      doc.setLineWidth(1.5);
      doc.line(margin, pageHeight - 5, pageWidth - margin, pageHeight - 5); // Aproximado da margem
      
      doc.setDrawColor(255, 255, 255); // Branco (invisível)
      doc.setLineWidth(2);
      doc.line(pageWidth - margin - 30, pageHeight - 5, pageWidth - margin, pageHeight - 5); // Aproximado da margem

      // --- Helper para Justificar Texto TOTAL (Full Justify) ---
      const drawFullyJustifiedBlock = (label: string, text: string, startY: number) => {
          doc.setFont("times", "bold");
          doc.text(label, margin, startY);
          const labelWidth = doc.getTextWidth(label + " ");
          
          doc.setFont("times", "normal");
          const words = text.split(/\s+/); // Separa por qualquer espaço em branco
          const spaceWidth = doc.getTextWidth(" "); // Largura padrão do espaço

          let lines: string[][] = [];
          let currentLineWords: string[] = [];
          let currentLineWidth = 0;

          // Define limites
          const firstLineMaxWidth = maxLineWidth - labelWidth;

          // Algoritmo de Quebra de Linha
          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              
              // Limite da linha atual (primeira linha tem recuo)
              const limit = lines.length === 0 ? firstLineMaxWidth : maxLineWidth;

              // Verifica se a palavra cabe (largura atual + espaço + palavra)
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > limit) {
                  // Linha cheia, salva e inicia nova
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  // Adiciona palavra à linha atual
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          // Adiciona a última linha pendente
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          // Renderização com Cálculo de Espaçamento Extra
          let currentY = startY;
          
          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              const isFirstLine = lineIndex === 0;
              
              const xStart = isFirstLine ? margin + labelWidth : margin;
              const lineWidthAvailable = isFirstLine ? firstLineMaxWidth : maxLineWidth;

              if (isLastLine) {
                  // Última linha: Alinhamento à Esquerda (padrão normal)
                  let x = xStart;
                  lineWords.forEach((word) => {
                      doc.text(word, x, currentY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  // Linhas do meio: Justificação Total (Espalha espaços)
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = lineWidthAvailable - totalWordsWidth;
                  
                  // Se houver apenas 1 palavra na linha (ex: palavra gigante), não justifica
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;

                  let x = xStart;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, currentY);
                      // Adiciona espaço calculado, exceto após a última palavra
                      if (wIdx < gaps) {
                          x += doc.getTextWidth(word) + spaceSize;
                      }
                  });
              }
              currentY += 6; // Altura da linha
          });

          return currentY + 4; // Retorna novo Y com padding
      };

      // --- Configuração de Fonte Padrão (Times) ---
      doc.setFont("times", "normal");
      
      if (type === 'procuracao') {
          // TÍTULO - Ajustado Y para caber na página
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("PROCURAÇÃO AD JUDICIA ET EXTRA", pageWidth / 2, 30, { align: "center" });
          
          doc.setFontSize(12);
          
          // Ajustado cursorY inicial para 55 (antes 80) para economizar espaço
          let cursorY = 55;
          
          // Lógica de texto para Representante Legal
          let outorganteText = "";
          if (isMinor) {
              // Texto para menor impúbere conforme solicitado
              const repName = formData.legalRepresentative?.toUpperCase() || "________________";
              const repNacionality = formData.nationality || "brasileira"; // Assume nationality of parent usually matches or generic
              const repCivil = formData.legalRepresentativeMaritalStatus || "solteira";
              const repProf = formData.legalRepresentativeProfession || "do lar";
              const repCPF = formData.legalRepresentativeCpf || "___.___.___-__";
              const repAddress = formData.legalRepresentativeAddress || clientAddress; // Usa endereço do rep ou do cliente

              outorganteText = `${clientName}, menor impúbere, ${clientNationality}, pensionista, inscrito no CPF sob o nº ${clientCPF}, representado por sua genitora e outorgante, ${repName}, ${repNacionality}, ${repCivil}, ${repProf} inscrita no CPF sob o nº ${repCPF} residente e domiciliado à ${repAddress}.`;
          } else {
              outorganteText = `${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}.`;
          }
          
          cursorY = drawFullyJustifiedBlock("OUTORGANTE:", outorganteText, cursorY);

          const outorgadoText = `MICHEL SANTOS FELIX, inscrito na OAB/RJ sob o nº 231.640 e no CPF/MF nº 142.805.877-01, e LUANA DE OLIVEIRA CASTRO PACHECO, inscrita na OAB/RJ sob o nº 226.749 e inscrita no CPF sob o nº 113.599.127-89, com endereço eletrônico felixecastroadv@gmail.com, e endereço profissional sito na Av. Prefeito José de Amorim, 500, apto. 204 , Jardim Meriti – São João de Meriti/RJ, CEP 25.555-201.`;
          cursorY = drawFullyJustifiedBlock("OUTORGADO:", outorgadoText, cursorY);

          const poderesText = `Pelo presente instrumento o outorgante confere ao outorgado amplos poderes para o foro em geral, com cláusula ad judicia et extra, para representá-lo nos órgãos públicos e privados, agências do INSS, Juízos, Instâncias ou Tribunais, possibilitando propor ações de direito competentes e defendê-lo até o final da decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para requerer concessão/revisão de benefícios previdenciários, obter cópias de expedientes e processos administrativos, acessar laudos sociais e periciais, acessar e manejar extratos, sistemas e telas do INSS, agendar serviços e atendimentos no INSS, receber valores e dar quitação, levantar valores, incluindo RPVs e precatórios (podendo para tanto assinar declaração de isenção de imposto de renda), obter extratos de contas judiciais, requerer expedição/retificação de certidões, incluindo Certidões de Tempo de Contribuição, obter cópia de documentos, Perfis Profissiográficos Previdenciários e laudos técnicos, obter cópia de documentos médicos e prontuários, firmar compromissos ou acordos, receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, assinar declaração de hipossuficiência econômica e substabelecer a outrem, com ou sem reservas de iguais poderes, para agir em conjunto ou separadamente com o substabelecido.`;
          cursorY = drawFullyJustifiedBlock("PODERES:", poderesText, cursorY);
          
          // Data e Assinatura com posição dinâmica
          cursorY += 10;
          if (cursorY > pageHeight - 50) { doc.addPage(); cursorY = 40; } // Nova página se necessário

          doc.setFont("times", "normal");
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0); // Preto
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          cursorY += 5;
          doc.setFont("times", "bold");
          
          if (isMinor) {
              // Assinatura com Representante
              doc.text(`${clientName}`, pageWidth / 2, cursorY, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 5, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY, { align: "center" });
          }

      } else if (type === 'hipossuficiencia') {
          // TÍTULO
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA", pageWidth / 2, 50, { align: "center" });
          
          doc.setFontSize(12);
          doc.setFont("times", "normal");
          
          let cursorY = 90;
          let text = "";
          
          if (isMinor) {
               text = `Eu, ${formData.legalRepresentative?.toUpperCase()}, brasileiro(a), representante legal de ${clientName}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          } else {
               text = `Eu, ${clientName}, ${clientNationality}, ${clientMarital}, ${clientProfession}, inscrito(a) no CPF sob o nº ${clientCPF}, residente e domiciliado(a) à ${clientAddress}, DECLARO para os devidos fins de direito que não possuo condições de arcar com as custas processuais e despesas judiciais sem causar prejuízos ao meu próprio sustento e ao da minha família, nos termos dos arts. 98 a 102 da Lei 13.105/2015.`;
          }
          
          // Usando o novo justificador sem label
          const words = text.split(/\s+/);
          const spaceWidth = doc.getTextWidth(" ");
          const lines: string[][] = [];
          let currentLineWords: string[] = [];
          let currentLineWidth = 0;

          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxLineWidth) {
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              if (isLastLine) {
                  let x = margin;
                  lineWords.forEach(word => {
                      doc.text(word, x, cursorY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = maxLineWidth - totalWordsWidth;
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;
                  let x = margin;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, cursorY);
                      if (wIdx < gaps) x += doc.getTextWidth(word) + spaceSize;
                  });
              }
              cursorY += 7; // Line height maior para declaração
          });
          
          cursorY += 30;
          
          // ASSINATURA
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          doc.setFont("times", "bold");
          
          if (isMinor) {
              doc.text(`${clientName}`, pageWidth / 2, cursorY + 5, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 10, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY + 5, { align: "center" });
          }

      } else if (type === 'renuncia') {
          // TÍTULO
          doc.setFont("times", "bold");
          doc.setFontSize(16);
          doc.text("DA RENÚNCIA AOS VALORES EXCEDENTES", pageWidth / 2, 50, { align: "center" });
          doc.text("AO TETO DO JEF", pageWidth / 2, 58, { align: "center" });
          
          doc.setFontSize(12);
          doc.setFont("times", "normal");
          
          let cursorY = 90;
          let text = "";
          
          if (isMinor) {
              text = `${clientName}, CPF nº ${clientCPF}, neste ato representado por ${formData.legalRepresentative?.toUpperCase()}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          } else {
              text = `${clientName}, CPF nº ${clientCPF}, renuncia à soma das parcelas vencidas e 12 vincendas que excedem ao teto do Juizado Especial Federal, a fim de permitir o trâmite da presente ação no Juizado Especial Federal, conforme Tema 1.030 do STJ.`;
          }
          
          // Mesmo justificador manual da hipossuficiência
          const words = text.split(/\s+/);
          const spaceWidth = doc.getTextWidth(" ");
          const lines: string[][] = [];
          let currentLineWords: string[] = [];
          let currentLineWidth = 0;

          for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const wordWidth = doc.getTextWidth(word);
              if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxLineWidth) {
                  lines.push(currentLineWords);
                  currentLineWords = [word];
                  currentLineWidth = wordWidth;
              } else {
                  if (currentLineWords.length > 0) currentLineWidth += spaceWidth;
                  currentLineWords.push(word);
                  currentLineWidth += wordWidth;
              }
          }
          if (currentLineWords.length > 0) lines.push(currentLineWords);

          lines.forEach((lineWords, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              if (isLastLine) {
                  let x = margin;
                  lineWords.forEach(word => {
                      doc.text(word, x, cursorY);
                      x += doc.getTextWidth(word) + spaceWidth;
                  });
              } else {
                  const totalWordsWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
                  const gaps = lineWords.length - 1;
                  const extraSpace = maxLineWidth - totalWordsWidth;
                  const spaceSize = gaps > 0 ? extraSpace / gaps : 0;
                  let x = margin;
                  lineWords.forEach((word, wIdx) => {
                      doc.text(word, x, cursorY);
                      if (wIdx < gaps) x += doc.getTextWidth(word) + spaceSize;
                  });
              }
              cursorY += 7;
          });
          
          cursorY += 30;
          
          // ASSINATURA
          doc.text(`São João de Meriti/RJ, ${currentDate}.`, margin, cursorY);
          
          cursorY += 25;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(pageWidth / 2 - 60, cursorY, pageWidth / 2 + 60, cursorY);
          
          doc.setFont("times", "bold");
          
          if (isMinor) {
              doc.text(`${clientName}`, pageWidth / 2, cursorY + 5, { align: "center" });
              doc.text(`(representado por: ${formData.legalRepresentative?.toUpperCase()})`, pageWidth / 2, cursorY + 10, { align: "center" });
          } else {
              doc.text(clientName, pageWidth / 2, cursorY + 5, { align: "center" });
          }
      }

      const pdfBase64 = doc.output('datauristring');
      let docName = 'Documento';
      if (type === 'procuracao') docName = 'Procuração (Gerada)';
      if (type === 'hipossuficiencia') docName = 'Hipossuficiência (Gerada)';
      if (type === 'renuncia') docName = 'Termo de Renúncia (Gerado)';

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
    { label: "CPF", name: "cpf", type: "text", width: "half" },
    { label: "Senha INSS", name: "password", type: "text", width: "half" },
    { label: "Endereço Completo", name: "address", type: "text", width: "full" },
    
    // CAMPOS DO REPRESENTANTE LEGAL (Expandidos)
    { label: "Rep. Legal - Nome", name: "legalRepresentative", type: "text", width: "full" },
    { label: "Rep. Legal - CPF", name: "legalRepresentativeCpf", type: "text", width: "half" },
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto max-w-3xl md:max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${initialData ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                {initialData ? <PencilSquareIcon className="h-6 w-6" /> : <PlusIcon className="h-6 w-6" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {initialData ? 'Editar Processo' : 'Novo Processo'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
            <button 
                onClick={() => setActiveTab('info')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'info' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Informações
            </button>
            <button 
                onClick={() => setActiveTab('docs')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'docs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Documentos ({formData.documents?.length || 0})
            </button>
            <button 
                onClick={() => setActiveTab('petitions')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'petitions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Petições ({formData.petitions?.length || 0})
            </button>
        </div>
        
        <div className="p-8">
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
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
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
                                            ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' 
                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500'
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
                
                <div className="md:col-span-6 mt-2 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Nome do Indicador
                                </label>
                                <input
                                    type="text"
                                    name="referrerName"
                                    value={formData.referrerName || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
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
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
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
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition text-sm"
                                />
                            </div>
                        </div>
                    )}
                    
                    <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
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

                <div className="md:col-span-6 flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition shadow-sm"
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
            ) : activeTab === 'docs' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Documentos Digitalizados</h4>
                        <div className="flex items-center gap-2">
                            {formData.documents?.some(d => d.type === 'application/pdf') && (
                                <button 
                                    onClick={() => {
                                        formData.documents?.filter(d => d.type === 'application/pdf').forEach(doc => {
                                            const link = document.createElement('a');
                                            link.href = doc.url;
                                            link.download = doc.name;
                                            link.click();
                                        });
                                    }}
                                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
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
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Upload
                            </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                        <button onClick={() => generatePDF('procuracao')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                            Gerar Procuração
                        </button>
                        <button onClick={() => generatePDF('hipossuficiencia')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <ScaleIcon className="h-5 w-5 text-purple-500" />
                            Gerar Declaração
                        </button>
                        <button onClick={() => generatePDF('renuncia')} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
                            Gerar Renúncia
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.documents && formData.documents.length > 0 ? (
                            formData.documents.map((doc, idx) => (
                                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl gap-3">
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
                                                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
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
                                            <button onClick={() => setActiveTagMenu(activeTagMenu === doc.id ? null : doc.id)} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg" title="Etiquetas">
                                                <TagIcon className="h-5 w-5" />
                                            </button>
                                            {activeTagMenu === doc.id && (
                                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 p-2">
                                                    <p className="text-xs font-bold text-slate-500 mb-2 px-2">Etiquetas</p>
                                                    {AVAILABLE_TAGS.map(t => (
                                                        <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                                                            <input type="checkbox" checked={doc.tags?.includes(t.id) || false} onChange={() => toggleTag(doc.id, t.id)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                                            <span className={`text-xs px-1.5 py-0.5 rounded-md border ${t.color}`}>{t.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <a href={doc.url} download={`${doc.name}.${doc.type === 'application/pdf' ? 'pdf' : 'jpg'}`} className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" title="Baixar">
                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                        </a>
                                        <button onClick={() => handleRemoveDocument(doc.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Excluir">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <DocumentPlusIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhum documento anexado.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-right">
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
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white">Petições do Cliente</h4>
                    </div>

                    <div className="space-y-3">
                        {formData.petitions && formData.petitions.length > 0 ? (
                            formData.petitions.map((petition, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
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
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <DocumentPlusIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Nenhuma petição vinculada.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-right">
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
            )}
      </div>
      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onSave={handleScannerSave} />
    </div>
    </div>
  );
};

export default RecordModal;
