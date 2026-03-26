import * as pdfjsLib from 'pdfjs-dist';

// Use specific version from CDN to ensure stability and match package.json
const PDFJS_VERSION = '3.11.174';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  images: string[]; // Base64 strings for pages that need OCR/Vision
  isScanned: boolean;
  fileHash?: string;
}

/**
 * Applies a high-contrast black and white filter to a canvas.
 * This is the "Filtro de Xerox" to optimize OCR and reduce token usage.
 */
function applyXeroxFilter(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Threshold for black and white conversion
  // 128 is the middle, but we can adjust for better contrast
  const threshold = 140; 

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Grayscale using luminance formula
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // thresholding removed to preserve fine details for Vision AI
    const value = gray; // Keep original grayscale intensity
    
    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Generates a SHA-256 hash of a file to use as a cache key.
 */
async function getFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function extractTextFromPDF(file: File): Promise<PDFContent> {
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    console.error("PDF.js library not loaded correctly.");
    return {
      text: "ERRO TÉCNICO: A biblioteca de leitura de PDF não foi carregada. Tente recarregar a página.",
      images: [],
      isScanned: false
    };
  }

  try {
    const fileHash = await getFileHash(file);
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    });
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Tempo limite de leitura do PDF excedido (60s).")), 60000)
    );

    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    let fullText = '';
    const images: string[] = [];
    
    // MEMORY SAFE OCR SETTINGS
    // We limit image extraction to 30 pages now that we optimize them
    const MAX_PAGES_FOR_OCR = 30; 
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        // Yield to main thread to prevent UI freeze
        await new Promise(resolve => setTimeout(resolve, 50));

        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        // CRITICAL: If it's a critical page (1-5), we IGNORE the digital text layer
        // to prevent "poisoning" the AI with incorrect hidden text data.
        // We want the AI to use ONLY its eyes (Vision) for these pages.
        const isCriticalPage = i <= 5;
        
        if (pageText.trim() && !isCriticalPage) {
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        } else if (isCriticalPage) {
          fullText += `--- Página ${i} (Leitura Visual Obrigatória) ---\n[Conteúdo enviado via imagem para auditoria pericial]\n\n`;
        }
        
        // 2. Extract Image (OCR for handwritten/scanned docs)
        // FORCE image extraction for the first 5 pages (most critical for TRCT/CNIS)
        const isLowTextDensity = pageText.trim().length < 100; 

        if ((isLowTextDensity || isCriticalPage) && i <= MAX_PAGES_FOR_OCR) {
            try {
                // SCALE: 3.0 for ultra-high-definition Vision AI reading
                const viewport = page.getViewport({ scale: 3.0 }); 
                
                // Safety check for abnormally large pages (increased limit for 3.0 scale)
                if (viewport.width * viewport.height > 25000000) {
                   fullText += `[AVISO: Imagem da página ${i} muito pesada, leitura visual ignorada para evitar travamento]\n`;
                   continue;
                }

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { alpha: false }); 
                
                if (context) {
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  
                  // Fill white background before rendering
                  context.fillStyle = '#FFFFFF';
                  context.fillRect(0, 0, canvas.width, canvas.height);

                  const renderTask = page.render({ 
                    canvasContext: context, 
                    viewport: viewport 
                  }).promise;
                  
                  const renderTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Render timeout")), 20000)
                  );
                  
                  await Promise.race([renderTask, renderTimeout]);
                  
                  // APPLY SOFT GRAYSCALE FILTER (Preserves details better than B&W)
                  applyXeroxFilter(canvas);
                  
                  // COMPRESSION: Higher quality for Vision AI
                  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                  images.push(base64);
                  
                  // AGGRESSIVE MEMORY CLEANUP
                  canvas.width = 0;
                  canvas.height = 0;
                  canvas.remove();
                }
            } catch (renderError) {
                console.warn(`Erro ao renderizar imagem da página ${i}:`, renderError);
            }
        } else if (isLowTextDensity && i > MAX_PAGES_FOR_OCR) {
             fullText += `[AVISO: Página ${i} parece ser uma imagem, mas o limite seguro de ${MAX_PAGES_FOR_OCR} páginas visuais foi atingido. Envie esta página separadamente se necessário.]\n`;
        }

      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
        fullText += `\n[Erro de leitura na página ${i}]\n`;
      }
    }

    const isScanned = images.length > 0;

    if (!fullText.trim() && images.length === 0) {
       return { 
         text: "AVISO: Não foi possível extrair conteúdo deste arquivo.", 
         images: [], 
         isScanned: false,
         fileHash
       };
    }

    return { text: fullText, images, isScanned, fileHash };

  } catch (error: any) {
    console.error("PDF Extraction Fatal Error:", error);
    return {
        text: `ERRO DE LEITURA: ${error.message || "Falha ao processar PDF."}`,
        images: [],
        isScanned: false
    };
  }
}
