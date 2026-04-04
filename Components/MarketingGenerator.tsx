import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
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
      const posts = await supabaseService.getMarketingPosts();
      setSavedPosts(posts);
    } catch (error) {
      console.error('Error loading marketing posts:', error);
      // Fallback to local storage if Supabase fails
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
      const response = await fetch('/api/marketing/generate', {
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
        const data = JSON.parse(result.text);
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

  const generatePost = async (mode: 'full' | 'template' | 'caption' = 'full') => {
    if (!topic.trim()) {
      alert('Por favor, digite um tema para o post.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/marketing/generate', {
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
        const data = JSON.parse(result.text);
        if (mode === 'full') {
          setPostData(data as PostData);
          
          // Reset image adjustments on new full post
          setImageZoom(1);
          setImageOffsetX(0);
          setImageOffsetY(0);
          
          // 1. If we have a manually selected asset, use it
          if (selectedAsset) {
            setUploadedImage(selectedAsset.url);
          } 
          // 2. Otherwise, check if we already have a theme image for this topic in the database (exact match)
          else {
            const existingThemeImage = await supabaseService.getThemeImage(topic);
            if (existingThemeImage) {
              setUploadedImage(existingThemeImage.url);
            } 
            // 3. Try keyword matching in the library assets
            else {
              const searchTopic = topic.toLowerCase();
              const matchedAsset = libraryAssets.find(asset => {
                const assetTopic = asset.topic.toLowerCase();
                const assetDesc = (asset.description || '').toLowerCase();
                
                // Split search topic into keywords (removing common small words)
                const keywords = searchTopic.split(/\s+/).filter(w => w.length > 2 && !['com', 'dos', 'das', 'para', 'pelo'].includes(w));
                
                // Check if any keyword matches asset topic or description
                const hasKeywordMatch = keywords.some(word => 
                  assetTopic.includes(word) || assetDesc.includes(word)
                );

                return searchTopic.includes(assetTopic) || 
                       assetTopic.includes(searchTopic) ||
                       hasKeywordMatch;
              });
              
              if (matchedAsset) {
                setUploadedImage(matchedAsset.url);
                setSelectedAsset(matchedAsset);
              }
              // 4. Finally, generate a new one if nothing else is available
              else if (data.imagePrompt) {
                // Clear old image before generating new one to avoid showing stale content
                setUploadedImage(null);
                generateAIImage(data.imagePrompt);
              }
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
      const response = await fetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      if (!response.ok) throw new Error('Erro ao gerar imagem');
      
      const result = await response.json();
      if (result.image) {
        // Upload to Storage to get a public URL and save as theme image
        try {
          const fileName = `marketing/${topic.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.png`;
          const publicUrl = await supabaseService.uploadFile('marketing', fileName, result.image);
          if (publicUrl) {
            setUploadedImage(publicUrl);
            // Save as theme image for future use
            await supabaseService.saveThemeImage(topic, publicUrl);
          } else {
            setUploadedImage(result.image);
          }
        } catch (e) {
          console.error('Error uploading generated image:', e);
          setUploadedImage(result.image);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Erro ao gerar imagem com IA.');
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
      const fileName = `assets/${newAssetTopic.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.png`;
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

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight; // Return the next Y position
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
      // More appropriate image for disability/health
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

    // Canvas dimensions (Instagram Square)
    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // 2. Decorative Elements (White/Gold lines)
    ctx.strokeStyle = colors.white;
    ctx.lineWidth = 4;
    
    // Top right corner decoration
    ctx.strokeRect(850, 50, 200, 200);
    
    // Bottom right corner decoration
    ctx.strokeRect(500, 780, 250, 200);

    // 3. Logo Area (Top Left)
    // Draw Premium Scale Icon
    ctx.strokeStyle = colors.gold;
    
    // Base & Pillar
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(85, 165);
    ctx.lineTo(115, 165);
    ctx.moveTo(90, 160);
    ctx.lineTo(110, 160);
    ctx.moveTo(100, 160);
    ctx.lineTo(100, 115);
    ctx.stroke();

    // Top detail (Circle)
    ctx.beginPath();
    ctx.arc(100, 112, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors.gold;
    ctx.fill();

    // Beam
    ctx.beginPath();
    ctx.moveTo(65, 120);
    ctx.lineTo(135, 120);
    ctx.stroke();

    // Chains and Plates
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Left Chains
    ctx.moveTo(70, 120);
    ctx.lineTo(60, 145);
    ctx.moveTo(70, 120);
    ctx.lineTo(80, 145);
    // Right Chains
    ctx.moveTo(130, 120);
    ctx.lineTo(120, 145);
    ctx.moveTo(130, 120);
    ctx.lineTo(140, 145);
    ctx.stroke();

    // Plates
    ctx.beginPath();
    ctx.moveTo(55, 145);
    ctx.quadraticCurveTo(70, 155, 85, 145);
    ctx.moveTo(115, 145);
    ctx.quadraticCurveTo(130, 155, 145, 145);
    ctx.stroke();

    ctx.fillStyle = colors.white;
    ctx.font = 'bold 45px "Times New Roman", serif';
    ctx.fillText('F&C', 150, 140);
    ctx.font = '500 18px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('ADVOCACIA PREVIDENCIÁRIA', 150, 165);
    ctx.letterSpacing = '0px'; // reset
    
    // Top line separator
    ctx.beginPath();
    ctx.moveTo(80, 190);
    ctx.lineTo(800, 190);
    ctx.strokeStyle = colors.white;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Image Area (Right Side)
    const imgX = 580; // Moved slightly right
    const imgY = 220; // Moved slightly up
    const imgW = 420; // Slightly narrower
    const imgH = 680; // Taller

    // White border for image
    ctx.fillStyle = colors.white;
    ctx.fillRect(imgX - 15, imgY - 15, imgW + 30, imgH + 30);

    const imageUrl = uploadedImage || getDefaultImage(topic);
    
    const img = new Image();
    img.crossOrigin = "anonymous"; // Important for external images
    img.onload = () => {
      // Draw image with object-fit: cover logic
      // We use a slightly smarter cover that centers the image
      const baseScale = Math.max(imgW / img.width, imgH / img.height);
      const scale = baseScale * imageZoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (imgW - drawW) / 2 + imageOffsetX;
      const offsetY = (imgH - drawH) / 2 + imageOffsetY;
      
      ctx.save();
      ctx.beginPath();
      // Rounded corners for the image
      if (ctx.roundRect) {
        ctx.roundRect(imgX, imgY, imgW, imgH, 15);
      } else {
        ctx.rect(imgX, imgY, imgW, imgH);
      }
      ctx.clip();
      
      // Draw a subtle shadow/gradient behind the image if it has transparency
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(imgX, imgY, imgW, imgH);
      
      ctx.drawImage(img, imgX + offsetX, imgY + offsetY, drawW, drawH);
      
      // Add a very subtle inner shadow to the image for depth
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 2;
      ctx.strokeRect(imgX, imgY, imgW, imgH);
      
      ctx.restore();
      
      // Draw text after image loads to ensure it's on top if they overlap
      drawTextContent(ctx, width, height);
    };
    img.src = imageUrl;
  };

  const drawTextContent = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!postData) return;

    // 5. Title
    ctx.fillStyle = colors.gold;
    ctx.font = 'italic bold 65px "Times New Roman", serif'; // Slightly smaller to fit better
    
    // Wrap title text
    const titleMaxWidth = 480; // Strict width to avoid image overlap
    let nextY = wrapText(ctx, postData.title, 80, 280, titleMaxWidth, 75);

    // 6. Highlight Box
    const highlightY = nextY + 20;
    ctx.font = 'bold 35px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const highlightMetrics = ctx.measureText(postData.highlight);
    const highlightWidth = Math.min(highlightMetrics.width + 40, 480); // Add padding, max width
    
    ctx.fillStyle = colors.yellowHighlight;
    ctx.fillRect(80, highlightY - 40, highlightWidth, 60);
    ctx.fillStyle = colors.blueText;
    
    // Wrap highlight if needed, though it should be short
    nextY = wrapText(ctx, postData.highlight, 100, highlightY, 440, 40);

    // Highlight underline
    ctx.fillStyle = colors.white;
    ctx.fillRect(80, nextY + 10, 150, 6);

    // 7. Points (List)
    ctx.fillStyle = colors.white;
    ctx.font = '30px "Helvetica Neue", Helvetica, Arial, sans-serif';
    let currentY = nextY + 70;
    
    postData.points.forEach((point, index) => {
      const text = `${index + 1}) ${point}`;
      currentY = wrapText(ctx, text, 80, currentY, 460, 40);
      currentY += 20; // Extra space between points
    });

    // 8. CTA Caption
    if (postData.ctaCaption) {
      ctx.fillStyle = colors.yellowHighlight;
      ctx.font = 'italic bold 32px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.fillText(postData.ctaCaption, 80, 930);
    }

    // 9. Footer
    ctx.fillStyle = colors.white;
    ctx.font = '500 25px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('@advprevfelixecastro', 80, 1000);
  };

  // Redraw canvas when data or image changes
  useEffect(() => {
    if (postData) {
      drawCanvas();
    }
  }, [postData, uploadedImage, imageZoom, imageOffsetX, imageOffsetY]);

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
    setCurrentPostId(null);
    setCurrentPostStatus('draft');
    setIsEditingText(false);
    setIsEditingImage(false);
  };

  const handleSavePost = async (statusOverride?: 'draft' | 'pending_approval' | 'approved') => {
    if (!postData) return;
    
    const newStatus = statusOverride || currentPostStatus;
    const postId = currentPostId || Date.now().toString();
    
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
      status: newStatus,
      strategy
    };
    
    // Optimistic update
    const updated = currentPostId 
      ? savedPosts.map(p => p.id === postId ? newPost : p)
      : [newPost, ...savedPosts];
      
    setSavedPosts(updated);
    localStorage.setItem('marketing_saved_posts', JSON.stringify(updated));
    
    // Clear form after saving
    handleNewPost();
    
    try {
      await supabaseService.saveMarketingPost(newPost);
      if (!statusOverride) {
        alert('Post salvo com sucesso no histórico da nuvem!');
      }
    } catch (error) {
      console.error('Failed to save to Supabase:', error);
      if (!statusOverride) {
        alert('Post salvo localmente, mas houve um erro ao sincronizar com a nuvem.');
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
                  Gerando...
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
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
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
                        className="w-full py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors"
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
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditingText ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                    >
                      <PencilIcon className="w-4 h-4" />
                      {isEditingText ? 'Ocultar Edição' : 'Editar Textos'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingImage(!isEditingImage);
                        if (!isEditingImage) setIsEditingText(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditingImage ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
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
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Ajustes de Posição</h4>
                      <div className="grid grid-cols-3 gap-2 max-w-[150px]">
                        <div />
                        <button onClick={() => setImageOffsetY(prev => prev - 10)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex justify-center"><ChevronUpIcon className="w-4 h-4"/></button>
                        <div />
                        <button onClick={() => setImageOffsetX(prev => prev - 10)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex justify-center"><ChevronLeftIcon className="w-4 h-4"/></button>
                        <button onClick={() => {setImageOffsetX(0); setImageOffsetY(0); setImageZoom(1);}} className="p-2 bg-primary-500 text-white rounded hover:bg-primary-600 flex justify-center text-[10px] items-center">Reset</button>
                        <button onClick={() => setImageOffsetX(prev => prev + 10)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex justify-center"><ChevronRightIcon className="w-4 h-4"/></button>
                        <div />
                        <button onClick={() => setImageOffsetY(prev => prev + 10)} className="p-2 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex justify-center"><ChevronDownIcon className="w-4 h-4"/></button>
                        <div />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-medium opacity-70">Zoom: {Math.round(imageZoom * 100)}%</label>
                          <div className="flex gap-1">
                            <button onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.1))} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-xs">-</button>
                            <button onClick={() => setImageZoom(prev => Math.min(3, prev + 0.1))} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-xs">+</button>
                          </div>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="3" 
                          step="0.1" 
                          value={imageZoom} 
                          onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
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
                      
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold uppercase opacity-40 mb-2">Dica</p>
                        <p className="text-[10px] opacity-60">Use as setas para centralizar o rosto das pessoas ou destacar detalhes importantes da foto.</p>
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
              <SparklesIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Sua arte aparecerá aqui</p>
              <p className="text-sm mt-2">Preencha o tema e clique em Gerar Post</p>
            </div>
          )}
        </div>
      </div>
      {/* Asset Library Modal */}
      {showAssetLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Biblioteca de Ativos</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie e selecione fotos para seus posts</p>
              </div>
              <button 
                onClick={() => setShowAssetLibrary(false)}
                className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
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
                        <img src={newAssetPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
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
