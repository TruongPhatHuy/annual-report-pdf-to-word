import React from 'react';
import { X, FileCheck2, Table, AlertOctagon, Download, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ValidationReport } from '../types';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ValidationReport | null;
  onDownloadReportJson: () => void;
  onJumpToPage?: (pageNum: number) => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen, onClose, report, onDownloadReportJson, onJumpToPage,
}) => {
  if (!isOpen || !report) return null;
  const coveragePercent = report.totalPages > 0
    ? Math.round((report.coveredPagesCount / report.totalPages) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl p-5 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Báo cáo kiểm tra & tính toàn vẹn</h3>
              <p className="text-[11px] text-zinc-500">Đối chiếu số trang, bảng biểu, chỉ số ước lượng</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Độ phủ trang', value: `${report.coveredPagesCount}/${report.totalPages}`, sub: `${coveragePercent}%`, color: coveragePercent === 100 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Bảng biểu', value: String(report.tableCount), sub: 'bảng', color: 'text-blue-400' },
              { label: 'Số ước lượng (~)', value: String(report.estimatedValuesCount), sub: 'từ biểu đồ', color: 'text-purple-400' },
              { label: 'Ô N/A', value: String(report.naValuesCount), sub: 'ký hiệu N/A', color: 'text-amber-400' },
            ].map((kpi, i) => (
              <div key={i} className="bg-zinc-800/60 border border-zinc-800 rounded-md p-3 text-center">
                <div className="text-[10px] text-zinc-500 mb-1">{kpi.label}</div>
                <div className={`text-lg font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Page Coverage */}
          <div className="p-3.5 rounded-md bg-zinc-800/40 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                {report.missingPages.length === 0
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                Tình trạng bao phủ trang
              </span>
              <span className="text-zinc-500 text-[11px]">
                {report.missingPages.length === 0 ? 'Toàn bộ' : `Thiếu ${report.missingPages.length} trang`}
              </span>
            </div>
            {report.missingPages.length > 0 ? (
              <div className="text-xs text-amber-400/80">
                Trang chưa có marker: {report.missingPages.slice(0, 15).join(', ')}{report.missingPages.length > 15 ? '...' : ''}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Tất cả trang 1–{report.totalPages} đều có marker <code className="text-zinc-400">&lt;!-- page: N --&gt;</code>.
              </p>
            )}
          </div>

          {/* Table Consistency */}
          <div className="p-3.5 rounded-md bg-zinc-800/40 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-zinc-200 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-zinc-500" />
                Nhất quán cột bảng
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                report.inconsistentTables.length === 0
                  ? 'bg-zinc-800 text-emerald-400 border-zinc-700'
                  : 'bg-zinc-800 text-amber-400 border-zinc-700'
              }`}>
                {report.inconsistentTables.length === 0 ? 'OK' : `${report.inconsistentTables.length} bảng`}
              </span>
            </div>
            {report.inconsistentTables.length === 0 ? (
              <p className="text-xs text-zinc-500">Không phát hiện bảng lệch cột. Mọi hàng đồng bộ.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-xs text-zinc-500">DOCX Builder sẽ tự bù ô trống (pad missing cells):</p>
                {report.inconsistentTables.map((t, idx) => (
                  <div key={idx} className="p-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-amber-400">Bảng #{t.tableIndex} {t.pageNumber ? `(~Trang ${t.pageNumber})` : ''}</div>
                      <div className="text-[11px] text-zinc-500">{t.headerColumnCount} cột · {t.rowDiscrepancies.length} hàng lệch</div>
                    </div>
                    {t.pageNumber && onJumpToPage && (
                      <button onClick={() => { onJumpToPage(t.pageNumber!); onClose(); }}
                        className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-[10px] border border-zinc-700 shrink-0">
                        Đến trang {t.pageNumber}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart Rule */}
          <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-zinc-300">Quy tắc trích xuất biểu đồ</p>
              <p className="mt-0.5 text-zinc-500 leading-relaxed">
                Biểu đồ có nhãn số → trích xuất chính xác. Biểu đồ không số → ước tính theo trục và đánh dấu <code>~</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 shrink-0">
          <button onClick={onDownloadReportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors">
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            Tải JSON báo cáo
          </button>
          <button onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};