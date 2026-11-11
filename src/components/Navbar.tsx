import React from 'react';
import { FileText, Key, ShieldCheck, Cpu, Info, CalendarClock } from 'lucide-react';
import { AVAILABLE_MODELS } from '../types';

interface NavbarProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  hasEnvKey: boolean;
  customApiKey: string;
  onOpenApiKeyModal: () => void;
  isProcessing: boolean;
  requestsUsedToday?: number;
  dailyQuotaLimit?: number | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedModel,
  onModelChange,
  hasEnvKey,
  customApiKey,
  onOpenApiKeyModal,
  isProcessing,
  requestsUsedToday = 0,
  dailyQuotaLimit,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                Annual Report PDF → Word
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                AI/RAG Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Trích xuất Báo cáo thường niên chuẩn Markdown & DOCX
            </p>
          </div>
        </div>

        {/* Right Controls: Daily quota badge, Model selector & Key status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Daily Request Badge */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300"
            title="Số request đã thực hiện hôm nay (ước tính theo múi giờ Pacific Time, reset lúc 00:00 PT)"
          >
            <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hôm nay:</span>
            <span className="font-bold font-mono text-slate-100">
              {requestsUsedToday}
              {dailyQuotaLimit !== null && dailyQuotaLimit !== undefined ? `/${dailyQuotaLimit}` : ''}
            </span>
          </div>

          {/* Model Selector Dropdown */}
          <div className="relative hidden md:flex items-center">
            <Cpu className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={isProcessing}
              className="bg-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-8 py-2 border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 appearance-none cursor-pointer"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>

          {/* API Key Status / Button */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              hasEnvKey || customApiKey
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="Quản lý Gemini API Key"
          >
            {hasEnvKey || customApiKey ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">
                  {hasEnvKey ? 'API Key: Môi trường' : 'API Key: Đã nhập'}
                </span>
                <span className="sm:hidden">Key: OK</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4 text-amber-400" />
                <span>Nhập API Key</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-slate-950/70 border-t border-slate-800/60 px-4 py-1 text-center">
        <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400 inline-block" />
          <span>File PDF được gửi tới Gemini API để xử lý. Dữ liệu xử lý an toàn và không bị lưu trữ ngoài phiên làm việc.</span>
        </p>
      </div>
    </header>
  );
};
