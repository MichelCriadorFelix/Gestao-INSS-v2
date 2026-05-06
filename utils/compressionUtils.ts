import imageCompression from 'browser-image-compression';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Setup PDF worker
// Note: In an AIS environment, we might need to point this to a local URL or a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  try {
    const compressedFile = await imageCompression(file, options);
    return new File([compressedFile], file.name, { type: file.type });
  } catch (error) {
    console.error('Erro ao comprimir imagem:', error);
    return file;
  }
}

export async function compressPDF(file: File, onProgress?: (progress: number) => void): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    
    // Configurações do novo PDF
    const newPdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [595, 842] // A4 roughly
    });

    for (let i = 1; i <= numPages; i++) {
        if (onProgress) onProgress((i / numPages) * 100);
        
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // Escala balanceada
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            // Converte o canvas para imagem JPEG comprimida
            const imgData = canvas.toDataURL('image/jpeg', 0.6); // 60% qualidade
            
            if (i > 1) newPdf.addPage();
            
            // Ajusta a imagem para ocupar a página A4
            const imgWidth = 595; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            newPdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
        }
    }

    const compressedBlob = newPdf.output('blob');
    return new File([compressedBlob], file.name.replace(/\.pdf$/i, '_comprimido.pdf'), { type: 'application/pdf' });
  } catch (error) {
    console.error('Erro ao comprimir PDF:', error);
    return file;
  }
}
