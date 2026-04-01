import * as pdfjsLib from 'pdfjs-dist';

// Use specific version from CDN to ensure stability and match package.json
const PDFJS_VERSION = '3.11.174';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  images: string[]; // Base64 strings for pages that need OCR/Vision
  isScanned: boolean;
  fileHash?: string;
  totalPages: number;
}

/**
 * Applies a high-contrast filter to a canvas.
 * Optimized for Vision AI reading.
 */
function applyHighContrastFilter(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Grayscale using luminance formula
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Increase contrast: push values away from middle gray
    let value = gray;
    if (gray < 128) {
      value = Math.max(0, gray * 0.8); // Darken darks
    } else {
      value = Math.min(255, gray * 1.2); // Brighten brights
    }
    
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
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

export async function extractTextFromPDF(
  file: File,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<PDFContent> {
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    console.error("PDF.js library not loaded correctly.");
    return {
      text: "ERRO TÉCNICO: A biblioteca de leitura de PDF não foi carregada.",
      images: [],
      isScanned: false,
      totalPages: 0
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
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    const images: string[] = [];
    const totalPages = pdf.numPages;
    
    // Limit image extraction to 50 pages if they are small, or less if large
    const MAX_PAGES_FOR_VISION = 50; 
    
    for (let i = 1; i <= totalPages; i++) {
      try {
        if (onProgress) onProgress(i, totalPages, `Lendo página ${i} de ${totalPages}...`);
        
        // Yield to main thread
        await new Promise(resolve => setTimeout(resolve, 20));

        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `--- PÁGINA ${i} ---\n${pageText}\n\n`;
        } else {
          fullText += `--- PÁGINA ${i} (Página de Imagem/Escaneada) ---\n\n`;
        }
        
        // 2. Extract Image (OCR for handwritten/scanned docs)
        // FORCE image extraction for the first 10 pages (most critical for TRCT/CNIS/Procuração)
        const isCriticalPage = i <= 10;
        const isLowTextDensity = pageText.trim().length < 150; 

        if ((isLowTextDensity || isCriticalPage) && i <= MAX_PAGES_FOR_VISION) {
            try {
                // DYNAMIC SCALING: Target ~2048px on the longest side
                const originalViewport = page.getViewport({ scale: 1.0 });
                const targetLongestSide = 2048;
                const currentLongestSide = Math.max(originalViewport.width, originalViewport.height);
                const dynamicScale = Math.min(3.0, targetLongestSide / currentLongestSide);
                
                let viewport = page.getViewport({ scale: dynamicScale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { alpha: false }); 
                
                if (context) {
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  
                  context.fillStyle = '#FFFFFF';
                  context.fillRect(0, 0, canvas.width, canvas.height);

                  await page.render({ 
                    canvasContext: context, 
                    viewport: viewport 
                  }).promise;
                  
                  applyHighContrastFilter(canvas);
                  
                  // COMPRESSION: JPEG 0.7 is a good balance
                  const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                  images.push(base64);
                  
                  // CLEANUP
                  canvas.width = 0;
                  canvas.height = 0;
                  canvas.remove();
                }
            } catch (renderError) {
                console.warn(`Erro ao renderizar imagem da página ${i}, tentando escala 1.0:`, renderError);
                try {
                    const viewport = page.getViewport({ scale: 1.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport }).promise;
                        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                        images.push(base64);
                        canvas.width = 0;
                        canvas.height = 0;
                        canvas.remove();
                    }
                } catch (e) {}
            }
        }
      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
        fullText += `\n[Erro de leitura na página ${i}]\n`;
      }
    }

    const isScanned = images.length > 0;

    return { text: fullText, images, isScanned, fileHash, totalPages };

  } catch (error: any) {
    console.error("PDF Extraction Fatal Error:", error);
    return {
        text: `ERRO DE LEITURA: ${error.message || "Falha ao processar PDF."}`,
        images: [],
        isScanned: false,
        totalPages: 0
    };
  }
}
