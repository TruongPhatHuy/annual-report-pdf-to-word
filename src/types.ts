export type ChunkStatus =
  | 'pending'
  | 'waiting-for-rate-limit'
  | 'running'
  | 'done'
  | 'failed'
  | 'paused'
  | 'split';

export interface ChunkTokens {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface PdfChunk {
  id: string;
  startPage: number;
  endPage: number;
  status: ChunkStatus;
  markdown: string;
  error?: string;
  attempts: number;
  tokens?: ChunkTokens;
  finishReason?: string;
  durationMs?: number;
  pdfBase64?: string; // cached or generated on-demand
  waitingSecondsRemaining?: number;
}

export type ApiTier = 'free' | 'paid' | 'custom';

export interface ExtractionSettings {
  model: string;
  chunkSize: number; // default 8 (range 3-15)
  concurrency: number; // default 2 (range 1-4)
  includePageMarkers: boolean; // default true
  apiTier: ApiTier; // 'free' | 'paid' | 'custom'
  maxRpm: number; // requests per minute (default 4 for free tier)
  dailyQuota: number | null; // requests per day (default 20 for free tier, null for paid)
  pageRangeInput: string; // e.g. "1-20, 45-60" or "" for all pages
}

export interface TableRowDiscrepancy {
  rowIndex: number;
  cellsFound: number;
  expectedCells: number;
  snippet?: string;
}

export interface InconsistentTableIssue {
  pageNumber?: number;
  tableIndex: number;
  headerColumnCount: number;
  rowDiscrepancies: TableRowDiscrepancy[];
}

export interface ValidationReport {
  totalPages: number;
  coveredPagesCount: number;
  coveredPages: number[];
  missingPages: number[];
  tableCount: number;
  inconsistentTables: InconsistentTableIssue[];
  estimatedValuesCount: number; // values with ~
  naValuesCount: number; // values with N/A
  totalPageMarkersCount: number;
  timestamp: string;
  fileName: string;
  modelUsed: string;
}

export interface AvailableModel {
  id: string;
  name: string;
  badge: string;
  description: string;
  isPro?: boolean;
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Khuyên dùng / Tối ưu chi phí',
    description: 'Xử lý nhanh, chi phí thấp, tối ưu cho tài liệu và báo cáo dài 100-300+ trang.',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon (Pro)',
    badge: 'Pro / Tư duy & Biểu đồ phức tạp',
    description: 'Khả năng suy luận cao cấp nhất, phân tích biểu đồ tài chính và cấu trúc phức tạp.',
    isPro: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Siêu tốc độ',
    description: 'Tốc độ cực nhanh cho các tài liệu tiêu chuẩn ít phức tạp.',
  },
];

export interface SavedPdfSession {
  fileName: string;
  fileSizeBytes: number;
  totalPages: number;
  savedAt: string;
  model: string;
  chunks: Array<{
    id: string;
    startPage: number;
    endPage: number;
    status: ChunkStatus;
    markdown: string;
    attempts: number;
    tokens?: ChunkTokens;
    durationMs?: number;
  }>;
}
