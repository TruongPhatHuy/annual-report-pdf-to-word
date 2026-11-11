import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  FileText,
  FileCheck2,
  Save,
  Check,
  Eye,
  Edit3,
  Sparkles,
  Home,
  RefreshCw,
} from 'lucide-react';
import { renderPdfPage } from '../services/pdfRenderer';
import { ValidationReport } from '../types';

interface ReviewWorkspaceProps {
  pdfArrayBuffer: ArrayBuffer;
  totalPages: number;
  fileName: string;
  mergedMarkdown: string;
  pageMarkdownMap: Map<number, string>;
  onSavePageMarkdown: (pageNum: number, newMarkdown: string) => void;
  onSaveAllMarkdown: (newMarkdown: string) => void;
  onDownloadDocx: () => void;
  onDownloadMd: () => void;
  onOpenValidationModal: () => void;
  validationReport: ValidationReport | null;
  onReset: () => void;
  isBuildingDocx: boolean;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({
  pdfArrayBuffer,
  totalPages,
  fileName,
  mergedMarkdown,
  pageMarkdownMap,
  onSavePageMarkdown,
  onSaveAllMarkdown,
  onDownloadDocx,
  onDownloadMd,
  onOpenValidationModal,
  validationReport,
  onReset,
  isBuildingDocx,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.15);
  const [viewMode, setViewMode] = useState<'page' | 'all'>('page');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Current page markdown text
  const [pageText, setPageText] = useState<string>('');
  const [fullText, setFullText] = useState<string>(mergedMarkdown);
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest textarea values + the last text loaded from props.
  // Used to detect unsaved edits so an auto-refresh never overwrites them.
  const pageTextRef = useRef<string>('');
  const fullTextRef = useRef<string>(mergedMarkdown);
  pageTextRef.current = pageText;
  fullTextRef.current = fullText;
  const syncedPageRef = useRef<{ page: number; text: string }>({ page: 0, text: '' });
  const syncedFullRef = useRef<string>(mergedMarkdown);

  // Sync pageText when currentPage changes or pageMarkdownMap updates (keeps unsaved edits)
  useEffect(() => {
    const textForPage =
      pageMarkdownMap.get(currentPage) || `<!-- page: ${currentPage} -->\n\n(Không có nội dung trích xuất)`;
    const last = syncedPageRef.current;
    const pageChanged = last.page !== currentPage;
    const hasUnsavedEdit = !pageChanged && pageTextRef.current !== last.text;

    if (!hasUnsavedEdit) {
      setPageText(textForPage);
    }
    syncedPageRef.current = { page: currentPage, text: textForPage };
    if (pageChanged) setIsSavedNotice(false);
  }, [currentPage, pageMarkdownMap]);

  // Sync fullText when mergedMarkdown changes (keeps unsaved edits)
  useEffect(() => {
    const hasUnsavedEdit = fullTextRef.current !== syncedFullRef.current;
    if (!hasUnsavedEdit) {
      setFullText(mergedMarkdown);
    }
    syncedFullRef.current = mergedMarkdown;
  }, [mergedMarkdown]);

  // Render PDF page to canvas when currentPage or zoomScale changes
  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !pdfArrayBuffer || totalPages <= 0) return;

    setIsRenderingPdf(true);
    setRenderError(null);

