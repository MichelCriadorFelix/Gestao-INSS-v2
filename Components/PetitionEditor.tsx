import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { ResizableImage } from 'tiptap-extension-resizable-image';
import 'tiptap-extension-resizable-image/styles.css';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const styles = `
  .ProseMirror-selectednode {
    outline: 2px solid #4285f4;
  }
  .ProseMirror p:has(img) {
    text-indent: 0 !important;
  }
  .ProseMirror ul {
    list-style-type: disc !important;
    margin-left: 1.5rem !important;
    margin-bottom: 1rem !important;
  }
  .ProseMirror ol {
    list-style-type: decimal !important;
    margin-left: 1.5rem !important;
    margin-bottom: 1rem !important;
  }
  .ProseMirror li {
    margin-bottom: 0.5rem !important;
    display: list-item !important;
  }
  .ProseMirror strong {
    font-weight: bold !important;
  }
  .ProseMirror em {
    font-style: italic !important;
  }
  .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
    font-weight: bold !important;
    margin-top: 1.5rem !important;
    margin-bottom: 1rem !important;
  }
  @media print {
    @page {
      margin: 2cm;
    }
    body {
      background: white !important;
    }
  }
`;

const PasteImageExtension = ResizableImage.extend({
  selectable: true,
}).configure({
  onUpload: (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        resolve({ src: readerEvent.target?.result as string });
      };
      reader.readAsDataURL(file);
    });
  },
});

import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Undo, Redo, Image as ImageIcon, Table as TableIcon, Save, 
  Trash2, Layout, ChevronLeft, ChevronDown, Search, Plus, FileDown, User, X, Settings, Palette, Scale,
  Phone, Mail, Instagram, Upload, Check, FileText as FileTextIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';

const vfsFonts = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;
(pdfMake as any).vfs = vfsFonts || {};
import { ClientRecord, Petition } from '../types';
import { extractTextFromPDF } from '../src/utils/pdfParser';
import { supabaseService } from '../services/supabaseService';
import { markdownToHtml } from '../src/utils/markdownToHtml';

interface ChatDocument {
  id: string;
  name: string;
  summary?: string;
  fullText?: string;
  type: string;
}

const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      indent: {
        default: '2cm',
        parseHTML: element => {
          if (element.classList.contains('no-indent')) return '0';
          return '2cm';
        },
        renderHTML: attributes => {
          if (attributes.indent === '0' || attributes.indent === 0) {
            return { class: 'no-indent' };
          }
          return {};
        },
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection;
        const isAtStart = $anchor.pos === $anchor.start();

        if (empty && isAtStart) {
          const node = $anchor.parent;
          if (node.type.name === this.name && node.attrs.indent !== 0 && node.attrs.indent !== '0') {
            this.editor.commands.updateAttributes(this.name, { indent: 0 });
            return true; // prevent default backspace behavior
          }
        }
        return false;
      },
    };
  },
});

interface PetitionEditorProps {
  clients: ClientRecord[];
  onBack: () => void;
  initialPetition?: Petition | null;
  initialClientId?: string | null;
  onSavePetition?: (clientId: string, petition: Petition, isAutoSave: boolean) => void;
}

interface HeaderFooterConfig {
  logo: string | null;
  color: string;
  headerPrimary: string;
  headerSecondary: string;
  footerPrimary: string;
  footerSecondary: string;
  whatsapp: string;
  email: string;
  instagram: string;
  template: 'losangos' | 'tramitacao' | 'lumina';
}

