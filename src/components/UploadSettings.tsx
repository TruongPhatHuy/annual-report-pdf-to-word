import React, { useRef, useState, useMemo } from 'react';
import {
  UploadCloud,
  FileCheck,
  Settings2,
  Sliders,
  Layers,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Gauge,
  CalendarClock,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import { AVAILABLE_MODELS, ExtractionSettings, ApiTier } from '../types';
import { validateAndParsePageRanges, generateChunkRangesForSelection } from '../services/pageRange';
import { getRequestsUsedToday } from '../services/storage';

interface UploadSettingsProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  pageCount: number | null;
  fileSizeBytes: number | null;
  isLoadingFile: boolean;
  fileError: string | null;
  settings: ExtractionSettings;
  onSettingsChange: (newSettings: ExtractionSettings) => void;
  onStartExtraction: () => void;
  isProcessing: boolean;
  onLoadSample: () => void;
}

export const UploadSettings: React.FC<UploadSettingsProps> = ({
  onFileSelected,
  selectedFile,
  pageCount,
  fileSizeBytes,
  isLoadingFile,
  fileError,
  settings,
  onSettingsChange,
  onStartExtraction,
  isProcessing,
  onLoadSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        onFileSelected(file);
      }
    }
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length > 0) onFileSelected(e.target.files[0]);
  };
  const formatFileSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const pageRangeValidation = useMemo(() => {
    if (!pageCount) return { isValid: true, totalPagesSelected: 0, selectedPages: [], contiguousRanges: [] };
    return validateAndParsePageRanges(settings.pageRangeInput, pageCount);
  }, [settings.pageRangeInput, pageCount]);

  const estimatedChunks = useMemo(() => {
    if (!pageCount || !pageRangeValidation.isValid || pageRangeValidation.contiguousRanges.length === 0) return 0;
    return generateChunkRangesForSelection(pageRangeValidation.contiguousRanges, settings.chunkSize).length;
  }, [pageCount, pageRangeValidation, settings.chunkSize]);

  const usedToday = getRequestsUsedToday();
  const dailyQuota = settings.dailyQuota;
  const remainingToday = dailyQuota !== null ? Math.max(0, dailyQuota - usedToday) : null;
  const isOverDailyQuota = remainingToday !== null && estimatedChunks > remainingToday && estimatedChunks > 0;

  const handleApiTierChange = (tier: ApiTier) => {
    if (tier === 'free') onSettingsChange({ ...settings, apiTier: 'free', maxRpm: 4, dailyQuota: 20 });
    else if (tier === 'paid') onSettingsChange({ ...settings, apiTier: 'paid', maxRpm: 60, dailyQuota: null });
    else onSettingsChange({ ...settings, apiTier: 'custom', maxRpm: settings.maxRpm || 4, dailyQuota: settings.dailyQuota ?? 20 });
  };

  const applyIncreaseChunkSize = () => {
    if (remainingToday && remainingToday > 0 && pageRangeValidation.totalPagesSelected > 0) {
      const idealSize = Math.min(15, Math.max(3, Math.ceil(pageRangeValidation.totalPagesSelected / remainingToday)));
      onSettingsChange({ ...settings, chunkSize: idealSize });
    }
  };

  const applyNarrowPageRange = () => {
    if (remainingToday && remainingToday > 0) {
      const maxPages = remainingToday * settings.chunkSize;
      onSettingsChange({ ...settings, pageRangeInput: `1-${Math.min(pageCount || 1, maxPages)}` });
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero section — flat, no gradient */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded mb-3">
            Tối ưu cho Báo cáo thường niên (100–300+ trang)
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
            Chuyển đổi PDF Báo Cáo Thường Niên sang Word (.docx) Chuẩn Cấu Trúc
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
            Trích xuất chính xác 100% nội dung nguyên văn, bảng biểu tài chính nhiều cột, số liệu biểu đồ
            (gán nhãn <code className="text-zinc-400">~</code> cho ước lượng), sơ đồ tổ chức thành Word và Markdown chuẩn RAG/LLM.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Giữ nguyên cấu trúc bảng & gộp ô
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Tự động ghép nối bảng ngắt trang
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Bộ điều tiết Rate Limiter an toàn
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Uploader */}
        <div className="lg:col-span-7 space-y-3">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-500/5'
                : selectedFile
                ? 'border-emerald-600/40 bg-emerald-500/5 hover:border-emerald-600/60'
                : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600'
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileInput} accept="application/pdf" className="hidden" />

            {isLoadingFile ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Đang phân tích cấu trúc PDF...</p>
              </div>
            ) : selectedFile ? (
              <div className="py-2 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-500">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100 break-all max-w-md mx-auto">{selectedFile.name}</h3>
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
                      {formatFileSize(fileSizeBytes || selectedFile.size)}
                    </span>
                    {pageCount && (
                      <span className="bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-blue-400 font-mono">
                        {pageCount} trang
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-600">Nhấp hoặc kéo thả file PDF khác để thay đổi</p>
              </div>
            ) : (
              <div className="py-6 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-200">Kéo & thả tập tin PDF báo cáo vào đây</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Hỗ trợ 100–300+ trang (Báo cáo thường niên, Tài chính, ESG)
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                  Chọn file PDF từ máy tính
                </span>
              </div>
            )}
          </div>

          {fileError && (
            <div className="p-3 rounded-md bg-zinc-900 border border-red-800/50 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-300">Không thể tải tập tin PDF</p>
                <p className="mt-0.5 text-red-400/80">{fileError}</p>
              </div>
            </div>
          )}

          {!selectedFile && (
            <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-zinc-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Muốn thử nghiệm ngay?</p>
                  <p className="text-[11px] text-zinc-500">Tải mẫu báo cáo thường niên giả định</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLoadSample}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
              >
                Dùng file mẫu
              </button>
            </div>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="lg:col-span-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-zinc-500" />
                <h3 className="font-medium text-sm text-zinc-200">Cấu hình trích xuất (Pipeline)</h3>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono">Step 1</span>
            </div>

            {/* API Tier */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  Gói API & Rate Limiter
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">{settings.maxRpm} RPM</span>
              </div>
              <select
                value={settings.apiTier}
                onChange={(e) => handleApiTierChange(e.target.value as ApiTier)}
                disabled={isProcessing}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40"
              >
                <option value="free">Miễn phí (5 RPM / 20 RPD — mặc định 4 RPM an toàn)</option>
                <option value="paid">Trả phí (60 RPM — không giới hạn ngày)</option>
                <option value="custom">Tùy chỉnh (Tự đặt RPM & Hạn mức)</option>
              </select>

              {settings.apiTier === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Giới hạn RPM (1–120):</label>
                    <input
                      type="number" min="1" max="120" value={settings.maxRpm}
                      onChange={(e) => onSettingsChange({ ...settings, maxRpm: parseInt(e.target.value, 10) || 4 })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Quota/ngày:</label>
                    <input
                      type="number" min="1" placeholder="Không giới hạn"
                      value={settings.dailyQuota ?? ''}
                      onChange={(e) => onSettingsChange({ ...settings, dailyQuota: e.target.value ? parseInt(e.target.value, 10) : null })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800 text-zinc-500">
                <span className="flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Đã dùng hôm nay:
                </span>
                <span className="font-mono text-zinc-300">{usedToday}{dailyQuota !== null ? ` / ${dailyQuota} req` : ' req'}</span>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">Mô hình Gemini</label>
                <span className="text-[10px] text-blue-500">Tự động tối ưu</span>
              </div>
              <select
                value={settings.model}
                onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                disabled={isProcessing}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.badge}</option>
                ))}
              </select>
            </div>

            {/* Page Range */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Phạm vi trang (Page Range)
                </label>
                <span className="text-[10px] text-zinc-600">
                  {settings.pageRangeInput.trim() ? 'Đã lọc trang' : 'Tất cả'}
                </span>
              </div>
              <input
                type="text"
                placeholder={pageCount ? `VD: 1-20, 45-60 (để trống: cả ${pageCount} trang)` : 'VD: 1-20, 45-60'}
                value={settings.pageRangeInput}
                onChange={(e) => onSettingsChange({ ...settings, pageRangeInput: e.target.value })}
                disabled={isProcessing}
                className={`w-full bg-zinc-800 border rounded px-2.5 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 disabled:opacity-40 ${
                  pageRangeValidation.isValid
                    ? 'border-zinc-700 focus:ring-blue-500 focus:border-blue-500'
                    : 'border-red-700 focus:ring-red-500 text-red-300'
                }`}
              />
              {!pageRangeValidation.isValid ? (
                <p className="mt-1 text-[11px] text-red-400">{pageRangeValidation.errorMessage}</p>
              ) : (
                <p className="mt-1 text-[11px] text-zinc-600">
                  {pageCount ? `Đang chọn ${pageRangeValidation.totalPagesSelected} / ${pageCount} trang.` : 'Nhập dải trang để tiết kiệm quota.'}
                </p>
              )}
            </div>

            {/* Chunk Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Kích thước mỗi đoạn (Chunk Size)
                </label>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-blue-400">
                  {settings.chunkSize} trang
                </span>
              </div>
              <input
                type="range" min="3" max="15" step="1"
                value={settings.chunkSize}
                onChange={(e) => onSettingsChange({ ...settings, chunkSize: parseInt(e.target.value, 10) })}
                disabled={isProcessing}
                className="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                <span>3</span><span>8 (chuẩn)</span><span>15 (tiết kiệm)</span>
              </div>
            </div>

            {/* Concurrency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Luồng đồng thời (Concurrency)
                </label>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300">
                  {settings.concurrency}
                </span>
              </div>
              <input
                type="range" min="1" max="4" step="1"
                value={settings.concurrency}
                onChange={(e) => onSettingsChange({ ...settings, concurrency: parseInt(e.target.value, 10) })}
                disabled={isProcessing}
                className="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
              />
              <p className="text-[10px] text-zinc-600 mt-0.5">
                *Rate Limiter ({settings.maxRpm} RPM) luôn ưu tiên tối thượng.
              </p>
            </div>

            {/* Page markers toggle */}
            <div className="pt-3 border-t border-zinc-800">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-medium text-zinc-300">Ghi số trang vào file Word</span>
                  <p className="text-[11px] text-zinc-500">
                    Chèn dòng <code className="text-zinc-400">— [Trang N] —</code>
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includePageMarkers}
                  onChange={(e) => onSettingsChange({ ...settings, includePageMarkers: e.target.checked })}
                  disabled={isProcessing}
                  className="w-4 h-4 rounded text-blue-600 bg-zinc-800 border-zinc-700 cursor-pointer disabled:opacity-40"
                />
              </label>
            </div>

            {/* Quota Warning */}
            {isOverDailyQuota && (
              <div className="p-3 rounded-md bg-zinc-900 border border-amber-700/40 text-amber-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-200">Ước tính vượt quota hôm nay</p>
                    <p className="mt-0.5 text-[11px] text-amber-400/80">
                      Cần ~<strong>{estimatedChunks} req</strong>, còn lại <strong>{remainingToday} req</strong> (đã dùng {usedToday}/{dailyQuota}).
                    </p>
                  </div>
                </div>
                <div className="pt-1 border-t border-zinc-800 space-y-1">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Gợi ý 1-click:</span>
                  <div className="flex flex-col gap-1">
                    {remainingToday && remainingToday > 0 && settings.chunkSize < 15 && (
                      <button type="button" onClick={applyIncreaseChunkSize}
                        className="w-full text-left px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 flex items-center justify-between border border-zinc-700 transition-colors">
                        <span className="flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-zinc-500" />
                          Tăng lên {Math.min(15, Math.max(3, Math.ceil(pageRangeValidation.totalPagesSelected / (remainingToday || 1))))} trang/đoạn
                        </span>
                        <span className="text-[10px] text-blue-400">Áp dụng</span>
                      </button>
                    )}
                    {remainingToday && remainingToday > 0 && (
                      <button type="button" onClick={applyNarrowPageRange}
                        className="w-full text-left px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 flex items-center justify-between border border-zinc-700 transition-colors">
                        <span className="flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-zinc-500" />
                          Thu hẹp phạm vi (1–{remainingToday * settings.chunkSize})
                        </span>
                        <span className="text-[10px] text-blue-400">Áp dụng</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plan & Start */}
            <div className="pt-3 border-t border-zinc-800 space-y-2.5">
              {pageCount && (
                <div className="p-2.5 rounded bg-zinc-800/60 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between font-mono">
                  <span className="text-zinc-500">Ước tính:</span>
                  <span className="text-zinc-200">
                    {estimatedChunks} đoạn · {estimatedChunks} req · {pageRangeValidation.totalPagesSelected} trang
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={onStartExtraction}
                disabled={!selectedFile || isProcessing || !pageCount || !pageRangeValidation.isValid || pageRangeValidation.totalPagesSelected === 0}
                className="w-full py-2.5 px-4 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Bắt đầu trích xuất ({pageRangeValidation.totalPagesSelected || pageCount || 0} trang)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};