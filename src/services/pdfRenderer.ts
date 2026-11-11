import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
try {
  // Vite URL resolution for ESM worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Fallback if import.meta.url resolution is not available
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface RenderPageResult {
  width: number;
  height: number;
  scale: number;
}

// Cache of loaded PDF document proxy
let cachedPdfDoc: any = null;
let cachedArrayBuffer: ArrayBuffer | null = null;

export async function getPdfDocumentProxy(arrayBuffer: ArrayBuffer) {
  if (cachedPdfDoc && cachedArrayBuffer === arrayBuffer) {
    return cachedPdfDoc;
  }
  // Clone buffer slice to avoid detached buffer issues
  const bufferCopy = arrayBuffer.slice(0);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bufferCopy),
    useSystemFonts: true,
  });
  cachedPdfDoc = await loadingTask.promise;
  cachedArrayBuffer = arrayBuffer;
  return cachedPdfDoc;
}

export function clearPdfDocCache() {
  cachedPdfDoc = null;
  cachedArrayBuffer = null;
}

/**
 * Renders a 1-based page number onto the provided canvas
 */
export async function renderPdfPage(
  arrayBuffer: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.2
): Promise<RenderPageResult> {
  const pdfDoc = await getPdfDocumentProxy(arrayBuffer);
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context không khả dụng');
  }

  // Adjust canvas resolution for retina displays
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.save();
  context.scale(outputScale, outputScale);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;
  context.restore();

  return {
    width: viewport.width,
    height: viewport.height,
    scale,
  };
}
