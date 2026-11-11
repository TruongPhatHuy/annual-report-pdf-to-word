import React, { useState } from 'react';
import { Key, Eye, EyeOff, ShieldAlert, Check, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasEnvKey: boolean;
  currentCustomKey: string;
  onSaveCustomKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  hasEnvKey,
  currentCustomKey,
  onSaveCustomKey,
}) => {
  const [inputValue, setInputValue] = useState(currentCustomKey);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveCustomKey(inputValue.trim());
    onClose();
  };

  const handleClear = () => {
    setInputValue('');
    onSaveCustomKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Cấu hình Gemini API Key</h3>
            <p className="text-xs text-slate-400">Khóa kết nối với Google Gemini API</p>
          </div>
        </div>

        {hasEnvKey ? (
          <div className="p-3.5 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-200">Đã phát hiện API Key trong môi trường hệ thống</p>
              <p className="mt-1 text-slate-400">
                Ứng dụng tự động sử dụng khóa được cấu hình qua AI Studio Secrets. Bạn không bắt buộc phải nhập khóa thủ công trừ khi muốn dùng khóa riêng.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200">Chưa phát hiện API Key môi trường</p>
              <p className="mt-1 text-slate-400">
                Vui lòng dán khóa Gemini API Key của bạn dưới đây. Khóa này chỉ được lưu trong bộ nhớ RAM tạm thời và không bao giờ được lưu vào bộ nhớ lâu dài hay nhật ký.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Khóa API Key (Google AI Studio)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Chỉ lưu trong phiên hiện tại (in-memory only). Bạn có thể lấy khóa tại{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                aistudio.google.com
              </a>
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            {currentCustomKey && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
              >
                Xóa khóa tùy chỉnh
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/20 transition-colors"
            >
              Lưu áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
