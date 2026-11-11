import React from 'react';
import {
  X,
  FileCheck2,
  Table,
  TrendingUp,
  AlertOctagon,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { ValidationReport } from '../types';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ValidationReport | null;
  onDownloadReportJson: () => void;
  onJumpToPage?: (pageNum: number) => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  report,
  onDownloadReportJson,
  onJumpToPage,
}) => {
  if (!isOpen || !report) return null;

  const coveragePercent =
    report.totalPages > 0
      ? Math.round((report.coveredPagesCount / report.totalPages) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Báo cáo kiểm tra & tính toàn vẹn dữ liệu
              </h3>
              <p className="text-xs text-slate-400">
                Đối chiếu số trang, cấu trúc bảng biểu và chỉ số ước lượng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="py-4 space-y-5 overflow-y-auto pr-1">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Độ phủ số trang</div>
              <div
                className={`text-lg font-bold font-mono ${
                  coveragePercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {report.coveredPagesCount}/{report.totalPages}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{coveragePercent}% trang gốc</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Bảng biểu tìm thấy</div>
              <div className="text-lg font-bold font-mono text-blue-400">
                {report.tableCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Bảng dữ liệu</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Số liệu ước lượng (~)</div>
              <div className="text-lg font-bold font-mono text-purple-400">
                {report.estimatedValuesCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Từ biểu đồ không nhãn</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Ô không có dữ liệu</div>
              <div className="text-lg font-bold font-mono text-amber-400">
                {report.naValuesCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Ký hiệu N/A chuẩn</div>
            </div>
          </div>

          {/* Page Coverage Status */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                {report.missingPages.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                Tình trạng bao phủ trang
              </span>
              <span className="text-slate-400 text-[11px]">
                {report.missingPages.length === 0
                  ? 'Bao phủ toàn bộ các trang'
                  : `Thiếu ${report.missingPages.length} trang`}
              </span>
            </div>

            {report.missingPages.length > 0 ? (
              <div className="text-xs text-amber-300/90 pt-1">
                Các trang chưa phát hiện marker: {report.missingPages.slice(0, 15).join(', ')}
                {report.missingPages.length > 15 ? '...' : ''}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Toàn bộ các trang từ 1 đến {report.totalPages} đều đã có marker truy vết{' '}
                <code className="text-blue-300">&lt;!-- page: N --&gt;</code> tương ứng.
              </p>
            )}
          </div>

          {/* Inconsistent Tables Section */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-200 flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-400" />
                Kiểm tra tính nhất quán cột của bảng
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  report.inconsistentTables.length === 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {report.inconsistentTables.length === 0
                  ? 'Tất cả bảng đều cân đối'
                  : `${report.inconsistentTables.length} bảng cần lưu ý`}
              </span>
            </div>

            {report.inconsistentTables.length === 0 ? (
              <p className="text-xs text-slate-400">
                Không phát hiện bảng nào bị lệch số lượng ô so với tiêu đề cột. Mọi hàng đều đồng bộ.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs text-slate-400">
                  Hệ thống DOCX Builder sẽ tự động bù ô trống (pad missing cells) để tài liệu Word không bao giờ bị lỗi mở file:
                </p>
                {report.inconsistentTables.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-slate-300 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-amber-300">
                        Bảng #{t.tableIndex} {t.pageNumber ? `(khoảng Trang ${t.pageNumber})` : ''}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Tiêu đề có {t.headerColumnCount} cột. Phát hiện {t.rowDiscrepancies.length} hàng có số ô khác biệt.
                      </div>
                    </div>
                    {t.pageNumber && onJumpToPage && (
                      <button
                        onClick={() => {
                          onJumpToPage(t.pageNumber!);
                          onClose();
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-medium shrink-0"
                      >
                        Đến trang {t.pageNumber}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart Estimates Rule Reminder */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-200">Quy tắc trích xuất số liệu biểu đồ</p>
              <p className="mt-0.5 text-slate-400 leading-relaxed">
                Biểu đồ có nhãn số được trích xuất chính xác 100%. Biểu đồ không có số được mô hình ước tính dựa trên hệ trục tọa độ và đánh dấu bằng tiền tố <code>~</code> để đảm bảo tính minh bạch cho phân tích tài chính và AI pipeline.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onDownloadReportJson}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Tải file JSON báo cáo (.json)</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
