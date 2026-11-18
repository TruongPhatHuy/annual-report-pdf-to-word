import React from 'react';
import {
  Clock, Coins, Cpu, CheckCircle, AlertTriangle, Loader2, RefreshCw,
  XCircle, Layers, Play, Download, FileText, Hourglass, PauseCircle,
  CalendarClock, Eye,
} from 'lucide-react';
import { PdfChunk } from '../types';

interface ExtractionProgressProps {
  chunks: PdfChunk[];
  isProcessing: boolean;
  elapsedSeconds: number;
  onCancel: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
  onDownloadPartialDocx: () => void;
  onDownloadPartialMd: () => void;
  onViewPartialReview?: () => void;
  model: string;
  dailyQuotaBanner: string | null;
  queuePausedCountdown: number;
  queuePausedReason: string;
  requestsUsedToday: number;
  dailyQuotaLimit: number | null;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  chunks, isProcessing, elapsedSeconds, onCancel, onResume, onRetryFailed,
  onDownloadPartialDocx, onDownloadPartialMd, onViewPartialReview,
  model, dailyQuotaBanner, queuePausedCountdown, queuePausedReason,
  requestsUsedToday, dailyQuotaLimit,
}) => {
  const totalChunks = chunks.length;
  const doneChunks = chunks.filter((c) => c.status === 'done').length;
  const failedChunks = chunks.filter((c) => c.status === 'failed').length;
  const runningChunks = chunks.filter((c) => c.status === 'running').length;
  const waitingRateLimitChunks = chunks.filter((c) => c.status === 'waiting-for-rate-limit').length;
  const pausedChunks = chunks.filter((c) => c.status === 'paused').length;
  const percentage = totalChunks > 0 ? Math.round((doneChunks / totalChunks) * 100) : 0;
  const hasRemainingChunks = chunks.some((c) => c.status !== 'done');

  let totalInputTokens = 0, totalOutputTokens = 0;
  chunks.forEach((c) => {
    if (c.tokens) { totalInputTokens += c.tokens.promptTokens || 0; totalOutputTokens += c.tokens.candidatesTokens || 0; }
  });
  const isPro = model.includes('pro') || model.includes('argon');
  const estimatedCost = totalInputTokens * (isPro ? 1.25 : 0.15) / 1_000_000 + totalOutputTokens * (isPro ? 5.0 : 0.6) / 1_000_000;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60), s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const statusColor = (status: PdfChunk['status']) => {
    switch (status) {
      case 'done': return 'border-zinc-700 bg-zinc-900/80 text-zinc-300';
      case 'running': return 'border-blue-700/60 bg-blue-950/30 text-blue-200';
      case 'waiting-for-rate-limit': return 'border-amber-700/40 bg-amber-950/20 text-amber-200';
      case 'paused': return 'border-zinc-700 bg-zinc-900 text-zinc-400';
      case 'failed': return 'border-red-800/50 bg-red-950/20 text-red-300';
      case 'split': return 'border-indigo-700/40 bg-indigo-950/20 text-indigo-300';
      default: return 'border-zinc-800 bg-zinc-900/50 text-zinc-500';
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
      {/* Daily Quota Banner */}
      {dailyQuotaBanner && (
        <div className="p-3 rounded-md bg-zinc-900 border border-amber-700/40 text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <h4 className="font-semibold text-amber-200">Đã hết hạn mức request trong ngày (Daily Quota)</h4>
            <p className="text-amber-400/80 leading-relaxed">{dailyQuotaBanner}</p>
            <p className="text-[11px] text-amber-500/70 pt-0.5">
              *Quota miễn phí reset lúc 00:00 PT. Hoặc chuyển sang API Key có Billing.
            </p>
          </div>
        </div>
      )}

      {/* Rate Limit Countdown */}
      {queuePausedCountdown > 0 && !dailyQuotaBanner && (
        <div className="p-2.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Hourglass className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
            <span>
              Tạm dừng: <span className="text-zinc-300">{queuePausedReason}</span> — tự tiếp tục sau{' '}
              <span className="font-mono text-white">{queuePausedCountdown}s</span>
            </span>
          </div>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">(Không tính vào retry)</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-blue-500 animate-ping' : 'bg-zinc-600'}`} />
            <h3 className="font-medium text-sm text-zinc-100">
              {isProcessing ? 'Đang trích xuất (Rate-Limiter Active)...'
                : pausedChunks > 0 ? 'Tiến trình đang tạm dừng'
                : 'Tiến trình trích xuất'}
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Phân tích PDF, nhận diện bảng biểu bằng <span className="font-mono text-zinc-400">{model}</span>
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 self-end sm:self-center">
          {!isProcessing && hasRemainingChunks && (
            <button onClick={onResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              <Play className="w-3.5 h-3.5 fill-current" /> Tiếp tục
            </button>
          )}
          {failedChunks > 0 && !isProcessing && (
            <button onClick={onRetryFailed}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Thử lại ({failedChunks} lỗi)
            </button>
          )}
          {isProcessing && (
            <button onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Dừng
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            Hoàn thành: <span className="text-zinc-100 font-mono">{doneChunks}/{totalChunks}</span> đoạn ({percentage}%)
          </span>
          <span className="text-zinc-600">
            {isProcessing
              ? runningChunks > 0 ? `${runningChunks} chạy · ${waitingRateLimitChunks} chờ` : 'Chuẩn bị...'
              : 'Đã tạm dừng'}
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: <Clock className="w-3.5 h-3.5" />, label: 'Thời gian', value: formatTime(elapsedSeconds), mono: true },
          { icon: <CalendarClock className="w-3.5 h-3.5" />, label: 'Req hôm nay', value: `${requestsUsedToday}${dailyQuotaLimit ? `/${dailyQuotaLimit}` : ''}`, mono: true },
          { icon: <Coins className="w-3.5 h-3.5" />, label: 'Chi phí ~', value: `$${estimatedCost.toFixed(4)}`, mono: true },
          { icon: <Layers className="w-3.5 h-3.5" />, label: 'Trạng thái', value: `${doneChunks}✓ ${runningChunks}▶ ${failedChunks}✗`, mono: false },
        ].map((m, i) => (
          <div key={i} className="bg-zinc-800/60 border border-zinc-800 rounded-md p-2.5 flex items-center gap-2.5">
            <div className="text-zinc-500 shrink-0">{m.icon}</div>
            <div>
              <div className="text-[10px] text-zinc-500">{m.label}</div>
              <div className={`text-xs font-semibold text-zinc-100 ${m.mono ? 'font-mono' : ''}`}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Partial Download Toolbar */}
      {doneChunks > 0 && (
        <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span><strong className="text-zinc-200">{doneChunks} đoạn</strong> đã xong — tải ngay không cần đợi:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onViewPartialReview && (
              <button type="button" onClick={onViewPartialReview}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-900 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors">
                <Eye className="w-3 h-3 text-zinc-500" /> Xem ({doneChunks})
              </button>
            )}
            <button type="button" onClick={onDownloadPartialMd}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-900 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors">
              <FileText className="w-3 h-3" /> .md
            </button>
            <button type="button" onClick={onDownloadPartialDocx}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              <Download className="w-3 h-3" /> .docx
            </button>
          </div>
        </div>
      )}

      {/* Chunk Grid */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Chi tiết phân đoạn</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
          {chunks.map((chunk) => {
            const { status } = chunk;
            const isDone = status === 'done';
            const isRunning = status === 'running';
            const isWRL = status === 'waiting-for-rate-limit';
            const isFailed = status === 'failed';
            const isPaused = status === 'paused';
            const isSplit = status === 'split';
            return (
              <div key={chunk.id} className={`p-2.5 rounded-md border text-xs transition-colors ${statusColor(status)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] text-zinc-300">p.{chunk.startPage}–{chunk.endPage}</span>
                  <div>
                    {isDone && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    {isRunning && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                    {isWRL && <Hourglass className="w-3.5 h-3.5 text-amber-500" />}
                    {isPaused && <PauseCircle className="w-3.5 h-3.5 text-zinc-500" />}
                    {isFailed && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    {isSplit && <span className="text-[9px] text-indigo-400 font-mono">split</span>}
                    {status === 'pending' && <span className="text-[9px] text-zinc-600 font-mono">wait</span>}
                  </div>
                </div>
                <div className="text-[10px]">
                  {isDone && <span className="text-emerald-500">Done{chunk.tokens?.totalTokens ? ` · ${(chunk.tokens.totalTokens / 1000).toFixed(1)}k tok` : ''}</span>}
                  {isRunning && <span className="text-blue-400">Running{chunk.attempts > 1 ? ` #${chunk.attempts}` : ''}...</span>}
                  {isWRL && <span className="text-amber-400">~{chunk.waitingSecondsRemaining || 1}s</span>}
                  {isPaused && <span className="text-zinc-500">Paused</span>}
                  {isFailed && <span className="text-red-400 line-clamp-1" title={chunk.error}>{chunk.error || 'Error'}</span>}
                  {isSplit && <span className="text-indigo-400">Auto-split</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};