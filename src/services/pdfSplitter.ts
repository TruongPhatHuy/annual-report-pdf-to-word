import { PDFDocument } from 'pdf-lib';

export interface ChunkRange {
  id: string;
  startPage: number;
  endPage: number;
}

/**
 * Convert Uint8Array to base64 string safely without stack size issues
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Loads a PDF document and verifies it is valid and unencrypted
 */
export async function loadAndValidatePdf(arrayBuffer: ArrayBuffer): Promise<{ doc: PDFDocument; pageCount: number }> {
  try {
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    if (pageCount <= 0) {
      throw new Error('Tài liệu PDF không có trang nào hoặc bị trống.');
    }
    return { doc, pageCount };
  } catch (err: any) {
    const message = err.message || '';
    if (message.toLowerCase().includes('password') || message.toLowerCase().includes('encrypted')) {
      throw new Error('Tài liệu PDF này có mật khẩu bảo vệ. Vui lòng gỡ mật khẩu trước khi tải lên.');
    }
    if (message.includes('PDFHeader') || message.includes('corrupted') || message.includes('Invalid PDF')) {
      throw new Error('Tập tin không phải là định dạng PDF hợp lệ hoặc bị lỗi dữ liệu.');
    }
    throw new Error(`Không thể đọc tài liệu PDF: ${err.message || 'Lỗi không xác định'}`);
  }
}

/**
 * Splits total page count into chunk ranges with specified chunk size
 */
export function generateChunkRanges(totalPages: number, chunkSize: number): ChunkRange[] {
  const ranges: ChunkRange[] = [];
  const safeChunkSize = Math.max(1, Math.min(chunkSize, 20));

  let currentStart = 1;
  let index = 1;

  while (currentStart <= totalPages) {
    const currentEnd = Math.min(currentStart + safeChunkSize - 1, totalPages);
    ranges.push({
      id: `chunk-${index}-${currentStart}-${currentEnd}`,
      startPage: currentStart,
      endPage: currentEnd,
    });
    currentStart = currentEnd + 1;
    index++;
  }

  return ranges;
}

/**
 * Extracts specified pages [startPage..endPage] from source PDF into a new PDF base64.
 * If the resulting chunk exceeds maxBytes (~15MB), it breaks down into smaller subchunks.
 */
export async function extractPagesAsPdfBase64(
  sourceDoc: PDFDocument,
  startPage: number,
  endPage: number,
  maxBytes = 14 * 1024 * 1024
): Promise<{ base64: string; byteLength: number; subRanges?: ChunkRange[] }> {
  const pageCount = endPage - startPage + 1;
  const newDoc = await PDFDocument.create();

  // Page indices in pdf-lib are 0-based
  const pageIndices: number[] = [];
  for (let p = startPage; p <= endPage; p++) {
    pageIndices.push(p - 1);
  }

  // Copy pages as-is (NO rotation, Gemini reads landscape fine)
  const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save();

  // Check if chunk size exceeds ~14-15MB threshold
  if (pdfBytes.byteLength > maxBytes && pageCount > 1) {
    // Generate split halves subranges so caller knows to split this chunk
    const mid = Math.floor((startPage + endPage) / 2);
    const subRanges: ChunkRange[] = [
      {
        id: `chunk-sub-a-${startPage}-${mid}`,
        startPage,
        endPage: mid,
      },
      {
        id: `chunk-sub-b-${mid + 1}-${endPage}`,
        startPage: mid + 1,
        endPage,
      },
    ];
    return {
      base64: '',
      byteLength: pdfBytes.byteLength,
      subRanges,
    };
  }

  return {
    base64: uint8ArrayToBase64(pdfBytes),
    byteLength: pdfBytes.byteLength,
  };
}
