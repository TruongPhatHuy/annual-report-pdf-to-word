import React from 'react';
import {
  Clock,
  Coins,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  XCircle,
  Layers,
  Sparkles,
  Play,
  Download,
  FileText,
  Hourglass,
  PauseCircle,
  CalendarClock,
  Eye,
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
  chunks,
  isProcessing,
  elapsedSeconds,
  onCancel,
  onResume,
  onRetryFailed,
  onDownloadPartialDocx,
  onDownloadPartialMd,
  onViewPartialReview,
  model,
  dailyQuotaBanner,
  queuePausedCountdown,
  queuePausedReason,
  requestsUsedToday,
  dailyQuotaLimit,
}) => {
  const totalChunks = chunks.length;
  const doneChunks = chunks.filter((c) => c.status === 'done').length;
  const failedChunks = chunks.filter((c) => c.status === 'failed').length;
  const runningChunks = chunks.filter((c) => c.status === 'running').length;
  const waitingRateLimitChunks = chunks.filter((c) => c.status === 'waiting-for-rate-limit').length;
  const pausedChunks = chunks.filter((c) => c.status === 'paused').length;

  const percentage = totalChunks > 0 ? Math.round((doneChunks / totalChunks) * 100) : 0;
  const hasRemainingChunks = chunks.some((c) => c.status !== 'done');

  // Aggregate tokens
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  chunks.forEach((c) => {
    if (c.tokens) {
      totalInputTokens += c.tokens.promptTokens || 0;
      totalOutputTokens += c.tokens.candidatesTokens || 0;
    }
  });
  const totalTokens = totalInputTokens + totalOutputTokens;

  // Rough cost estimate
  const isPro = model.includes('pro') || model.includes('argon');
  const inputRate = isPro ? 1.25 / 1_000_000 : 0.15 / 1_000_000;
  const outputRate = isPro ? 5.0 / 1_000_000 : 0.6 / 1_000_000;
  const estimatedCost = totalInputTokens * inputRate + totalOutputTokens * outputRate;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
      {/* Daily Quota Exhausted Banner */}
      {dailyQuotaBanner && (
        <div className="p-4 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-sm text-amber-300">
              Đã hết hạn mức request trong ngày (Daily Quota)
            </h4>
            <p className="leading-relaxed text-amber-200/90">
              {dailyQuotaBanner}
            </p>
            <p className="text-[11px] text-amber-300/80 pt-1">
              *Hạn mức miễn phí của Google sẽ tự động đặt lại vào lúc 00:00 giờ Thái Bình Dương (PT). Bạn cũng có thể chuyển sang API Key có bật Billing trong phần Cấu hình Key.
            </p>
          </div>
        </div>
      )}

      {/* Queue Paused (RPM) Countdown Banner */}
      {queuePausedCountdown > 0 && !dailyQuotaBanner && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5 text-xs">
            <Hourglass className="w-4 h-4 text-blue-400 animate-spin" />
            <span>
              <strong>Tạm dừng hàng đợi:</strong> {queuePausedReason} — Sẽ tự động tiếp tục sau{' '}
              <strong className="font-mono text-white text-sm">{queuePausedCountdown}s</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            (Không tính vào lần thử lại của đoạn)
          </span>
        </div>
      )}

      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isProcessing ? 'bg-blue-500 animate-ping' : 'bg-slate-500'
              }`}
            />
            <h3 className="font-semibold text-base text-white">
              {isProcessing
                ? 'Đang trích xuất dữ liệu (Rate-Limiter Active)...'
                : pausedChunks > 0
                ? 'Tiến trình đang tạm dừng'
                : 'Tiến trình trích xuất tài liệu'}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đang phân tích các trang PDF, nhận diện bảng biểu và trích xuất nguyên văn bằng {model}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 self-end sm:self-center">
          {/* Resume Button when stopped with remaining chunks */}
          {!isProcessing && hasRemainingChunks && (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tiếp tục trích xuất</span>
            </button>
          )}

          {failedChunks > 0 && !isProcessing && (
            <button
              onClick={onRetryFailed}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại các đoạn lỗi ({failedChunks})</span>
            </button>
          )}

          {isProcessing && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Dừng xử lý</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-medium">
            Tiến độ hoàn tất: <strong className="text-blue-400">{doneChunks}</strong> / {totalChunks} đoạn ({percentage}%)
          </span>
          <span className="text-slate-400">
            {isProcessing
              ? runningChunks > 0
                ? `${runningChunks} đoạn đang chạy, ${waitingRateLimitChunks} đoạn chờ nhịp gọi API`
                : 'Đang chuẩn bị...'
              : 'Đã tạm dừng'}
          </span>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-300 shadow-sm"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Thời gian chạy</div>
            <div className="text-sm font-bold text-white font-mono">{formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Request hôm nay</div>
            <div className="text-sm font-bold text-slate-100 font-mono">
              {requestsUsedToday} {dailyQuotaLimit ? `/ ${dailyQuotaLimit}` : ''}
              <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">(ước tính)</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Chi phí ước tính</div>
            <div className="text-sm font-bold text-emerald-300 font-mono">
              ~${estimatedCost.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Trạng thái đoạn</div>
            <div className="text-xs font-semibold text-slate-300">
              {doneChunks} xong, {runningChunks} chạy, {failedChunks} lỗi
              {pausedChunks > 0 && `, ${pausedChunks} tạm dừng`}
            </div>
          </div>
        </div>
      </div>

      {/* Partial Download Toolbar (Always available when at least 1 chunk is done) */}
      {doneChunks > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>
              Đã trích xuất xong <strong>{doneChunks} đoạn</strong>. Bạn có thể tải ngay kết quả từng phần mà không cần đợi toàn bộ:
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onViewPartialReview && (
              <button
                type="button"
                onClick={onViewPartialReview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Xem đối chiếu ({doneChunks} đoạn)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onDownloadPartialMd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-300" />
              <span>Tải .md phần đã xong</span>
            </button>

            <button
              type="button"
              onClick={onDownloadPartialDocx}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Word (.docx) phần đã xong</span>
            </button>
          </div>
        </div>
      )}

      {/* Chunks Card Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Chi tiết từng phân đoạn PDF
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
          {chunks.map((chunk) => {
            const isDone = chunk.status === 'done';
            const isRunning = chunk.status === 'running';
            const isWaitingRateLimit = chunk.status === 'waiting-for-rate-limit';
            const isFailed = chunk.status === 'failed';
            const isPaused = chunk.status === 'paused';
            const isSplit = chunk.status === 'split';

            return (
              <div
                key={chunk.id}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  isDone
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-300'
                    : isRunning
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-100 shadow-md ring-1 ring-blue-500/30'
                    : isWaitingRateLimit
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : isPaused
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                    : isFailed
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : isSplit
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200">
                    Trang {chunk.startPage}–{chunk.endPage}
                  </span>
                  <div>
                    {isDone && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {isRunning && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {isWaitingRateLimit && <Hourglass className="w-4 h-4 text-amber-400 animate-pulse" />}
                    {isPaused && <PauseCircle className="w-4 h-4 text-purple-400" />}
                    {isFailed && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    {isSplit && <Sparkles className="w-4 h-4 text-indigo-400" />}
                    {chunk.status === 'pending' && (
                      <span className="text-[10px] text-slate-500 font-mono">Chờ</span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] space-y-0.5">
                  {isDone && (
                    <>
                      <div className="text-emerald-400 font-medium">Hoàn thành</div>
                      {chunk.tokens?.totalTokens && (
                        <div className="text-slate-400 text-[10px]">
                          {chunk.tokens.totalTokens.toLocaleString()} tokens (
                          {((chunk.durationMs || 0) / 1000).toFixed(1)}s)
                        </div>
                      )}
                    </>
                  )}
                  {isRunning && (
                    <div className="text-blue-300 font-medium animate-pulse">
                      Đang xử lý {chunk.attempts > 1 ? `(lần ${chunk.attempts})` : ''}...
                    </div>
                  )}
                  {isWaitingRateLimit && (
                    <div className="text-amber-300 font-medium animate-pulse">
                      Chờ lượt gọi API (còn ~{chunk.waitingSecondsRemaining || 1}s)
                    </div>
                  )}
                  {isPaused && (
                    <div className="text-purple-300 font-medium">
                      Tạm dừng (hết quota ngày)
                    </div>
                  )}
                  {isFailed && (
                    <div className="text-rose-400 text-[10px] leading-tight line-clamp-2" title={chunk.error}>
                      {chunk.error || 'Lỗi xử lý'} (đã thử {chunk.attempts} lần)
                    </div>
                  )}
                  {isSplit && (
                    <div className="text-indigo-300 text-[10px]">
                      Tự động chia đôi do chạm giới hạn token
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
