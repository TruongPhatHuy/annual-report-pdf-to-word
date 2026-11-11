import React, { useRef, useState, useMemo } from 'react';
import {
  UploadCloud,
  FileCheck,
  Settings2,
  Sliders,
  Layers,
  Sparkles,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Gauge,
  CalendarClock,
  HelpCircle,
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        onFileSelected(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Validate page range
  const pageRangeValidation = useMemo(() => {
    if (!pageCount) {
      return {
        isValid: true,
        totalPagesSelected: 0,
        selectedPages: [],
        contiguousRanges: [],
      };
    }
    return validateAndParsePageRanges(settings.pageRangeInput, pageCount);
  }, [settings.pageRangeInput, pageCount]);

  // Calculate chunks estimate
  const estimatedChunks = useMemo(() => {
    if (!pageCount || !pageRangeValidation.isValid || pageRangeValidation.contiguousRanges.length === 0) {
      return 0;
    }
    const chunks = generateChunkRangesForSelection(
      pageRangeValidation.contiguousRanges,
      settings.chunkSize
    );
    return chunks.length;
  }, [pageCount, pageRangeValidation, settings.chunkSize]);

  // Daily usage calculation
  const usedToday = getRequestsUsedToday();
  const dailyQuota = settings.dailyQuota;
  const remainingToday = dailyQuota !== null ? Math.max(0, dailyQuota - usedToday) : null;
  const isOverDailyQuota =
    remainingToday !== null && estimatedChunks > remainingToday && estimatedChunks > 0;

  // Handle API Tier change
  const handleApiTierChange = (tier: ApiTier) => {
    if (tier === 'free') {
      onSettingsChange({
        ...settings,
        apiTier: 'free',
        maxRpm: 4,
        dailyQuota: 20,
      });
    } else if (tier === 'paid') {
      onSettingsChange({
        ...settings,
        apiTier: 'paid',
        maxRpm: 60,
        dailyQuota: null,
      });
    } else {
      onSettingsChange({
        ...settings,
        apiTier: 'custom',
        maxRpm: settings.maxRpm || 4,
        dailyQuota: settings.dailyQuota ?? 20,
      });
    }
  };

  // One-click suggestions for daily quota
  const applyIncreaseChunkSize = () => {
    if (remainingToday && remainingToday > 0 && pageRangeValidation.totalPagesSelected > 0) {
      const idealSize = Math.min(
        15,
        Math.max(3, Math.ceil(pageRangeValidation.totalPagesSelected / remainingToday))
      );
      onSettingsChange({
        ...settings,
        chunkSize: idealSize,
      });
    }
  };

  const applyNarrowPageRange = () => {
    if (remainingToday && remainingToday > 0) {
      const maxPages = remainingToday * settings.chunkSize;
      const range = `1-${Math.min(pageCount || 1, maxPages)}`;
      onSettingsChange({
        ...settings,
        pageRangeInput: range,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro hero card */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Tối ưu hóa đặc biệt cho Báo cáo thường niên (100–300+ trang)
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Chuyển đổi PDF Báo Cáo Thường Niên sang Word (.docx) Chuẩn Cấu Trúc
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Trích xuất chính xác 100% nội dung nguyên văn, bảng biểu tài chính nhiều cột, số liệu biểu đồ (gán nhãn '~' cho giá trị ước lượng), và sơ đồ tổ chức thành file Word và Markdown chuyên nghiệp cho RAG/LLM.
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Giữ nguyên cấu trúc bảng & gộp ô
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tự động ghép nối bảng ngắt trang
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Bộ điều tiết Rate Limiter an toàn
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Uploader (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
                : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept="application/pdf"
              className="hidden"
            />

            {isLoadingFile ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-slate-300">Đang phân tích cấu trúc PDF...</p>
              </div>
            ) : selectedFile ? (
              <div className="py-2 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <FileCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white break-all max-w-md mx-auto">
                    {selectedFile.name}
                  </h3>
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs text-slate-400">
                    <span className="bg-slate-800 px-2.5 py-1 rounded-md text-slate-200">
                      {formatFileSize(fileSizeBytes || selectedFile.size)}
                    </span>
                    {pageCount && (
                      <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-md font-medium border border-blue-500/30">
                        {pageCount} trang
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Nhấp hoặc kéo thả file PDF khác để thay đổi
                </p>
              </div>
            ) : (
              <div className="py-6 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shadow-md">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Kéo & thả tập tin PDF báo cáo vào đây
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Hỗ trợ tài liệu 100–300+ trang (Báo cáo thường niên, Báo cáo tài chính, Báo cáo ESG)
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-colors">
                    Chọn file PDF từ máy tính
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Error notice if file read failed */}
          {fileError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-200">Không thể tải tập tin PDF</p>
                <p className="mt-0.5">{fileError}</p>
              </div>
            </div>
          )}

          {/* Sample quick loader */}
          {!selectedFile && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    Muốn thử nghiệm ngay trước khi tải file lớn?
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tải mẫu Báo cáo thường niên giả định (có bảng biểu doanh thu & biểu đồ mẫu)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLoadSample}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Dùng file mẫu
              </button>
            </div>
          )}
        </div>

        {/* Right: Settings Panel (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Cấu hình trích xuất (Pipeline)</h3>
              </div>
              <span className="text-[11px] text-slate-400">Step 1</span>
            </div>

            {/* API Tier & Quota counter */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  Gói API & Bộ điều tiết (Rate Limiter)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {settings.maxRpm} RPM
                </span>
              </div>

              <select
                value={settings.apiTier}
                onChange={(e) => handleApiTierChange(e.target.value as ApiTier)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="free">Miễn phí (5 RPM / 20 RPD — mặc định 4 RPM an toàn)</option>
                <option value="paid">Trả phí (60 RPM — không giới hạn ngày)</option>
                <option value="custom">Tùy chỉnh (Tự đặt RPM & Hạn mức)</option>
              </select>

              {/* Custom Tier Settings */}
              {settings.apiTier === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Giới hạn RPM (1–120):</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.maxRpm}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, maxRpm: parseInt(e.target.value, 10) || 4 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Quota/ngày (hoặc để trống):</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Không giới hạn"
                      value={settings.dailyQuota ?? ''}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          dailyQuota: e.target.value ? parseInt(e.target.value, 10) : null,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Daily requests counter badge */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                <span className="flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
                  Đã dùng hôm nay (ước tính):
                </span>
                <span className="font-semibold text-slate-200 font-mono">
                  {usedToday} {dailyQuota !== null ? `/ ${dailyQuota} req` : 'req'}
                </span>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Mô hình Gemini (Model)</span>
                <span className="text-[11px] text-blue-400">Tự động tối ưu</span>
              </label>
              <select
                value={settings.model}
                onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                disabled={isProcessing}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.badge}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Range Selection Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Phạm vi trang (Page Range)
                </label>
                <span className="text-[11px] text-slate-400">
                  {settings.pageRangeInput.trim() ? 'Đã lọc trang' : 'Tất cả các trang'}
                </span>
              </div>
              <input
                type="text"
                placeholder={pageCount ? `VD: 1-20, 45-60, 90 (để trống: cả ${pageCount} trang)` : 'VD: 1-20, 45-60, 90'}
                value={settings.pageRangeInput}
                onChange={(e) =>
                  onSettingsChange({ ...settings, pageRangeInput: e.target.value })
                }
                disabled={isProcessing}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 ${
                  pageRangeValidation.isValid
                    ? 'border-slate-700 focus:ring-blue-500'
                    : 'border-rose-500/80 focus:ring-rose-500 text-rose-200'
                }`}
              />
              {!pageRangeValidation.isValid ? (
                <p className="mt-1 text-[11px] text-rose-400 leading-tight">
                  {pageRangeValidation.errorMessage}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  {pageCount
                    ? `Đang chọn ${pageRangeValidation.totalPagesSelected} / ${pageCount} trang.`
                    : 'Nhập dải trang cần xử lý để tiết kiệm quota.'}
                </p>
              )}
            </div>

            {/* Chunk Size Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Kích thước mỗi đoạn (Chunk Size)
                </label>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold font-mono">
                  {settings.chunkSize} trang / đoạn
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={settings.chunkSize}
                onChange={(e) =>
                  onSettingsChange({ ...settings, chunkSize: parseInt(e.target.value, 10) })
                }
                disabled={isProcessing}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>3 trang</span>
                <span>8 trang (chuẩn)</span>
                <span>15 trang (tiết kiệm req)</span>
              </div>
            </div>

            {/* Concurrency Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  Số luồng chạy đồng thời (Concurrency)
                </label>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-bold font-mono">
                  {settings.concurrency} luồng
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={settings.concurrency}
                onChange={(e) =>
                  onSettingsChange({ ...settings, concurrency: parseInt(e.target.value, 10) })
                }
                disabled={isProcessing}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span className="text-[10px] text-slate-400 italic">
                  *Rate Limiter ({settings.maxRpm} RPM) luôn có quyền ưu tiên tối thượng.
                </span>
              </div>
            </div>

            {/* Toggle: Page markers in Word */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-medium text-slate-200">
                    Ghi số trang vào file Word
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Chèn dòng đánh dấu nhỏ <span className="font-mono text-slate-300">— [Trang N] —</span>
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includePageMarkers}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, includePageMarkers: e.target.checked })
                  }
                  disabled={isProcessing}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-700 cursor-pointer"
                />
              </label>
            </div>

            {/* Daily Quota Exceeded Warning & 1-Click Suggestions */}
            {isOverDailyQuota && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-amber-300">
                      Cảnh báo: Ước tính vượt quá Quota còn lại hôm nay
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-200/90 leading-relaxed">
                      Sẽ cần ~<strong>{estimatedChunks} request</strong>, nhưng quota ngày chỉ còn{' '}
                      <strong>{remainingToday} request</strong> (đã dùng {usedToday}/{dailyQuota}).
                    </p>
                  </div>
                </div>

                <div className="pt-1 border-t border-amber-500/20 space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block">
                    Gợi ý giải pháp 1-Click:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {remainingToday && remainingToday > 0 && settings.chunkSize < 15 && (
                      <button
                        type="button"
                        onClick={applyIncreaseChunkSize}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] text-amber-200 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                          Tăng đoạn lên {Math.min(15, Math.max(3, Math.ceil(pageRangeValidation.totalPagesSelected / remainingToday)))} trang / đoạn
                        </span>
                        <span className="text-[10px] underline">Áp dụng</span>
                      </button>
                    )}

                    {remainingToday && remainingToday > 0 && (
                      <button
                        type="button"
                        onClick={applyNarrowPageRange}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] text-amber-200 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                          Thu hẹp phạm vi trang (chạy 1–{remainingToday * settings.chunkSize})
                        </span>
                        <span className="text-[10px] underline">Áp dụng</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plan Overview & Start Button */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              {pageCount && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>Ước tính phân đoạn:</span>
                  <span className="font-medium text-blue-300 font-mono">
                    Sẽ chia thành {estimatedChunks} đoạn ≈ {estimatedChunks} request ({pageRangeValidation.totalPagesSelected} trang)
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={onStartExtraction}
                disabled={
                  !selectedFile ||
                  isProcessing ||
                  !pageCount ||
                  !pageRangeValidation.isValid ||
                  pageRangeValidation.totalPagesSelected === 0
                }
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>
                  Bắt đầu trích xuất ({pageRangeValidation.totalPagesSelected || pageCount || 0} trang)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
