import { ChunkRange } from './pdfSplitter';

export interface PageRangeValidationResult {
  isValid: boolean;
  errorMessage?: string;
  totalPagesSelected: number;
  selectedPages: number[];
  contiguousRanges: Array<{ startPage: number; endPage: number }>;
}

/**
 * Parses and validates a page range string (e.g. "1-20, 45-60, 90" or "")
 * against the document total page count.
 */
export function validateAndParsePageRanges(
  input: string,
  docTotalPages: number
): PageRangeValidationResult {
  const trimmed = input.trim();

  // If empty, select all pages
  if (!trimmed) {
    if (docTotalPages <= 0) {
      return {
        isValid: true,
        totalPagesSelected: 0,
        selectedPages: [],
        contiguousRanges: [],
      };
    }
    const allPages = Array.from({ length: docTotalPages }, (_, i) => i + 1);
    return {
      isValid: true,
      totalPagesSelected: docTotalPages,
      selectedPages: allPages,
      contiguousRanges: [{ startPage: 1, endPage: docTotalPages }],
    };
  }

  // Check valid characters: only digits, hyphens, commas, and whitespace
  if (!/^[\d\s,-]+$/.test(trimmed)) {
    return {
      isValid: false,
      errorMessage:
        'Định dạng không hợp lệ. Chỉ dùng số, dấu gạch ngang (-) và dấu phẩy (,). Ví dụ: 1-20, 45-60, 90',
      totalPagesSelected: 0,
      selectedPages: [],
      contiguousRanges: [],
    };
  }

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng nhập ít nhất một trang hoặc khoảng trang hợp lệ.',
      totalPagesSelected: 0,
      selectedPages: [],
      contiguousRanges: [],
    };
  }

  const selectedPagesSet = new Set<number>();
  const parsedRanges: Array<{ startPage: number; endPage: number }> = [];

  for (const part of parts) {
    if (part.includes('-')) {
      const sides = part.split('-').map((s) => s.trim());
      if (sides.length !== 2 || !sides[0] || !sides[1]) {
        return {
          isValid: false,
          errorMessage: `Đoạn '${part}' không hợp lệ. Hãy viết dạng '1-20'.`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      const start = parseInt(sides[0], 10);
      const end = parseInt(sides[1], 10);

      if (isNaN(start) || isNaN(end)) {
        return {
          isValid: false,
          errorMessage: `Khoảng '${part}' chứa ký tự số không hợp lệ.`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      if (start < 1) {
        return {
          isValid: false,
          errorMessage: `Trang bắt đầu (${start}) phải lớn hơn hoặc bằng 1.`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      if (end < start) {
        return {
          isValid: false,
          errorMessage: `Khoảng '${part}' không hợp lệ: trang bắt đầu (${start}) lớn hơn trang kết thúc (${end}).`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      if (end > docTotalPages) {
        return {
          isValid: false,
          errorMessage: `Trang ${end} trong '${part}' vượt quá tổng số trang tài liệu (${docTotalPages} trang).`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      // Check overlap
      for (let p = start; p <= end; p++) {
        if (selectedPagesSet.has(p)) {
          return {
            isValid: false,
            errorMessage: `Phát hiện trang bị trùng lặp: trang ${p} đã được chọn trong khoảng trước đó.`,
            totalPagesSelected: 0,
            selectedPages: [],
            contiguousRanges: [],
          };
        }
        selectedPagesSet.add(p);
      }

      parsedRanges.push({ startPage: start, endPage: end });
    } else {
      // Single page
      const page = parseInt(part, 10);
      if (isNaN(page) || page < 1) {
        return {
          isValid: false,
          errorMessage: `Số trang '${part}' không hợp lệ (phải là số nguyên dương >= 1).`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      if (page > docTotalPages) {
        return {
          isValid: false,
          errorMessage: `Trang ${page} vượt quá tổng số trang của tài liệu (${docTotalPages} trang).`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      if (selectedPagesSet.has(page)) {
        return {
          isValid: false,
          errorMessage: `Phát hiện trang trùng lặp: trang ${page} đã được khai báo trước đó.`,
          totalPagesSelected: 0,
          selectedPages: [],
          contiguousRanges: [],
        };
      }

      selectedPagesSet.add(page);
      parsedRanges.push({ startPage: page, endPage: page });
    }
  }

  // Sort ranges by startPage
  parsedRanges.sort((a, b) => a.startPage - b.startPage);

  // Merge adjacent contiguous ranges if applicable (e.g. 1-10 and 11-20 -> 1-20)
  const mergedContiguous: Array<{ startPage: number; endPage: number }> = [];
  for (const r of parsedRanges) {
    if (mergedContiguous.length === 0) {
      mergedContiguous.push({ ...r });
    } else {
      const last = mergedContiguous[mergedContiguous.length - 1];
      if (r.startPage === last.endPage + 1) {
        last.endPage = r.endPage;
      } else {
        mergedContiguous.push({ ...r });
      }
    }
  }

  const sortedPages = Array.from(selectedPagesSet).sort((a, b) => a - b);

  return {
    isValid: true,
    totalPagesSelected: sortedPages.length,
    selectedPages: sortedPages,
    contiguousRanges: mergedContiguous,
  };
}

/**
 * Generates chunk ranges respecting contiguous groups and chunkSize.
 * Never mixes non-contiguous gaps into a single chunk.
 */
export function generateChunkRangesForSelection(
  contiguousRanges: Array<{ startPage: number; endPage: number }>,
  chunkSize: number
): ChunkRange[] {
  const safeChunkSize = Math.max(1, Math.min(chunkSize, 20));
  const chunkRanges: ChunkRange[] = [];
  let chunkIndex = 1;

  for (const range of contiguousRanges) {
    let currentStart = range.startPage;
    while (currentStart <= range.endPage) {
      const currentEnd = Math.min(currentStart + safeChunkSize - 1, range.endPage);
      chunkRanges.push({
        id: `chunk-${chunkIndex}-${currentStart}-${currentEnd}`,
        startPage: currentStart,
        endPage: currentEnd,
      });
      currentStart = currentEnd + 1;
      chunkIndex++;
    }
  }

  return chunkRanges;
}
