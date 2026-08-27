import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { apiFetch } from '../services/apiService';
import { 
  PhotoIcon, 
  ArrowDownTrayIcon, 
  DocumentDuplicateIcon,
  SparklesIcon,
  ArrowPathIcon,
  PencilIcon,
  BookmarkIcon,
  ClockIcon,
  TrashIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  PlusIcon,
  LightBulbIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole } from '../types';

interface MarketingGeneratorProps {
  darkMode: boolean;
  user: User;
}

interface PostData {
  title: string;
  highlight: string;
  points: string[];
  caption: string;
  ctaCaption?: string;
  imagePrompt?: string;
}

interface LibraryAsset {
  id: string;
  topic: string;
  url: string;
  description: string;
}

interface StrategySuggestion {
  title: string;
  description: string;
}

interface SavedPost {
  id: string;
  date: string;
  topic: string;
  persona: string;
  templateType: string;
  postData: PostData;
  uploadedImage: string | null;
  imageZoom?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imgFrameX?: number;
  imgFrameY?: number;
  imgFrameW?: number;
  imgFrameH?: number;
  imageEditMode?: 'move' | 'resize';
  status?: 'draft' | 'pending_approval' | 'approved';
  strategy?: string;
}

export default function MarketingGenerator({ darkMode, user }: MarketingGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [strategy, setStrategy] = useState('educacional');
  const [suggestedStrategies, setSuggestedStrategies] = useState<StrategySuggestion[] | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategySuggestion | null>(null);
  const [isGeneratingStrategies, setIsGeneratingStrategies] = useState(false);
  const [persona, setPersona] = useState<'michel' | 'luana'>('michel');
  const [templateType, setTemplateType] = useState<'list' | 'urgent' | 'qa'>('list');
  const [isGenerating, setIsGenerating] = useState(false);
  // Flag to track image generation process
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [postData, setPostData] = useState<PostData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffsetX, setImageOffsetX] = useState(0);
  const [imageOffsetY, setImageOffsetY] = useState(0);
  const [imgFrameX, setImgFrameX] = useState(0);
  const [imgFrameY, setImgFrameY] = useState(0);
  const [imgFrameW, setImgFrameW] = useState(0);
  const [imgFrameH, setImgFrameH] = useState(0);
  const [imageEditMode, setImageEditMode] = useState<'move' | 'resize'>('move');
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [currentPostStatus, setCurrentPostStatus] = useState<'draft' | 'pending_approval' | 'approved'>('draft');
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [newAssetDescription, setNewAssetDescription] = useState('');
  const [newAssetTopic, setNewAssetTopic] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);
  const [newAssetPreview, setNewAssetPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSavedPosts();
    loadLibraryAssets();
  }, []);

  const loadLibraryAssets = async () => {
    try {
      const assets = await supabaseService.getThemeImages();
      setLibraryAssets(assets);
    } catch (error) {
      console.error('Error loading library assets:', error);
    }
  };

  const loadSavedPosts = async () => {
    try {
      console.log('Loading saved posts...');
      const remotePosts = await supabaseService.getMarketingPosts();
      const localSaved = localStorage.getItem('marketing_saved_posts');
      let localPosts = [];
      
      if (localSaved) {
        try { localPosts = JSON.parse(localSaved); } catch (e) {
          console.error('Error parsing local marketing posts:', e);
        }
      }
      
      // Merge: prefer remote but keep local if not in remote
      const merged = [...remotePosts];
      localPosts.forEach((lp: any) => {
        if (!merged.find(rp => rp.id === lp.id)) {
          merged.push(lp);
        }
      });
      
      console.log(`Loaded ${merged.length} posts (${remotePosts.length} remote, ${localPosts.length} local).`);
      setSavedPosts(merged);
      
      // Sync back to local storage if merged results differ
      if (merged.length > 0) {
        import('../utils').then(({ safeSetLocalStorage }) => {
          safeSetLocalStorage('marketing_saved_posts', JSON.stringify(merged));
        });
      }
    } catch (error) {
      console.error('Error loading marketing posts:', error);
      const saved = localStorage.getItem('marketing_saved_posts');
      if (saved) {
        try {
          setSavedPosts(JSON.parse(saved));
        } catch (e) {}
      }
    }
  };

  // Colors based on user's Canva templates
  const colors = {
    background: '#5C1111', // Burgundy
    gold: '#D4AF37',
    white: '#FFFFFF',
    yellowHighlight: '#FFD700',
    blueText: '#003366',
  };

  const generateStrategies = async () => {
    if (!topic.trim()) {
      alert('Por favor, digite um tema para o post.');
      return;
    }

    setIsGeneratingStrategies(true);
    try {
      const response = await apiFetch('/api/marketing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic, 
          persona, 
          mode: 'strategies' 
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.text) {
        let jsonStr = result.text.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        let data;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error("Falha ao parsear JSON:", parseError, "String recebida:", jsonStr);
          throw new Error("A IA retornou um formato inválido. Tente novamente.");
        }
        
        if (data.strategies && Array.isArray(data.strategies)) {
          setSuggestedStrategies(data.strategies);
          setSelectedStrategy(null);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar estratégias:', error);
      alert('Ocorreu um erro ao gerar as ideias. Tente novamente.');
    } finally {
      setIsGeneratingStrategies(false);
    }
  };

  // Função inteligente de correspondência semântica e contextual de fotos da biblioteca
  const findBestAssetForContext = (
    topicStr: string,
    assets: LibraryAsset[],
    currentPersona?: string,
    imagePromptStr?: string
  ): LibraryAsset | null => {
    if (!assets || assets.length === 0) return null;

    const normalize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ');

    const topicNorm = normalize(topicStr);
    const promptNorm = normalize(imagePromptStr || '');
    const combinedQuery = `${topicNorm} ${promptNorm}`;

    // Regras conceituais e sinônimos jurídicos previdenciários/trabalhistas
    const conceptRules: {
      triggers: string[];
      assetKeywords: string[];
      bonus: number;
    }[] = [
      {
        // Contribuintes individuais, facultativos, carência, tempo, idade, CNIS, mínimo
        triggers: [
          'contribuinte', 'facultativo', 'individual', 'contribuicao', 'contribuicoes', 'minimo',
          'abaixo do minimo', 'cnis', 'recolhimento', 'gps', 'carencia', 'tempo de contribuicao',
          'aposentadoria por idade', 'aposentadoria', 'planejamento', 'revisao', 'segurado', 'riscos'
        ],
        assetKeywords: ['homem idoso', 'mulher idosa', 'casal', 'doutor michel felix', 'doutora luana castro', 'idoso', 'idosa'],
        bonus: 50
      },
      {
        // Laudo Médico / Doença / Perícia / Atestado / Incapacidade / Auxílio-doença
        triggers: [
          'laudo', 'medico', 'pericia', 'atestado', 'incapacidade', 'doenca', 'auxilio doenca',
          'invalidez', 'acidente', 'hospital', 'cirurgia', 'tratamento', 'cid', 'exame', 'perito'
        ],
        assetKeywords: ['laudo medico', 'laudo', 'medico'],
        bonus: 70
      },
      {
        // BPC / LOAS / Deficiência / Autismo / Cegueira / Assistencial
        triggers: [
          'bpc', 'loas', 'deficiencia', 'deficiente', 'cegueira', 'cego', 'autismo', 'autista',
          'pcd', 'assistencial', 'cadunico', 'miserabilidade', 'vulneravel'
        ],
        assetKeywords: ['beneficios assistenciais', 'deficiente cegueira', 'deficiente', 'assistenciais'],
        bonus: 70
      },
      {
        // Aposentadoria Especial / Insalubridade / Periculosidade / Enfermagem / Profissões
        triggers: [
          'especial', 'insalubre', 'insalubridade', 'periculosidade', 'enfermeiro', 'enfermeira',
          'vigilante', 'frentista', 'mecanico', 'soldador', 'eletricista', 'ruido', 'quimico',
          'ppp', 'ltcat', 'hospitalar'
        ],
        assetKeywords: ['aposentadorias especiais', 'especial', 'especiais', 'enfermeiros'],
        bonus: 70
      },
      {
        // Rural / Lavrador / Segurado Especial / Pescador / Agricultura
        triggers: ['rural', 'lavrador', 'agricultor', 'pescador', 'campo', 'roca', 'sitio', 'trabalhador rural'],
        assetKeywords: ['rural', 'agricultor', 'idosos', 'homem idoso', 'mulher idosa'],
        bonus: 60
      },
      {
        // Institucional / Equipe / Atendimento / Contato
        triggers: ['escritorio', 'advogado', 'advogada', 'doutor', 'doutora', 'secretaria', 'atendimento', 'consulta', 'duvida', 'equipe'],
        assetKeywords: ['doutor michel felix', 'doutora luana castro', 'secretaria fabricia felix'],
        bonus: 45
      }
    ];

    const stopwords = new Set([
      'com', 'dos', 'das', 'para', 'pelo', 'pela', 'como', 'onde', 'qual', 'quais', 'esse',
      'essa', 'este', 'esta', 'isso', 'riscos', 'sobre', 'mais', 'menos', 'entre', 'apos',
      'uma', 'uns', 'umas', 'seu', 'sua', 'seus', 'suas', 'ter', 'fazer', 'gerar'
    ]);

    const queryWords = combinedQuery
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    let bestAsset: LibraryAsset | null = null;
    let highestScore = -1;

    for (const asset of assets) {
      const assetTopicNorm = normalize(asset.topic || '');
      const assetDescNorm = normalize(asset.description || '');
      let score = 0;

      // 1. Match de palavras diretas no tópico ou descrição
      for (const word of queryWords) {
        if (assetTopicNorm.includes(word)) score += 20;
        if (assetDescNorm.includes(word)) score += 10;
      }

      // 2. Match de frase
      if (topicNorm.includes(assetTopicNorm) || assetTopicNorm.includes(topicNorm)) {
        score += 40;
      }

      // 3. Regras conceituais
      for (const rule of conceptRules) {
        const triggerHit = rule.triggers.some(t => topicNorm.includes(t) || promptNorm.includes(t));
        if (triggerHit) {
          const assetHit = rule.assetKeywords.some(
            k => assetTopicNorm.includes(k) || assetDescNorm.includes(k)
          );
          if (assetHit) {
            score += rule.bonus;
          }
        }
      }

      // 4. Bônus por persona
      if (currentPersona === 'michel' && assetTopicNorm.includes('michel')) score += 15;
      if (currentPersona === 'luana' && assetTopicNorm.includes('luana')) score += 15;

      if (score > highestScore) {
        highestScore = score;
        bestAsset = asset;
      }
    }

    if (highestScore > 0 && bestAsset) {
      return bestAsset;
    }

    // Fallback prioritário para a persona ou primeiro ativo
    if (currentPersona === 'michel') {
      const michelAsset = assets.find(a => normalize(a.topic).includes('michel'));
      if (michelAsset) return michelAsset;
    } else if (currentPersona === 'luana') {
      const luanaAsset = assets.find(a => normalize(a.topic).includes('luana'));
      if (luanaAsset) return luanaAsset;
    }

    return assets[0] || null;
  };

  const generatePost = async (mode: 'full' | 'template' | 'caption' = 'full') => {
    if (!topic.trim()) {
      alert('Por favor, digite um tema para o post.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiFetch('/api/marketing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic, 
          persona, 
          mode, 
          currentData: postData,
          strategy: selectedStrategy ? selectedStrategy.description : strategy,
          assetDescription: selectedAsset ? selectedAsset.description : null
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.text) {
        let jsonStr = result.text.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        let data;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error("Falha ao parsear JSON:", parseError, "String recebida:", jsonStr);
          throw new Error("A IA retornou um formato inválido. Tente novamente.");
        }
        
        if (mode === 'full') {
          setPostData(data as PostData);
          
          // Reset image adjustments on new full post
          setImageZoom(1);
          setImageOffsetX(0);
          setImageOffsetY(0);
          
          // 1. Se houver ativo selecionado manualmente pelo usuário, usa diretamente
          if (selectedAsset) {
            setUploadedImage(selectedAsset.url);
          } 
          // 2. Busca o ativo mais adequado na biblioteca pelo contexto
          else if (libraryAssets.length > 0) {
            const bestAsset = findBestAssetForContext(topic, libraryAssets, persona, data.imagePrompt);
            if (bestAsset) {
              setUploadedImage(bestAsset.url);
              setSelectedAsset(bestAsset);
            } else {
              const existingThemeImage = await supabaseService.getThemeImage(topic);
              if (existingThemeImage) {
                setUploadedImage(existingThemeImage.url);
              } else {
                setUploadedImage(getDefaultImage(topic));
              }
            }
          } 
          // 3. Fallback para tema salvo ou imagem padrão
          else {
            const existingThemeImage = await supabaseService.getThemeImage(topic);
            if (existingThemeImage) {
              setUploadedImage(existingThemeImage.url);
            } else {
              setUploadedImage(getDefaultImage(topic));
            }
          }
        } else if (mode === 'template' && postData) {
          setPostData({
            ...postData,
            title: data.title,
            highlight: data.highlight,
            points: data.points,
            ctaCaption: data.ctaCaption
          });
        } else if (mode === 'caption' && postData) {
          setPostData({
            ...postData,
            caption: data.caption
          });
        }
      }
    } catch (error) {
      console.error('Erro ao gerar post:', error);
      alert('Ocorreu um erro ao gerar o conteúdo. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIImage = async (prompt?: string) => {
    const finalPrompt = prompt || postData?.imagePrompt;
    if (!finalPrompt) {
      alert('Não há um prompt de imagem disponível.');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const response = await apiFetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.image) {
          try {
            const fileName = `marketing/${topic.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.png`;
            const publicUrl = await supabaseService.uploadFile('marketing', fileName, result.image);
            if (publicUrl) {
              setUploadedImage(publicUrl);
              await supabaseService.saveThemeImage(topic, publicUrl);
            } else {
              setUploadedImage(result.image);
            }
          } catch (e) {
            console.error('Error uploading generated image:', e);
            setUploadedImage(result.image);
          }
          return;
        }
      }
      
      // Fallback inteligente para a Biblioteca de Ativos caso a IA de imagem não esteja disponível
      if (libraryAssets.length > 0) {
        const bestAsset = findBestAssetForContext(topic, libraryAssets, persona, finalPrompt);
        if (bestAsset) {
          setUploadedImage(bestAsset.url);
          setSelectedAsset(bestAsset);
          alert(`Geração via IA indisponível. Selecionamos a imagem ideal da sua Biblioteca de Ativos: "${bestAsset.topic}"!`);
          return;
        }
      }
      
      setUploadedImage(getDefaultImage(topic));
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      if (libraryAssets.length > 0) {
        const bestAsset = findBestAssetForContext(topic, libraryAssets, persona, finalPrompt);
        if (bestAsset) {
          setUploadedImage(bestAsset.url);
          setSelectedAsset(bestAsset);
          alert(`Selecionamos a foto da biblioteca que melhor reflete o tema: "${bestAsset.topic}".`);
          return;
        }
      }
      setUploadedImage(getDefaultImage(topic));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setSelectedAsset(null); // Clear selected asset if manual upload
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAssetSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewAssetPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAssetUpload = async () => {
    if (!newAssetPreview || !newAssetTopic.trim()) {
      alert('Por favor, selecione uma foto e preencha o tema.');
      return;
    }

    setIsUploadingAsset(true);
    try {
      const sanitizeName = (str: string) =>
        str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const fileName = `assets/${sanitizeName(newAssetTopic)}_${Date.now()}.png`;
      const publicUrl = await supabaseService.uploadFile('marketing', fileName, newAssetPreview);
      
      if (publicUrl) {
        await supabaseService.saveThemeImage(newAssetTopic, publicUrl, newAssetDescription);
        await loadLibraryAssets();
        setNewAssetTopic('');
        setNewAssetDescription('');
        setNewAssetPreview(null);
        alert('Imagem salva na biblioteca com sucesso!');
      }
    } catch (error: any) {
      console.error('Error uploading asset:', error);
      const errorMessage = error?.message || error?.error_description || 'Erro desconhecido';
      alert(`Erro ao salvar na biblioteca: ${errorMessage}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  // Divide texto em múltiplas linhas respeitando limite em pixels
  const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    if (!text) return [];
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[n];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const lines = getWrappedLines(ctx, text, maxWidth);
    let currentY = y;
    for (const line of lines) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  const getDefaultImage = (topicStr: string) => {
    const t = topicStr.toLowerCase();
    if (t.includes('maternidade') || t.includes('gestante') || t.includes('mãe')) {
      return 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?q=80&w=800&auto=format&fit=crop';
    }
    if (t.includes('aposentadoria') || t.includes('idoso') || t.includes('idade')) {
      return 'https://images.unsplash.com/photo-1447069387593-a5de0862481e?q=80&w=800&auto=format&fit=crop';
    }
    if (t.includes('bpc') || t.includes('loas') || t.includes('invalidez') || t.includes('doença') || t.includes('incapacidade') || t.includes('deficiência') || t.includes('auxílio-doença')) {
      return 'https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=800&auto=format&fit=crop';
    }
    if (t.includes('rural') || t.includes('lavrador') || t.includes('agricultor') || t.includes('pescador')) {
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
    }
    // Default: Professional/Justice
    return 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=800&auto=format&fit=crop'; 
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !postData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas dimensions (Instagram Square 1080x1080)
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Background Bordô Oficial
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // 2. Elementos Decorativos Geométricos
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    
    // Decoração Canto Superior Direito
    ctx.strokeRect(840, 45, 195, 195);
    
    // Decoração Fundo Inferior Direito
    ctx.strokeRect(520, 760, 260, 220);

    // 3. Área do Logotipo (Topo Esquerda)
    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = 2.5;
    
    // Balança da Justiça
    ctx.beginPath();
    ctx.moveTo(85, 165);
    ctx.lineTo(115, 165);
    ctx.moveTo(90, 160);
    ctx.lineTo(110, 160);
    ctx.moveTo(100, 160);
    ctx.lineTo(100, 115);
    ctx.stroke();

    // Detalhe topo
    ctx.beginPath();
    ctx.arc(100, 112, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();

    // Haste principal
    ctx.beginPath();
    ctx.moveTo(65, 120);
    ctx.lineTo(135, 120);
    ctx.stroke();

    // Correntes e pratos
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(70, 120);
    ctx.lineTo(60, 145);
    ctx.moveTo(70, 120);
    ctx.lineTo(80, 145);
    ctx.moveTo(130, 120);
    ctx.lineTo(120, 145);
    ctx.moveTo(130, 120);
    ctx.lineTo(140, 145);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(55, 145);
    ctx.quadraticCurveTo(70, 155, 85, 145);
    ctx.moveTo(115, 145);
    ctx.quadraticCurveTo(130, 155, 145, 145);
    ctx.stroke();

    // Tipografia da Marca
    ctx.fillStyle = colors.white;
    ctx.font = 'bold 44px "Times New Roman", Georgia, serif';
    ctx.fillText('F&C', 150, 140);
    
    ctx.font = '600 17px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.letterSpacing = '2px';
    const subTitle = persona === 'michel' ? 'ADVOCACIA ESPECIALIZADA' : 'ADVOCACIA PREVIDENCIÁRIA';
    ctx.fillText(subTitle, 150, 165);
    ctx.letterSpacing = '0px'; // reset
    
    // Linha divisória horizontal superior
    ctx.beginPath();
    ctx.moveTo(75, 190);
    ctx.lineTo(530, 190);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Área da Imagem (Coluna Direita)
    const frameX = 560;
    const frameY = 210;
    const frameW = 450;
    const frameH = 720;

    // Moldura de fundo branca elegante
    ctx.fillStyle = colors.white;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(frameX - 12, frameY - 12, frameW + 24, frameH + 24, 16);
      ctx.fill();
    } else {
      ctx.fillRect(frameX - 12, frameY - 12, frameW + 24, frameH + 24);
    }

    const imgX = frameX + imgFrameX;
    const imgY = frameY + imgFrameY;
    const imgW = Math.max(10, frameW - imgFrameX - imgFrameW);
    const imgH = Math.max(10, frameH - imgFrameY - imgFrameH);

    const imageUrl = uploadedImage || getDefaultImage(topic);
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const baseScale = Math.max(imgW / img.width, imgH / img.height);
      const scale = baseScale * imageZoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (imgW - drawW) / 2 + imageOffsetX;
      const offsetY = (imgH - drawH) / 2 + imageOffsetY;
      
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(imgX, imgY, imgW, imgH, 12);
      } else {
        ctx.rect(imgX, imgY, imgW, imgH);
      }
      ctx.clip();
      
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(imgX, imgY, imgW, imgH);
      
      ctx.drawImage(img, imgX + offsetX, imgY + offsetY, drawW, drawH);
      ctx.restore();
      
      // Desenha o conteúdo de texto com auto-fit milimétrico
      drawTextContent(ctx, width, height);
    };

    img.onerror = () => {
      // Se a imagem falhar ao carregar, desenha um card com a cor de tema e o texto
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.fillStyle = colors.gold;
      ctx.font = 'bold 22px "Helvetica Neue", sans-serif';
      ctx.fillText('Felix & Castro', imgX + 30, imgY + imgH / 2);
      drawTextContent(ctx, width, height);
    };

    img.src = imageUrl;
  };

  const drawTextContent = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!postData) return;

    const leftX = 75;
    const maxTextWidth = 450;
    const availableHeight = 740; // Espaço útil entre y=225 e y=965

    // 1. Cálculo prévio das quebras de linha e tamanhos
    let titleFontSize = 46;
    if (postData.title.length > 55) titleFontSize = 40;
    else if (postData.title.length > 40) titleFontSize = 43;

    ctx.font = `italic bold ${titleFontSize}px "Times New Roman", Georgia, serif`;
    let titleLines = getWrappedLines(ctx, postData.title, maxTextWidth);
    if (titleLines.length > 3 && titleFontSize > 38) {
      titleFontSize = 38;
      ctx.font = `italic bold ${titleFontSize}px "Times New Roman", Georgia, serif`;
      titleLines = getWrappedLines(ctx, postData.title, maxTextWidth);
    }
    const titleLineHeight = Math.round(titleFontSize * 1.15);

    // 2. Destaque (Highlight Box)
    let highlightFontSize = 24;
    let highlightLineHeight = 32;
    ctx.font = `bold ${highlightFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    let highlightLines = getWrappedLines(ctx, postData.highlight, maxTextWidth - 40);
    let highlightBoxHeight = highlightLines.length * highlightLineHeight + 20;

    // 3. Pontos (List)
    let pointFontSize = 22;
    let pointLineHeight = 29;
    let pointGap = 14;
    ctx.font = `500 ${pointFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    
    const formattedPointsLines: string[][] = postData.points.map((p, idx) => {
      const fullText = `${idx + 1}) ${p}`;
      return getWrappedLines(ctx, fullText, maxTextWidth);
    });

    const totalPointLinesCount = formattedPointsLines.reduce((acc, lines) => acc + lines.length, 0);

    // 4. CTA
    let ctaFontSize = 23;
    let ctaLineHeight = 28;
    ctx.font = `italic bold ${ctaFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const ctaLines = postData.ctaCaption ? getWrappedLines(ctx, postData.ctaCaption, maxTextWidth) : [];

    // 5. Verificação de Altura Total para Auto-Fit (Evitar qualquer sobreposição)
    let estimatedTotalHeight = 
      (titleLines.length * titleLineHeight) + 20 +
      highlightBoxHeight + 30 +
      (totalPointLinesCount * pointLineHeight) + (formattedPointsLines.length * pointGap) +
      (ctaLines.length > 0 ? (ctaLines.length * ctaLineHeight + 24) : 0);

    if (estimatedTotalHeight > availableHeight) {
      // Redução proporcional inteligente para acomodar textos muito longos
      pointFontSize = 19;
      pointLineHeight = 25;
      pointGap = 10;
      highlightFontSize = 22;
      highlightLineHeight = 28;
      highlightBoxHeight = highlightLines.length * highlightLineHeight + 16;
      ctaFontSize = 21;
      ctaLineHeight = 26;
      titleFontSize = Math.max(34, titleFontSize - 4);
    }

    // --- RENDERIZAÇÃO REAL ---

    // A. Desenho do Título
    ctx.fillStyle = colors.gold;
    ctx.font = `italic bold ${titleFontSize}px "Times New Roman", Georgia, serif`;
    let currentY = 255;
    for (const line of titleLines) {
      ctx.fillText(line, leftX, currentY);
      currentY += Math.round(titleFontSize * 1.15);
    }

    // B. Desenho da Caixa de Destaque Amarela
    currentY += 16;
    const highlightBoxY = currentY;
    
    ctx.font = `bold ${highlightFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    highlightLines = getWrappedLines(ctx, postData.highlight, maxTextWidth - 40);
    
    // Mede a largura máxima necessária para a caixa
    let maxLineWidth = 0;
    for (const l of highlightLines) {
      const w = ctx.measureText(l).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    const highlightBoxWidth = Math.min(maxTextWidth, Math.max(maxLineWidth + 36, 260));
    highlightBoxHeight = highlightLines.length * highlightLineHeight + 18;

    // Fundo Amarelo Dourado da Caixa
    ctx.fillStyle = colors.yellowHighlight;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(leftX, highlightBoxY, highlightBoxWidth, highlightBoxHeight, 8);
      ctx.fill();
    } else {
      ctx.fillRect(leftX, highlightBoxY, highlightBoxWidth, highlightBoxHeight);
    }

    // Texto do Destaque em Azul Escuro Profundo (100% de contraste, dentro da caixa)
    ctx.fillStyle = colors.blueText;
    let highlightTextY = highlightBoxY + highlightLineHeight - 4;
    for (const line of highlightLines) {
      ctx.fillText(line, leftX + 18, highlightTextY);
      highlightTextY += highlightLineHeight;
    }

    // Traço divisor sutil abaixo da caixa de destaque
    currentY = highlightBoxY + highlightBoxHeight + 14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(leftX, currentY, 120, 3.5);

    // C. Desenho dos Pontos da Lista
    currentY += 26;
    ctx.font = `500 ${pointFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    
    postData.points.forEach((point, index) => {
      const fullText = `${index + 1}) ${point}`;
      const lines = getWrappedLines(ctx, fullText, maxTextWidth);
      
      lines.forEach((line, lineIdx) => {
        // Primeiro segmento (número) em destaque ou branco puro
        ctx.fillStyle = colors.white;
        ctx.fillText(line, leftX, currentY);
        currentY += pointLineHeight;
      });
      currentY += pointGap;
    });

    // D. Chamada para Ação (CTA) — Posicionada com segurança após os pontos
    if (postData.ctaCaption && ctaLines.length > 0) {
      currentY += 8;
      ctx.fillStyle = colors.yellowHighlight;
      ctx.font = `italic bold ${ctaFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      for (const line of ctaLines) {
        if (currentY < 965) {
          ctx.fillText(line, leftX, currentY);
          currentY += ctaLineHeight;
        }
      }
    }

    // E. Rodapé Fixo (@advprevfelixecastro) — Travado na base com segurança
    const footerY = 1005;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '600 20px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('@advprevfelixecastro', leftX, footerY);
  };

  // Redraw canvas when data or image changes
  useEffect(() => {
    if (postData) {
      drawCanvas();
    }
  }, [postData, uploadedImage, imageZoom, imageOffsetX, imageOffsetY, imgFrameX, imgFrameY, imgFrameW, imgFrameH]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `post_${topic.replace(/\s+/g, '_').toLowerCase()}.png`;
    link.href = url;
    link.click();
  };

  const handleCopyCaption = () => {
    if (postData?.caption) {
      navigator.clipboard.writeText(postData.caption);
      alert('Legenda copiada para a área de transferência!');
    }
  };

  const handleNewPost = () => {
    setTopic('');
    setStrategy('educacional');
    setSuggestedStrategies(null);
    setSelectedStrategy(null);
    setPostData(null);
    setUploadedImage(null);
    setImageZoom(1);
    setImageOffsetX(0);
    setImageOffsetY(0);
    setImgFrameX(0);
    setImgFrameY(0);
    setImgFrameW(0);
    setImgFrameH(0);
    setImageEditMode('move');
    setCurrentPostId(null);
    setCurrentPostStatus('draft');
    setIsEditingText(false);
    setIsEditingImage(false);
  };

  const handleSavePost = async (statusOverride?: 'draft' | 'pending_approval' | 'approved') => {
    if (!postData) return;
    
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newStatus = statusOverride || currentPostStatus;
    const postId = currentPostId || generateId();
    
    const newPost: SavedPost & { strategy?: string } = {
      id: postId,
      date: new Date().toISOString(),
      topic,
      persona,
      templateType,
      postData,
      uploadedImage,
      imageZoom,
      imageOffsetX,
      imageOffsetY,
      imgFrameX,
      imgFrameY,
      imgFrameW,
      imgFrameH,
      imageEditMode,
      status: newStatus,
      strategy
    };
    
    // Optimistic update
    const updated = currentPostId 
      ? savedPosts.map(p => p.id === postId ? newPost : p)
      : [newPost, ...savedPosts];
      
    setSavedPosts(updated);
    setCurrentPostId(postId); // Keep the current post ID
    
    // Save to local storage safely
    import('../utils').then(({ safeSetLocalStorage }) => {
      safeSetLocalStorage('marketing_saved_posts', JSON.stringify(updated));
    });
    
    try {
      console.log('Attempting to save marketing post to Supabase...');
      await supabaseService.saveMarketingPost(newPost);
      if (!statusOverride) {
        alert('Post salvo com sucesso no histórico e na nuvem!');
      }
    } catch (error) {
      console.error('Failed to save to Supabase:', error);
      if (!statusOverride) {
        alert('Post salvo localmente, mas houve um erro ao sincronizar com a nuvem. Verifique sua conexão.');
      }
    }
  };

  const handleRequestApproval = async () => {
    await handleSavePost('pending_approval');
    alert('Post enviado para aprovação dos advogados!');
  };

  const handleApprovePost = async () => {
    await handleSavePost('approved');
    alert('Post aprovado com sucesso!');
  };

  const handleLoadPost = (post: SavedPost & { strategy?: string }) => {
    setTopic(post.topic);
    setStrategy(post.strategy || 'educacional');
    setPersona(post.persona as any);
    setTemplateType(post.templateType as any);
    setPostData(post.postData);
    setUploadedImage(post.uploadedImage);
    setImageZoom(post.imageZoom || 1);
    setImageOffsetX(post.imageOffsetX || 0);
    setImageOffsetY(post.imageOffsetY || 0);
    setImgFrameX(post.imgFrameX || 0);
    setImgFrameY(post.imgFrameY || 0);
    setImgFrameW(post.imgFrameW || 0);
    setImgFrameH(post.imgFrameH || 0);
    setImageEditMode(post.imageEditMode || 'move');
    setCurrentPostId(post.id);
    setCurrentPostStatus(post.status || 'draft');
  };

  const handleDeletePost = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este post do histórico?')) {
      // Optimistic update
      const updated = savedPosts.filter(p => p.id !== id);
      setSavedPosts(updated);
      localStorage.setItem('marketing_saved_posts', JSON.stringify(updated));
      
      try {
        await supabaseService.deleteMarketingPost(id);
      } catch (error) {
        console.error('Failed to delete from Supabase:', error);
      }
    }
  };

  const handleTextChange = (field: keyof PostData, value: string | string[]) => {
    if (!postData) return;
    setPostData({ ...postData, [field]: value });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Fábrica de Posts (Marketing)
          </h1>
          <p className={`mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Gere imagens e legendas profissionais para o Instagram do escritório em segundos.
          </p>
        </div>
        {postData && (
          <button
            onClick={handleNewPost}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm'}`}
          >
            <PlusIcon className="w-5 h-5" />
            Criar Novo Post
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Panel */}
        <div className={`lg:col-span-4 p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          
          <div className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Tema do Post
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Requisitos do BPC para idosos, ou Revisão da Vida Toda..."
                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-24 ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
              <button
                onClick={generateStrategies}
                disabled={isGeneratingStrategies || !topic.trim()}
                className={`mt-3 w-full flex items-center justify-center gap-2 p-2.5 rounded-xl font-medium transition-all border ${darkMode ? 'border-primary-500/30 text-primary-400 hover:bg-primary-900/30' : 'border-primary-200 text-primary-700 hover:bg-primary-50'} disabled:opacity-50`}
              >
                {isGeneratingStrategies ? (
                  <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Gerando ideias...</>
                ) : (
                  <><LightBulbIcon className="w-4 h-4" /> Sugerir Estratégias</>
                )}
              </button>
            </div>

            {suggestedStrategies && (
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Escolha uma Estratégia:
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {suggestedStrategies.map((strat, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedStrategy(strat)}
                      className={`p-3 border rounded-xl cursor-pointer transition-all ${selectedStrategy?.title === strat.title ? (darkMode ? 'border-primary-500 bg-primary-900/20' : 'border-primary-500 bg-primary-50') : (darkMode ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')}`}
                    >
                      <h4 className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>{strat.title}</h4>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{strat.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Voz (Persona)
                </label>
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value as 'michel' | 'luana')}
                  className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-primary-500 outline-none transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                >
                  <option value="michel">Dr. Michel (Direto)</option>
                  <option value="luana">Dra. Luana (Acolhedora)</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Formato
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-primary-500 outline-none transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                >
                  <option value="list">Informativo (Lista)</option>
                  <option value="qa">Mito vs Verdade</option>
                  <option value="urgent">Notícia Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Foto (Opcional)
              </label>
              <input 
                type="file" 
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 border-dashed transition-all ${darkMode ? 'border-slate-600 hover:border-primary-500 text-slate-300' : 'border-slate-300 hover:border-primary-500 text-slate-600'}`}
                >
                  <PhotoIcon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Upload</span>
                </button>
                <button
                  onClick={() => setShowAssetLibrary(true)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${selectedAsset ? (darkMode ? 'bg-primary-900/20 border-primary-500 text-primary-400' : 'bg-primary-50 border-primary-500 text-primary-700') : (darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700')}`}
                >
                  <BookmarkIcon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Biblioteca</span>
                </button>
                <button
                  onClick={() => generateAIImage()}
                  disabled={isGeneratingImage || !postData?.imagePrompt}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}
                >
                  {isGeneratingImage ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-5 h-5 text-primary-500" />
                  )}
                  <span className="text-[10px] font-medium">IA</span>
                </button>
              </div>
              {selectedAsset && (
                <div className={`mt-3 p-2 rounded-lg border flex items-center gap-3 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <img src={selectedAsset.url} alt="" className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedAsset.topic}</p>
                    <p className={`text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{selectedAsset.description}</p>
                  </div>
                  <button onClick={() => { setSelectedAsset(null); setUploadedImage(null); }} className="text-red-500 hover:text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => generatePost('full')}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-xl font-medium transition-all shadow-lg shadow-primary-500/30 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Gerando (pode levar 1 minuto)...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  {postData ? 'Regerar Post Completo' : 'Gerar Post Completo'}
                </>
              )}
            </button>

            {postData && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  onClick={() => generatePost('template')}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all border ${darkMode ? 'border-primary-500/30 text-primary-400 hover:bg-primary-900/30' : 'border-primary-200 text-primary-700 hover:bg-primary-50'} disabled:opacity-50`}
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regerar Template
                </button>
                <button
                  onClick={() => generatePost('caption')}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all border ${darkMode ? 'border-primary-500/30 text-primary-400 hover:bg-primary-900/30' : 'border-primary-200 text-primary-700 hover:bg-primary-50'} disabled:opacity-50`}
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regerar Legenda
                </button>
              </div>
            )}

              {/* History Section */}
            {savedPosts.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-gold-500/15">
                <h3 className={`font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  <ClockIcon className="w-5 h-5" />
                  Histórico de Posts
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {savedPosts.map((post) => (
                    <div key={post.id} className={`p-3 rounded-xl border text-sm transition-all ${darkMode ? 'bg-slate-900 border-slate-700 hover:border-primary-500' : 'bg-slate-50 border-slate-200 hover:border-primary-500'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium truncate pr-2">{post.topic || 'Sem tema'}</span>
                        <button onClick={() => handleDeletePost(post.id)} className="text-red-500 hover:text-red-600">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                        <span>{new Date(post.date).toLocaleDateString('pt-BR')} • {post.persona === 'michel' ? 'Dr. Michel' : 'Dra. Luana'}</span>
                        {post.status === 'pending_approval' && <span className="text-amber-500 flex items-center gap-1"><ClockIcon className="w-3 h-3"/> Pendente</span>}
                        {post.status === 'approved' && <span className="text-emerald-500 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Aprovado</span>}
                      </div>
                      <button 
                        onClick={() => handleLoadPost(post)}
                        className="w-full py-1.5 bg-slate-200 dark:bg-bordeaux-900/40 hover:bg-slate-300 dark:hover:bg-bordeaux-900/60 rounded text-xs font-medium transition-colors"
                      >
                        Carregar Post
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-8 space-y-6">
          {postData ? (
            <>
              {/* Image Preview */}
              <div className={`p-6 rounded-2xl shadow-sm border flex flex-col items-center ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="w-full flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      Prévia da Arte
                    </h3>
                    {currentPostStatus === 'pending_approval' && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-md flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" /> Aguardando Aprovação
                      </span>
                    )}
                    {currentPostStatus === 'approved' && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-md flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Aprovado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditingText(!isEditingText);
                        if (!isEditingText) setIsEditingImage(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditingText ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-bordeaux-900/40 dark:text-slate-300 dark:hover:bg-bordeaux-900/60'}`}
                    >
                      <PencilIcon className="w-4 h-4" />
                      {isEditingText ? 'Ocultar Edição' : 'Editar Textos'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingImage(!isEditingImage);
                        if (!isEditingImage) setIsEditingText(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditingImage ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-bordeaux-900/40 dark:text-slate-300 dark:hover:bg-bordeaux-900/60'}`}
                    >
                      <PhotoIcon className="w-4 h-4" />
                      {isEditingImage ? 'Ocultar Edição Imagem' : 'Editar Imagem'}
                    </button>
                    <button
                      onClick={() => handleSavePost()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <BookmarkIcon className="w-4 h-4" />
                      Salvar no Histórico
                    </button>
                  </div>
                </div>

                {isEditingImage && (
                  <div className={`w-full mb-6 p-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-6 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Ajustes</h4>
                        <div className="flex bg-slate-200 dark:bg-bordeaux-900/40 rounded-lg p-1">
                          <button 
                            onClick={() => setImageEditMode('move')}
                            className={`px-2 py-1 text-[10px] rounded-md transition-all ${imageEditMode === 'move' ? 'bg-white dark:bg-bordeaux-900/60 shadow-sm font-bold' : 'opacity-50'}`}
                          >
                            Mover
                          </button>
                          <button 
                            onClick={() => setImageEditMode('resize')}
                            className={`px-2 py-1 text-[10px] rounded-md transition-all ${imageEditMode === 'resize' ? 'bg-white dark:bg-bordeaux-900/60 shadow-sm font-bold' : 'opacity-50'}`}
                          >
                            Redimensionar
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-w-[150px]">
                        <div />
                        <button 
                          onClick={() => {
                            if (imageEditMode === 'move') setImageOffsetY(prev => prev - 10);
                            else setImgFrameY(prev => prev - 10); 
                          }} 
                          title={imageEditMode === 'move' ? 'Mover para cima' : 'Puxar borda superior'}
                          className="p-2 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300 dark:hover:bg-bordeaux-900/60 flex justify-center"
                        >
                          <ChevronUpIcon className="w-4 h-4"/>
                        </button>
                        <div />
                        <button 
                          onClick={() => {
                            if (imageEditMode === 'move') setImageOffsetX(prev => prev - 10);
                            else setImgFrameX(prev => prev - 10); 
                          }} 
                          title={imageEditMode === 'move' ? 'Mover para esquerda' : 'Puxar borda esquerda'}
                          className="p-2 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300 dark:hover:bg-bordeaux-900/60 flex justify-center"
                        >
                          <ChevronLeftIcon className="w-4 h-4"/>
                        </button>
                        <button 
                          onClick={() => {
                            setImageOffsetX(0); 
                            setImageOffsetY(0); 
                            setImageZoom(1);
                            setImgFrameX(0);
                            setImgFrameY(0);
                            setImgFrameW(0);
                            setImgFrameH(0);
                          }} 
                          className="p-2 bg-primary-500 text-white rounded hover:bg-primary-600 flex justify-center text-[10px] items-center"
                        >
                          Reset
                        </button>
                        <button 
                          onClick={() => {
                            if (imageEditMode === 'move') setImageOffsetX(prev => prev + 10);
                            else {
                              // Pull right edge (increase width)
                              setImgFrameW(prev => prev + 10);
                            }
                          }} 
                          title={imageEditMode === 'move' ? 'Mover para direita' : 'Puxar borda direita'}
                          className="p-2 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300 dark:hover:bg-bordeaux-900/60 flex justify-center"
                        >
                          <ChevronRightIcon className="w-4 h-4"/>
                        </button>
                        <div />
                        <button 
                          onClick={() => {
                            if (imageEditMode === 'move') setImageOffsetY(prev => prev + 10);
                            else {
                              // Pull bottom edge (increase height)
                              setImgFrameH(prev => prev + 10);
                            }
                          }} 
                          title={imageEditMode === 'move' ? 'Mover para baixo' : 'Puxar borda inferior'}
                          className="p-2 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300 dark:hover:bg-bordeaux-900/60 flex justify-center"
                        >
                          <ChevronDownIcon className="w-4 h-4"/>
                        </button>
                        <div />
                      </div>
                      
                      {imageEditMode === 'resize' && (
                        <div className="space-y-2 mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                setImgFrameW(prev => prev + 20);
                              }}
                              className="text-[10px] p-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded hover:bg-primary-200 font-bold"
                            >
                              + Largura (Simétrico)
                            </button>
                            <button 
                              onClick={() => {
                                setImgFrameW(prev => Math.max(50, prev - 20));
                              }}
                              className="text-[10px] p-1 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300"
                            >
                              - Largura (Simétrico)
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                setImgFrameH(prev => prev + 20);
                              }}
                              className="text-[10px] p-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded hover:bg-primary-200 font-bold"
                            >
                              + Altura (Simétrico)
                            </button>
                            <button 
                              onClick={() => {
                                setImgFrameH(prev => Math.max(50, prev - 20));
                              }}
                              className="text-[10px] p-1 bg-slate-200 dark:bg-bordeaux-900/40 rounded hover:bg-slate-300"
                            >
                              - Altura (Simétrico)
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                // Center image in frame
                                setImageOffsetX(0);
                                setImageOffsetY(0);
                              }}
                              className="text-[10px] p-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 font-bold"
                            >
                              Centralizar Foto
                            </button>
                            <button 
                              onClick={() => {
                                // Reset frame offsets to equalize margins relative to canvas center
                                setImgFrameX(0);
                                setImgFrameY(0);
                              }}
                              className="text-[10px] p-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 font-bold"
                            >
                              Equalizar Margens
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-medium opacity-70">Zoom: {Math.round(imageZoom * 100)}%</label>
                          <div className="flex gap-1">
                            <button onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.1))} className="px-2 py-0.5 bg-slate-200 dark:bg-bordeaux-900/40 rounded text-xs">-</button>
                            <button onClick={() => setImageZoom(prev => Math.min(3, prev + 0.1))} className="px-2 py-0.5 bg-slate-200 dark:bg-bordeaux-900/40 rounded text-xs">+</button>
                          </div>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="3" 
                          step="0.1" 
                          value={imageZoom} 
                          onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-bordeaux-900/60 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Trocar Imagem</h4>
                      <button 
                        onClick={() => setShowAssetLibrary(true)}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all shadow-md"
                      >
                        <BookmarkIcon className="w-4 h-4" />
                        Abrir Biblioteca de Fotos
                      </button>
                      <p className="text-[10px] opacity-60 italic text-center">Selecione uma foto da sua galeria para substituir a atual.</p>
                      
                      <div className="pt-2 border-t border-slate-200 dark:border-gold-500/15">
                        <p className="text-[10px] font-bold uppercase opacity-40 mb-2">Dica</p>
                        <p className="text-[10px] opacity-60">
                          {imageEditMode === 'move' 
                            ? 'Use as setas para centralizar o rosto das pessoas ou destacar detalhes importantes da foto.' 
                            : 'Use as setas para "puxar" as bordas da foto e aumentar o quadro. Use os botões abaixo para reduzir.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isEditingText && (
                  <div className={`w-full mb-6 p-4 rounded-xl border grid grid-cols-1 gap-4 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Título</label>
                      <input 
                        type="text" 
                        value={postData.title} 
                        onChange={(e) => handleTextChange('title', e.target.value)}
                        className={`w-full p-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Destaque</label>
                      <input 
                        type="text" 
                        value={postData.highlight} 
                        onChange={(e) => handleTextChange('highlight', e.target.value)}
                        className={`w-full p-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Chamada Legenda (CTA)</label>
                      <input 
                        type="text" 
                        value={postData.ctaCaption || ''} 
                        onChange={(e) => handleTextChange('ctaCaption', e.target.value)}
                        className={`w-full p-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Pontos (um por linha)</label>
                      <textarea 
                        value={postData.points.join('\n')} 
                        onChange={(e) => handleTextChange('points', e.target.value.split('\n'))}
                        className={`w-full p-2 rounded border text-sm h-24 resize-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  </div>
                )}

                <div className="w-full max-w-[500px] aspect-square bg-slate-100 rounded-lg overflow-hidden shadow-inner relative">
                  {/* The actual canvas is hidden, we display it via CSS scaling or just show the canvas directly but scaled down */}
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-contain"
                    style={{ display: 'block' }}
                  />
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                  {user.role === UserRole.ADVOGADO || currentPostStatus === 'approved' ? (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                      <ArrowDownTrayIcon className="w-5 h-5" />
                      Baixar Imagem (PNG)
                    </button>
                  ) : (
                    <>
                      {currentPostStatus === 'draft' && (
                        <button
                          onClick={handleRequestApproval}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
                        >
                          <PaperAirplaneIcon className="w-5 h-5" />
                          Concluído (Solicitar Aprovação)
                        </button>
                      )}
                      {currentPostStatus === 'pending_approval' && (
                        <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-6 py-3 rounded-xl font-medium">
                          <ClockIcon className="w-5 h-5" />
                          Aguardando Aprovação
                        </div>
                      )}
                    </>
                  )}

                  {user.role === UserRole.ADVOGADO && currentPostStatus === 'pending_approval' && (
                    <button
                      onClick={handleApprovePost}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      Aprovar Post
                    </button>
                  )}
                </div>
              </div>

              {/* Caption Preview */}
              <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Legenda para o Instagram
                  </h3>
                  {user.role === UserRole.ADVOGADO || currentPostStatus === 'approved' ? (
                    <button
                      onClick={handleCopyCaption}
                      className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium text-sm"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                      Copiar Legenda
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Aprovação necessária para copiar
                    </span>
                  )}
                </div>
                {isEditingText ? (
                  <textarea 
                    value={postData.caption} 
                    onChange={(e) => handleTextChange('caption', e.target.value)}
                    className={`w-full p-4 rounded-xl border text-sm h-48 resize-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
                  />
                ) : (
                  <div className={`p-4 rounded-xl whitespace-pre-wrap ${darkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                    {postData.caption}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={`h-full min-h-[400px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed ${darkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              {isGenerating ? (
                <>
                  <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Criando post de altíssimo valor...</p>
                  <p className="text-xs mt-2 max-w-xs text-center text-slate-500">
                    A IA está escrevendo uma legenda detalhada, didática e estruturando o design. Isso pode demorar cerca de 1 minuto para não economizar na qualidade. Aguarde.
                  </p>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Sua arte aparecerá aqui</p>
                  <p className="text-sm mt-2">Preencha o tema e clique em Gerar Post</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Asset Library Modal */}
      {showAssetLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <div className="p-6 border-b border-slate-200 dark:border-gold-500/15 flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Biblioteca de Ativos</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie e selecione fotos para seus posts</p>
              </div>
              <button 
                onClick={() => setShowAssetLibrary(false)}
                className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-bordeaux-900/60 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                <PlusIcon className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Upload Section */}
                <div className={`p-4 rounded-2xl border-2 border-dashed ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                  <h3 className={`font-semibold mb-4 text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Adicionar Novo Ativo</h3>
                  <div className="space-y-4">
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={libraryFileInputRef}
                      onChange={handleAssetSelect}
                      className="hidden"
                    />
                    
                    {!newAssetPreview ? (
                      <button
                        onClick={() => libraryFileInputRef.current?.click()}
                        className={`w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed transition-all ${darkMode ? 'border-slate-700 hover:border-primary-500 text-slate-400' : 'border-slate-300 hover:border-primary-500 text-slate-500'}`}
                      >
                        <PhotoIcon className="w-8 h-8" />
                        <span className="text-xs font-medium">Selecionar Foto</span>
                      </button>
                    ) : (
                      <div className="relative group">
                        <img src={newAssetPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-gold-500/15" />
                        <button 
                          onClick={() => setNewAssetPreview(null)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Tema/Título</label>
                      <input 
                        type="text"
                        value={newAssetTopic}
                        onChange={(e) => setNewAssetTopic(e.target.value)}
                        placeholder="Ex: Aposentadoria Rural"
                        className={`w-full p-2 text-sm rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-70">Descrição (para a IA)</label>
                      <textarea 
                        value={newAssetDescription}
                        onChange={(e) => setNewAssetDescription(e.target.value)}
                        placeholder="Descreva o que tem na foto..."
                        className={`w-full p-2 text-sm rounded-lg border outline-none h-20 resize-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <button
                      onClick={handleAssetUpload}
                      disabled={isUploadingAsset || !newAssetTopic.trim() || !newAssetPreview}
                      className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    >
                      {isUploadingAsset ? (
                        <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Salvando...</>
                      ) : (
                        <><CheckCircleIcon className="w-4 h-4" /> Salvar na Biblioteca</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Assets Grid */}
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {libraryAssets.map((asset) => (
                    <div 
                      key={asset.id}
                      className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary-500 ${selectedAsset?.id === asset.id ? 'ring-2 ring-primary-500' : (darkMode ? 'border-slate-700' : 'border-slate-200')}`}
                      onClick={() => {
                        setSelectedAsset(asset);
                        setUploadedImage(asset.url);
                        setShowAssetLibrary(false);
                      }}
                    >
                      <img src={asset.url} alt={asset.topic} className="w-full h-32 object-cover" />
                      <div className={`p-2 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{asset.topic}</p>
                        <p className={`text-[10px] truncate opacity-60 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{asset.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