const PetitionEditor: React.FC<PetitionEditorProps> = ({ clients, onBack, initialPetition, initialClientId, onSavePetition }) => {
  const [title, setTitle] = useState(initialPetition?.title || 'NOVA PETIÇÃO SEM TÍTULO');
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(
    initialClientId ? (clients || []).find(c => c.id === initialClientId) || null :
    initialPetition ? (clients || []).find(c => c.petitions?.some(p => p.id === initialPetition.id)) || null : null
  );
  const [category, setCategory] = useState(initialPetition?.category || 'Petição inicial');
  const [type, setType] = useState<'model' | 'concrete'>(initialPetition?.type || 'concrete');
  const [isHeaderFooterModalOpen, setIsHeaderFooterModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<ChatDocument[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiProgressText, setAiProgressText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAiProgress(0);
    setAiProgressText('Iniciando processamento...');
    
    try {
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setAiProgress(Math.round((i / fileArray.length) * 100));
        setAiProgressText(`Lendo ${file.name}...`);

        let fileText = "";
        let images: string[] = [];

        if (file.type === 'application/pdf') {
          const result = await extractTextFromPDF(file);
          fileText = result.text;
          images = result.images;
          
          if (result.fileHash) {
            const cachedText = await supabaseService.getPdfCache(result.fileHash);
            if (cachedText) {
              fileText = cachedText;
            } else {
              if (result.isScanned && images.length > 0) {
                setAiProgressText(`Realizando OCR em ${file.name}...`);
                const ocrResponse = await fetch('/api/ocr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ images })
                });
                if (ocrResponse.ok) {
                  const ocrData = await ocrResponse.json();
                  if (ocrData.text) {
                    fileText += `\n--- OCR ---\n${ocrData.text}`;
                    await supabaseService.savePdfCache(result.fileHash, file.name, fileText);
                  }
                }
              } else if (fileText.trim()) {
                await supabaseService.savePdfCache(result.fileHash, file.name, fileText);
              }
            }
          }
        }

        // Generate Summary
        setAiProgressText(`Extraindo dados de ${file.name}...`);
        const response = await fetch('/api/dr-michel/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `EXTRAIA OS DADOS TÉCNICOS DESTE DOCUMENTO PARA UMA PETIÇÃO PADRÃO OURO. 
            Identifique: 
            1. Datas (DIB, DER, DCB, DII, Óbito).
            2. Valores (RMI, Salário de Benefício, Descontos, Consignações, Rubricas).
            3. Nomes e CPFs.
            4. Números de Benefício (NB).
            5. Histórico de indeferimentos ou cessações.
            6. Trechos relevantes para fundamentação.
            
            DOCUMENTO:\n${fileText.substring(0, 50000)}`,
            history: [],
            isIngestion: true
          })
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let summary = '';
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.text) summary += data.text;
                  } catch (e) {}
                }
              }
            }
          }

          const newDoc: ChatDocument = {
            id: generateId(),
            name: file.name,
            summary: summary,
            fullText: fileText,
            type: file.type
          };

          setUploadedDocs(prev => [...prev, newDoc]);
        }
      }
      setAiProgress(100);
      setAiProgressText('Documentos processados!');
      setTimeout(() => {
        setAiProgress(0);
        setAiProgressText('');
      }, 2000);
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao processar arquivos: ${error.message}`);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() && uploadedDocs.length === 0) return;
    
    setIsAiGenerating(true);
    setAiProgressText('Gerando petição com IA...');
    
    try {
      const docContext = uploadedDocs.map(doc => 
        `DOCUMENTO: ${doc.name}\nRESUMO: ${doc.summary}`
      ).join('\n\n---\n\n');

      const fullPrompt = `[CONTEXTO DO PROCESSO]\n${docContext}\n\n[SOLICITAÇÃO DO ADVOGADO]\n${aiPrompt}\n\nINSTRUÇÃO: Gere o conteúdo da petição em formato de texto plano, seguindo as regras do Dr. Michel Felix.`;

      const response = await fetch('/api/dr-michel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullPrompt,
          history: [],
          images: []
        })
      });

      if (!response.ok) throw new Error('Falha na geração');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullText += data.text;
                }
              } catch (e) {}
            }
          }
        }
      }

      // Format and insert into editor
      const formattedContent = markdownToHtml(fullText);

      editor?.commands.setContent(formattedContent);
      setIsAiPanelOpen(false);
      setAiPrompt('');
    } catch (error: any) {
      console.error(error);
      alert(`Erro na geração: ${error.message}`);
    } finally {
      setIsAiGenerating(false);
      setAiProgressText('');
    }
  };
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const sortedClients = [...(clients || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredClients = sortedClients.filter(c => (c.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase()));

  const [config, setConfig] = useState<HeaderFooterConfig>({
    logo: null,
    color: '#FF0000',
    headerPrimary: 'FELIX E CASTRO ADVOCACIA',
    headerSecondary: 'ESPECIALIZADA EM DIREITO PREVIDENCIÁRIO',
    footerPrimary: 'Rua José de Souza Neves, 75, Bairro Marajoara, Teófilo Otoni/MG',
    footerSecondary: 'CEP 39803-901 | (33) 99999-9999',
    whatsapp: '33999999999',
    email: 'contato@felixecastro.adv.br',
    instagram: '@felixecastro.adv',
    template: 'losangos'
  });

  const [topBottomMargin, setTopBottomMargin] = useState('3cm');
  const [leftRightMargin, setLeftRightMargin] = useState('2.5cm');
  const [contentChanged, setContentChanged] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomParagraph,
      BulletList,
      OrderedList,
      ListItem,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      PasteImageExtension,
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[1122px] w-[794px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-sm mb-20 [&_blockquote]:ml-[4cm] [&_blockquote]:text-sm [&_blockquote]:border-none [&_blockquote]:italic [&_blockquote]:text-slate-700 dark:[&_blockquote]:text-slate-700 font-serif [&_p]:indent-[2cm] [&_p.no-indent]:indent-0 whitespace-pre-wrap print:w-full print:min-h-0 print:shadow-none print:border-none print:m-0 print:bg-transparent',
        style: `line-height: 1.5; padding: ${topBottomMargin} ${leftRightMargin};`,
      },
    },
    onUpdate: () => {
      setContentChanged(c => c + 1);
    }
  });

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = styles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (editor) {
      editor.view.dom.style.padding = `${topBottomMargin} ${leftRightMargin}`;
    }
  }, [topBottomMargin, leftRightMargin, editor]);

  const loadedPetitionIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (editor) {
      if (initialPetition) {
        if (loadedPetitionIdRef.current !== initialPetition.id) {
          editor.commands.setContent(initialPetition.content);
          setTitle(initialPetition.title);
          setCategory(initialPetition.category);
          setType(initialPetition.type);
          
          // Find the client that owns this petition
          let client = null;
          if (initialClientId) {
            client = (clients || []).find(c => c.id === initialClientId);
          }
          if (!client) {
            client = (clients || []).find(c => c.petitions?.some(p => p.id === initialPetition.id));
          }
          if (client) {
            setSelectedClient(client);
          }
          
          loadedPetitionIdRef.current = initialPetition.id;
        }
      } else {
        if (loadedPetitionIdRef.current !== null) {
          editor.commands.setContent('');
          setTitle('NOVA PETIÇÃO SEM TÍTULO');
          setCategory('Petição inicial');
          setType('concrete');
          setSelectedClient(null);
          loadedPetitionIdRef.current = null;
        }
      }
    }
  }, [initialPetition, initialClientId, editor, clients]);

  // Efeito adicional para garantir que o cliente seja selecionado se a petição já estiver carregada
  // mas o cliente não estiver selecionado (ex: ao abrir do modal do cliente)
  useEffect(() => {
    if (initialPetition && !selectedClient && clients) {
        let client = null;
        if (initialClientId) {
          client = clients.find(c => c.id === initialClientId);
        }
        if (!client) {
          client = clients.find(c => c.petitions?.some(p => p.id === initialPetition.id));
        }
        if (client) {
            setSelectedClient(client);
        }
    }
  }, [initialPetition, initialClientId, selectedClient, clients]);

  const handleSave = async (isAutoSave: boolean = false) => {
    if (!editor) return;
    if (!selectedClient && type === 'concrete') {
      if (!isAutoSave) alert('Por favor, selecione um cliente para salvar esta petição.');
      return;
    }

    if (!isAutoSave) setIsSaving(true);
    
    const newId = initialPetition?.id || Math.random().toString(36).substr(2, 9);
    loadedPetitionIdRef.current = newId;
    
    const petitionData: Petition = {
      id: newId,
      title: title,
      content: editor.getHTML(),
      category: category,
      type: type,
      lastModified: new Date().toLocaleString('pt-BR')
    };

    if (onSavePetition && selectedClient) {
      onSavePetition(selectedClient.id, petitionData, isAutoSave);
    }

    setLastSaved(new Date().toLocaleTimeString());
    if (!isAutoSave) setTimeout(() => setIsSaving(false), 1000);
  };

  useEffect(() => {
    if (!editor || !selectedClient || contentChanged === 0) return;

    const timeoutId = setTimeout(() => {
      handleSave(true);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [contentChanged, title, category, type, selectedClient]);

  const generatePDF = async () => {
    if (!editor) return;
    
    setIsSaving(true);

    try {
      let rawHtml = editor.getHTML();
      // Ensure empty paragraphs take up space
      rawHtml = rawHtml.replace(/<p><\/p>/g, '<p>&nbsp;</p>');
      rawHtml = rawHtml.replace(/<p><br><\/p>/g, '<p>&nbsp;</p>');

      // Convert HTML to pdfmake format
      const pdfMakeContent = htmlToPdfmake(rawHtml, {
        defaultStyles: {
          p: {
            fontSize: 12,
            lineHeight: 1.5,
            alignment: 'justify',
            margin: [0, 0, 0, 12],
          },
          h1: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          h2: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          h3: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          h4: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          h5: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          h6: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 12, 0, 12] },
          blockquote: {
            fontSize: 12,
            italics: true,
            alignment: 'justify',
            margin: [113, 12, 0, 12], // 113pt is roughly 4cm
          },
          ul: { margin: [0, 12, 0, 12] },
          ol: { margin: [0, 12, 0, 12] },
          li: { fontSize: 12, lineHeight: 1.5 },
          table: { margin: [0, 12, 0, 12] },
          th: { bold: true, fillColor: '#ffffff', margin: [0, 0, 0, 0] },
          td: { margin: [0, 0, 0, 0] },
        }
      });

      // Recursively remove any 'font' property to force pdfmake to use defaultStyle font
      const removeFontProperty = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach(removeFontProperty);
        } else if (obj !== null && typeof obj === 'object') {
          if (obj.font) {
            delete obj.font;
          }
          Object.values(obj).forEach(removeFontProperty);
        }
      };
      removeFontProperty(pdfMakeContent);

      // Apply text-indent to paragraphs
      const applyIndent = (nodes: any[], inBlockquote = false, inTable = false) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach(node => {
          if (!node || typeof node !== 'object') return;
          
          const isBlockquote = node.nodeName === 'BLOCKQUOTE' || inBlockquote;
          const isTable = node.nodeName === 'TABLE' || inTable;
          
          if (node.nodeName === 'BLOCKQUOTE') {
            node.margin = [113, 12, 0, 12];
          }

          if (node.nodeName === 'P') {
            node.ul = undefined;
            node.ol = undefined;
            node.listType = undefined;
            node.listStyle = undefined;
            node.list = undefined;
            if (inTable) {
              node.alignment = 'left';
              node.leadingIndent = 0;
              node.bold = true;
              node.margin = [0, 0, 0, 0]; // Remove paragraph margin inside tables
            } else {
              const isCenterOrRight = node.alignment === 'center' || node.alignment === 'right';
              const hasNoIndentClass = node.style && (
                (Array.isArray(node.style) && node.style.includes('no-indent')) || 
                (typeof node.style === 'string' && node.style === 'no-indent')
              );
              
              if (!isCenterOrRight && !isBlockquote && !hasNoIndentClass) {
                node.leadingIndent = 56; // Roughly 2cm in points
              } else {
                node.leadingIndent = 0;
              }
            }
          }

          if (node.nodeName === 'TABLE' && node.table && node.table.body && node.table.body.length > 0) {
            const colCount = node.table.body[0].length;
            node.table.widths = Array(colCount).fill('*');
            node.layout = {
              hLineWidth: function () { return 1; },
              vLineWidth: function () { return 1; },
              hLineColor: function () { return '#d1b3b3'; }, // Light burgundy/brown
              vLineColor: function () { return '#d1b3b3'; },
              paddingLeft: function () { return 4; },
              paddingRight: function () { return 4; },
              paddingTop: function () { return 4; },
              paddingBottom: function () { return 4; },
            };
          }

          if (node.nodeName === 'IMG' || node.image) {
            delete node.width;
            delete node.height;
            delete node.fit;
            node.width = 495;
            node.alignment = 'center';
            node.margin = [0, 12, 0, 12];
          }

          if (node.stack) applyIndent(node.stack, isBlockquote, isTable);
          if (node.text && Array.isArray(node.text)) applyIndent(node.text, isBlockquote, isTable);
          if (node.ul) applyIndent(node.ul, isBlockquote, isTable);
          if (node.ol) applyIndent(node.ol, isBlockquote, isTable);
          if (node.table && node.table.body) {
            node.table.body.forEach((row: any[]) => {
              row.forEach((cell: any) => {
                if (cell && typeof cell === 'object') {
                  if (cell.stack) applyIndent(cell.stack, isBlockquote, true);
                  if (cell.text && Array.isArray(cell.text)) applyIndent(cell.text, isBlockquote, true);
                }
              });
            });
          }
        });
      };
      
      applyIndent(pdfMakeContent as any[]);

      // Load fonts into VFS if not already present
      const vfs = (pdfMake as any).vfs || {};
      
      const docDefinition: any = {
        content: pdfMakeContent,
        pageSize: 'A4',
        pageMargins: [50, 100, 50, 100], // Left, Top, Right, Bottom in points
        defaultStyle: {
          font: 'Roboto',
          fontSize: 12,
          lineHeight: 1.5,
          color: '#000000'
        },
        header: function(currentPage: number, pageCount: number) {
          return {
            canvas: [
              {
                type: 'polyline',
                closePath: true,
                color: '#d3545a', // Red
                lineWidth: 0,
                points: [{x: 50, y: 50}, {x: 195, y: 50}, {x: 200, y: 54}, {x: 50, y: 54}]
              },
              {
                type: 'polyline',
                closePath: true,
                color: '#e6b3b3', // Light red
                lineWidth: 0,
                points: [{x: 200, y: 50}, {x: 545, y: 50}, {x: 545, y: 54}, {x: 205, y: 54}]
              }
            ]
          };
        },
        footer: function(currentPage: number, pageCount: number) {
          return {
            canvas: [
              {
                type: 'rect',
                x: 120,
                y: 30, // Relative to footer top
                w: 425,
                h: 2,
                linearGradient: ['#ffffff', '#800000'] // Fades to dark red
              }
            ]
          };
        }
      };

      const pdfFontsConfig = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        }
      };

      pdfMake.createPdf(docDefinition, undefined, pdfFontsConfig, vfs).download(`${title}.pdf`);
      setIsSaving(false);

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Erro ao gerar PDF: ${error.message || 'Erro desconhecido'}`);
      setIsSaving(false);
    }
  };

  const insertBlock = (text: string) => {
    if (editor) {
      editor.chain().focus().insertContent(text).run();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-slate-200 dark:bg-slate-950 overflow-hidden print:overflow-visible print:h-auto print:bg-white">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-4 flex-shrink-0 z-10 shadow-sm print:hidden">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 font-bold text-sm uppercase"
          />
        </div>
        <div className="text-xs text-slate-400 font-bold">
          Documento #1892
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden print:overflow-visible">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 gap-6 flex-shrink-0 overflow-y-auto z-10 print:hidden">
          {/* Client Info */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                <User className="w-3 h-3" /> Cliente
              </div>
              <button 
                onClick={() => setSelectedClient(null)}
                className="text-indigo-600 hover:text-indigo-700"
                title="Alterar cliente"
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            </div>
            {selectedClient ? (
              <div className="text-sm">
                <p className="font-bold text-indigo-600">{selectedClient.name}</p>
                <p className="text-xs text-slate-500">#{selectedClient.id.slice(0,4)}</p>
              </div>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="w-full flex items-center justify-between bg-transparent border-none text-sm font-bold text-indigo-600 focus:ring-0 p-0 cursor-pointer"
                >
                  Selecionar Cliente
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {isClientDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar cliente..."
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredClients.length > 0 ? (
                        filteredClients.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedClient(c);
                              setIsClientDropdownOpen(false);
                              setClientSearchQuery('');
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition"
                          >
                            {c.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">
                          Nenhum cliente encontrado
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleSave(false)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button 
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition"
            >
              <FileDown className="w-4 h-4 text-red-500" /> Baixar PDF
            </button>
            <button 
              onClick={() => setIsHeaderFooterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition"
            >
              <Layout className="w-4 h-4 text-blue-500" /> Cabeçalho e rodapé
            </button>
            <button 
              onClick={() => {
                if (confirm('Tem certeza que deseja limpar todo o conteúdo do editor?')) {
                  editor.commands.setContent('');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition"
            >
              <Trash2 className="w-4 h-4 text-orange-500" /> Limpar Editor
            </button>
          </div>

          {/* Category & Type */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option>Petição inicial</option>
                <option>Contestação</option>
                <option>Recurso</option>
                <option>Procuração</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    checked={type === 'model'} 
                    onChange={() => setType('model')}
                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">Modelo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    checked={type === 'concrete'} 
                    onChange={() => setType('concrete')}
                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">Caso concreto</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className={`text-center py-2 rounded-lg text-xs font-bold mb-4 transition-colors ${isSaving ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
              {isSaving ? 'Salvando...' : 'Tudo salvo!'}
            </div>
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative print:overflow-visible print:block">
          {/* AI Panel */}
          <AnimatePresence>
            {isAiPanelOpen && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20 flex flex-col print:hidden"
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white">Assistente IA</h3>
                  </div>
                  <button onClick={() => setIsAiPanelOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Document Upload Section */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Documentos do Processo</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors group"
                    >
                      <Upload className="w-6 h-6 mx-auto text-slate-400 group-hover:text-indigo-500 mb-2" />
                      <p className="text-xs text-slate-500">Clique para anexar arquivos do processo (PDF)</p>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        multiple 
                        accept=".pdf" 
                        className="hidden" 
                      />
                    </div>

                    {uploadedDocs.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {uploadedDocs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileTextIcon className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                              <span className="text-[10px] font-medium truncate text-slate-700 dark:text-slate-300">{doc.name}</span>
                            </div>
                            <button 
                              onClick={() => setUploadedDocs(prev => prev.filter(d => d.id !== doc.id))}
                              className="p-1 hover:text-red-500 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Prompt Section */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">O que deseja gerar?</label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Gere uma petição inicial de aposentadoria por idade rural, destacando o período de 1990 a 2010 conforme documentos anexos."
                      className="w-full h-32 p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>

                  {aiProgressText && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-indigo-500">
                        <span>{aiProgressText}</span>
                        <span>{aiProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          className="bg-indigo-500 h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${aiProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <button
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || (!aiPrompt.trim() && uploadedDocs.length === 0)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                  >
                    {isAiGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Scale className="w-4 h-4" />
                        Gerar Conteúdo
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 flex flex-wrap items-center gap-1 flex-shrink-0 z-10 shadow-sm print:hidden">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              icon={<Bold className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              icon={<Italic className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
              icon={<UnderlineIcon className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              icon={<Strikethrough className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
              icon={<X className="w-4 h-4" />}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

            <ToolbarButton 
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })}
              icon={<AlignLeft className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })}
              icon={<AlignCenter className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })}
              icon={<AlignRight className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              active={editor.isActive({ textAlign: 'justify' })}
              icon={<AlignJustify className="w-4 h-4" />}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              icon={<Quote className="w-4 h-4" />}
              title="Citação (Recuo 4cm)"
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

            <ToolbarButton 
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              active={isAiPanelOpen}
              icon={<Scale className="w-4 h-4 text-indigo-500" />}
              title="Assistente de Petição IA"
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

            <ToolbarButton 
              onClick={() => editor.chain().focus().undo().run()}
              icon={<Undo className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().redo().run()}
              icon={<Redo className="w-4 h-4" />}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

            <ToolbarButton 
              onClick={() => {
                const url = window.prompt('URL da imagem:');
                if (url) editor.chain().focus().insertContent({ type: 'image', attrs: { src: url } }).run();
              }}
              icon={<ImageIcon className="w-4 h-4" />}
            />
            <ToolbarButton 
              onClick={() => setIsTableModalOpen(true)}
              icon={<TableIcon className="w-4 h-4" />}
              title="Configurar Tabela"
            />
            {editor.isActive('table') && (
              <div className="flex items-center gap-1 px-1 border-l border-slate-200 dark:border-slate-800 ml-1">
                <ToolbarButton 
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  icon={<div className="flex flex-col items-center"><TableIcon className="w-3 h-3" /><Plus className="w-2 h-2 text-emerald-500" /></div>}
                  title="Adicionar Linha"
                />
                <ToolbarButton 
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  icon={<div className="flex flex-col items-center"><TableIcon className="w-3 h-3" /><X className="w-2 h-2 text-red-500" /></div>}
                  title="Excluir Linha"
                />
                <ToolbarButton 
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  icon={<div className="flex items-center"><TableIcon className="w-3 h-3" /><Plus className="w-2 h-2 text-emerald-500" /></div>}
                  title="Adicionar Coluna"
                />
                <ToolbarButton 
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  icon={<div className="flex items-center"><TableIcon className="w-3 h-3" /><X className="w-2 h-2 text-red-500" /></div>}
                  title="Excluir Coluna"
                />
                <ToolbarButton 
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  icon={<Trash2 className="w-4 h-4 text-red-500" />}
                  title="Excluir Tabela"
                />
              </div>
            )}
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-y-auto p-12 bg-slate-200 dark:bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible print:block">
            <div className="relative print:shadow-none print:w-full print:max-w-none print:block">
              <EditorContent editor={editor} />
            </div>
          </div>
        </main>
      </div>

      {/* Table Modal */}
      <AnimatePresence>
        {isTableModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-500" /> Configurar Tabela
                </h3>
                <button onClick={() => setIsTableModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Linhas</label>
                  <input 
                    type="number" 
                    value={tableRows}
                    onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Colunas</label>
                  <input 
                    type="number" 
                    value={tableCols}
                    onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsTableModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
                    setIsTableModalOpen(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition shadow-md"
                >
                  Inserir Tabela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header/Footer Modal */}
      <AnimatePresence>
        {isHeaderFooterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <PencilSquareIcon className="w-5 h-5" /> Personalizar logotipo, cabeçalho e rodapé
                </h3>
                <button onClick={() => setIsHeaderFooterModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Margem Sup/Inf</label>
                        <input 
                          value={topBottomMargin}
                          onChange={(e) => setTopBottomMargin(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Margem Esq/Dir</label>
                        <input 
                          value={leftRightMargin}
                          onChange={(e) => setLeftRightMargin(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sua logo (opcional)</label>
                      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition cursor-pointer group">
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Arraste o seu logo aqui ou clique em</p>
                        <button className="mt-2 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 mx-auto">
                          <Upload className="w-3 h-3" /> Selecionar arquivo
                        </button>
                        <p className="mt-4 text-[10px] text-slate-400">Não tem logotipo? Não tem problema! Nossos designs funcionam mesmo sem um logotipo.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Escolha uma cor</label>
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer"
                            style={{ backgroundColor: config.color }}
                            onClick={() => {
                              const color = window.prompt('Cor (Hex):', config.color);
                              if (color) setConfig({ ...config, color });
                            }}
                          />
                          <button className="text-xs font-bold text-red-500 hover:underline">Trocar cor</button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                          <input type="checkbox" className="text-indigo-600 focus:ring-indigo-500 rounded" />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Também aplicar a cor ao imprimir as planilhas em PDF</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                      <Settings className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">Todos os campos são opcionais: se não quiser utilizar algum, basta deixá-lo em branco.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <InputField label="Texto cabeçalho em destaque" value={config.headerPrimary} onChange={(v) => setConfig({...config, headerPrimary: v})} />
                      <InputField label="Texto cabeçalho secundário" value={config.headerSecondary} onChange={(v) => setConfig({...config, headerSecondary: v})} />
                      <InputField label="Texto rodapé em destaque" value={config.footerPrimary} onChange={(v) => setConfig({...config, footerPrimary: v})} />
                      <InputField label="Texto rodapé secundário" value={config.footerSecondary} onChange={(v) => setConfig({...config, footerSecondary: v})} />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            placeholder="Whatsapp / Fone"
                            value={config.whatsapp}
                            onChange={(e) => setConfig({...config, whatsapp: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            placeholder="E-mail"
                            value={config.email}
                            onChange={(e) => setConfig({...config, email: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          placeholder="Instagram"
                          value={config.instagram}
                          onChange={(e) => setConfig({...config, instagram: e.target.value})}
                          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Templates */}
                <div className="mt-12">
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Clique no design desejado para personalizar</h4>
                  <p className="text-sm text-slate-500 mb-6">Ele será aplicado tanto às suas planilhas quanto às peças geradas no editor de texto, incluindo as peças do robô gerador.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <TemplateCard 
                      id="losangos" 
                      title="Losangos coloridos" 
                      selected={config.template === 'losangos'} 
                      onClick={() => setConfig({...config, template: 'losangos'})}
                    />
                    <TemplateCard 
                      id="tramitacao" 
                      title="Tramitação" 
                      selected={config.template === 'tramitacao'} 
                      onClick={() => setConfig({...config, template: 'tramitacao'})}
                    />
                    <TemplateCard 
                      id="lumina" 
                      title="Lumina" 
                      selected={config.template === 'lumina'} 
                      onClick={() => setConfig({...config, template: 'lumina'})}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mr-auto">
                  <Check className="w-4 h-4" /> Tudo salvo!
                </div>
                <button 
                  onClick={() => setIsHeaderFooterModalOpen(false)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-md"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ToolbarButton = ({ onClick, active = false, icon, onContextMenu, title }: { onClick: () => void, active?: boolean, icon: React.ReactNode, onContextMenu?: (e: React.MouseEvent) => void, title?: string }) => (
  <button 
    onClick={onClick}
    onContextMenu={onContextMenu}
    title={title}
    className={`p-2 rounded transition ${active ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
  >
    {icon}
  </button>
);

const InputField = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="relative">
    <input 
      placeholder="Opcional"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 peer placeholder-transparent"
    />
    <label className="absolute left-2 -top-2 px-1 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-500 uppercase transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:top-2 peer-placeholder-shown:left-4 peer-focus:-top-2 peer-focus:left-2 peer-focus:text-[10px]">
      {label}
    </label>
  </div>
);

const TemplateCard = ({ id, title, selected, onClick }: { id: string, title: string, selected: boolean, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${selected ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
  >
    {selected && (
      <div className="absolute -top-3 left-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <Check className="w-3 h-3" /> Selecionado
      </div>
    )}
    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center mb-4">{title}</p>
    <div className="aspect-[4/3] bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 p-2 overflow-hidden">
      <div className="h-1 w-full bg-red-500 mb-2" />
      <div className="space-y-1">
        <div className="h-1 w-3/4 bg-slate-200 dark:bg-slate-700" />
        <div className="h-1 w-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-1 w-1/2 bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  </div>
);

const PencilSquareIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
);

export default PetitionEditor;
