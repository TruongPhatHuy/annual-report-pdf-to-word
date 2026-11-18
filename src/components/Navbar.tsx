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
    <header className="sticky top-0 z-30 bg-zinc-900 border-b border-zinc-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-300">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm tracking-tight text-zinc-100">
              Annual Report PDF → Word
            </h1>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded">
              AI/RAG
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Daily Request Badge */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 font-mono"
            title="Số request đã thực hiện hôm nay (ước tính theo múi giờ Pacific Time)"
          >
            <CalendarClock className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-500">req:</span>
            <span className="text-zinc-200">
              {requestsUsedToday}
              {dailyQuotaLimit != null ? `/${dailyQuotaLimit}` : ''}
            </span>
          </div>

          {/* Model Selector */}
          <div className="relative hidden md:flex items-center">
            <Cpu className="w-3.5 h-3.5 text-zinc-500 absolute left-2 pointer-events-none" />
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={isProcessing}
              className="bg-zinc-900 text-zinc-300 text-xs rounded border border-zinc-800 hover:border-zinc-700 pl-7 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40 appearance-none cursor-pointer"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>

          {/* API Key Button */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
              hasEnvKey || customApiKey
                ? 'bg-zinc-900 text-emerald-400 border-zinc-800 hover:border-zinc-700'
                : 'bg-zinc-900 text-amber-400 border-zinc-800 hover:border-zinc-700'
            }`}
            title="Quản lý Gemini API Key"
          >
            {hasEnvKey || customApiKey ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {hasEnvKey ? 'Env Key' : 'Key: OK'}
                </span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5" />
                <span>Nhập API Key</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-zinc-950 border-t border-zinc-800/60 px-4 py-1">
        <p className="text-[10px] text-zinc-600 inline-flex items-center gap-1.5">
          <Info className="w-3 h-3 text-zinc-700 inline-block" />
          <span>File PDF được gửi tới Gemini API để xử lý. Dữ liệu không lưu ngoài phiên làm việc.</span>
        </p>
      </div>
    </header>
  );
};