    renderPdfPage(pdfArrayBuffer, currentPage, canvas, zoomScale)
      .then(() => {
        if (!isCancelled) {
          setIsRenderingPdf(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('PDF render error:', err);
          setRenderError(err.message || 'Không thể hiển thị trang PDF này.');
          setIsRenderingPdf(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPage, zoomScale, pdfArrayBuffer, totalPages]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    }
  };

  const handleSaveCurrentPage = () => {
    onSavePageMarkdown(currentPage, pageText);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  };

  const handleSaveFullDoc = () => {
    onSaveAllMarkdown(fullText);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.6, +(prev - 0.15).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomScale(1.15);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Main screen button / File title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition-colors"
            title="Về màn hình chính để chọn file khác (sẽ dừng xử lý nếu đang chạy)"
          >
            <Home className="w-4 h-4" />
            <span>Về màn hình chính</span>
          </button>
          <div>
            <h3 className="font-bold text-sm text-white line-clamp-1 max-w-xs sm:max-w-md">
              {fileName}
            </h3>
            <p className="text-xs text-slate-400">
              {totalPages} trang • Đã hoàn tất xử lý & ghép nối dữ liệu
            </p>
          </div>
        </div>

        {/* Right: Export & Validation Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {validationReport && (
            <button
              onClick={onOpenValidationModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span>Báo cáo kiểm tra</span>
            </button>
          )}

          <button
            onClick={onDownloadMd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Tải file .md</span>
          </button>

          <button
            onClick={onDownloadDocx}
            disabled={isBuildingDocx}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
          >
            {isBuildingDocx ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Tải file .docx (Word)</span>
          </button>
        </div>
      </div>

      {/* Split View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Pane: PDF Page Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[750px] overflow-hidden shadow-lg">
          {/* PDF Viewer Header */}
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Trang PDF gốc</span>
              <span className="text-[11px] text-slate-500">(Đối chiếu trực tiếp)</span>
            </span>

            {/* Navigation & Zoom controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 text-xs text-slate-300">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={handlePageInput}
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-mono">/ {totalPages}</span>
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="h-4 w-[1px] bg-slate-800 mx-1" />

              <button
                onClick={handleZoomOut}
                className="p-1 rounded-lg text-slate-300 hover:bg-slate-800"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:bg-slate-800"
                title="Khôi phục thu phóng"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded-lg text-slate-300 hover:bg-slate-800"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/50 relative">
            {isRenderingPdf && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-lg flex items-center gap-2.5 text-xs text-slate-200">
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                  <span>Đang dựng hình trang {currentPage}...</span>
                </div>
              </div>
            )}

            {renderError ? (
              <div className="text-center text-xs text-rose-400 p-6 max-w-sm">
                <p>{renderError}</p>
                <button
                  onClick={() => setCurrentPage(currentPage)}
                  className="mt-3 px-3 py-1.5 bg-slate-800 rounded-lg text-slate-200"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div className="shadow-2xl rounded border border-slate-700/60 bg-white">
                <canvas ref={canvasRef} className="block max-w-none" />
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Extracted Markdown Editor & Review */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[750px] overflow-hidden shadow-lg">
          {/* Header controls for Editor */}
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                {viewMode === 'page' ? `Markdown Trang ${currentPage}` : 'Toàn bộ tài liệu (Full)'}
              </span>
              {isSavedNotice && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Đã lưu!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle view mode: Current page vs Full */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex">
                <button
                  onClick={() => setViewMode('page')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'page'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Trang này
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tất cả ({totalPages} trang)
                </button>
              </div>

              {/* Save Button */}
              <button
                onClick={viewMode === 'page' ? handleSaveCurrentPage : handleSaveFullDoc}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                title="Lưu các chỉnh sửa vào tài liệu để xuất ra Word"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu sửa</span>
              </button>
            </div>
          </div>

          {/* Textarea Editor Area */}
          <div className="flex-1 p-3 bg-slate-950/60 overflow-hidden flex flex-col">
            <textarea
              value={viewMode === 'page' ? pageText : fullText}
              onChange={(e) => {
                if (viewMode === 'page') {
                  setPageText(e.target.value);
                } else {
                  setFullText(e.target.value);
                }
              }}
              spellCheck="false"
              className="w-full flex-1 bg-slate-950 text-slate-100 p-3 rounded-xl border border-slate-800/80 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs leading-relaxed resize-none overflow-auto"
              placeholder="Nội dung Markdown trích xuất..."
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>
                {viewMode === 'page'
                  ? `Đang chỉnh sửa nội dung thuộc marker <!-- page: ${currentPage} -->`
                  : 'Đang xem toàn văn bản đã ghép nối các trang'}
              </span>
              <span>
                {(viewMode === 'page' ? pageText : fullText).length.toLocaleString()} ký tự
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};