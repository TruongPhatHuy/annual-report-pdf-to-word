import { SYSTEM_PROMPT } from '../systemPrompt';
import { ChunkTokens, PdfChunk } from '../types';
import { extractPagesAsPdfBase64 } from './pdfSplitter';
import { incrementRequestsUsedToday } from './storage';
import { PDFDocument } from 'pdf-lib';

export interface ExtractionRequestOptions {
  model: string;
  customApiKey?: string;
  signal?: AbortSignal;
  maxRpm?: number;
}

export interface ChunkResult {
  chunkId: string;
  markdown: string;
  finishReason?: string;
  tokens?: ChunkTokens;
  durationMs: number;
  isTruncated: boolean;
}

export class DailyQuotaExhaustedError extends Error {
  constructor(message = 'Đã hết hạn mức request trong ngày.') {
    super(message);
    this.name = 'DailyQuotaExhaustedError';
  }
}

/**
 * 429 Classification Result
 */
export interface Classified429 {
  type: 'daily' | 'per_minute' | 'unclear';
  retryDelaySeconds: number;
  message: string;
}

/**
 * Classifies HTTP 429 error into daily quota, per-minute rate limit, or unclear
 */
export function classify429Error(
  message: string,
  details?: string,
  rawError?: any
): Classified429 {
  const combined = `${message} ${details || ''} ${JSON.stringify(rawError || '')}`.toLowerCase();

  // 1. Daily Quota detection:
  // e.g. "per day", "PerDay", "RequestsPerDay", "daily", "metric: generaterequestperday"
  const isDaily =
    combined.includes('per day') ||
    combined.includes('perday') ||
    combined.includes('requestsperday') ||
    combined.includes('generaterequestperday') ||
    combined.includes('daily') ||
    combined.includes('day limit') ||
    combined.includes('quota exceeded for metric: generate_content_requests_per_day');

  if (isDaily) {
    return {
      type: 'daily',
      retryDelaySeconds: 0,
      message: 'Hết hạn mức số lượng yêu cầu trong ngày (Daily Quota).',
    };
  }

  // 2. Extract retryDelay if provided by Gemini API
  let retryDelay = 60;
  const retryMatch = /retry after (\d+(\.\d+)?)s/i.exec(combined);
  if (retryMatch) {
    retryDelay = Math.max(5, Math.ceil(parseFloat(retryMatch[1])));
  } else if (rawError?.retryDelay) {
    retryDelay = Math.max(5, Math.ceil(rawError.retryDelay));
  }

  // 3. Per-minute / RPM / TPM detection
  const isPerMinute =
    combined.includes('per minute') ||
    combined.includes('perminute') ||
    combined.includes('requestsperminute') ||
    combined.includes('generaterequestperminute') ||
    combined.includes('rpm') ||
    combined.includes('tpm') ||
    combined.includes('tokens per minute') ||
    combined.includes('rate limit') ||
    combined.includes('resource_exhausted') ||
    retryMatch !== null;

  if (isPerMinute) {
    return {
      type: 'per_minute',
      retryDelaySeconds: retryDelay,
      message: `Tạm chạm giới hạn tần suất phút (${retryDelay}s). Toàn bộ hàng đợi sẽ tạm nghỉ.`,
    };
  }

  return {
    type: 'unclear',
    retryDelaySeconds: 60,
    message: 'Lỗi 429 chưa rõ nguyên nhân. Sẽ thử lại một lần sau 60 giây.',
  };
}

/**
 * Global Sliding Window Rate Limiter
 * Ensures no more than N requests are fired per 60 seconds across all concurrent workers.
 * Also supports queue-wide pausing (e.g. on 429 RPM pause).
 */
export class GlobalRateLimiter {
  private timestamps: number[] = [];
  private maxRpm: number = 4; // default safety for free-tier (5 RPM max)
  private queuePausedUntil: number = 0;
  private queuePauseReason: string = '';
  private mutexChain: Promise<any> = Promise.resolve();
  private pauseListeners: Set<(isPaused: boolean, secondsRemaining: number, reason: string) => void> = new Set();

  constructor(initialMaxRpm = 4) {
    this.maxRpm = Math.max(1, initialMaxRpm);
  }

  public setMaxRpm(rpm: number) {
    this.maxRpm = Math.max(1, rpm);
  }

  public getMaxRpm(): number {
    return this.maxRpm;
  }

  public onPauseChange(cb: (isPaused: boolean, secondsRemaining: number, reason: string) => void): () => void {
    this.pauseListeners.add(cb);
    return () => this.pauseListeners.delete(cb);
  }

  private notifyPause(isPaused: boolean, secondsRemaining: number, reason: string) {
    this.pauseListeners.forEach((cb) => cb(isPaused, secondsRemaining, reason));
  }

  public pauseQueue(seconds: number, reason: string) {
    const until = Date.now() + seconds * 1000;
    if (until > this.queuePausedUntil) {
      this.queuePausedUntil = until;
      this.queuePauseReason = reason;
      this.notifyPause(true, seconds, reason);
    }
  }

  public isQueuePaused(): boolean {
    return Date.now() < this.queuePausedUntil;
  }

  public getQueuePauseRemainingSeconds(): number {
    const diff = this.queuePausedUntil - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  public getQueuePauseReason(): string {
    return this.queuePauseReason;
  }

  public reset() {
    this.timestamps = [];
    this.queuePausedUntil = 0;
    this.queuePauseReason = '';
    this.notifyPause(false, 0, '');
  }

  /**
   * Acquire permission to fire an API request.
   * If rate limit or queue pause is active, waits and calls onWaiting with remaining seconds.
   */
  public async acquireToken(
    signal?: AbortSignal,
    onWaiting?: (secondsRemaining: number, reason: string) => void
  ): Promise<void> {
    // Acquire sequential lock to prevent race condition across concurrent promises
    return new Promise<void>((resolve, reject) => {
      this.mutexChain = this.mutexChain.then(async () => {
        if (signal?.aborted) {
          reject(new DOMException('Thao tác đã bị hủy.', 'AbortError'));
          return;
        }

        while (true) {
          if (signal?.aborted) {
            reject(new DOMException('Thao tác đã bị hủy.', 'AbortError'));
            return;
          }

          const now = Date.now();

          // 1. Check if queue is paused globally (e.g. 429 RPM pause)
          if (now < this.queuePausedUntil) {
            const waitMs = this.queuePausedUntil - now;
            const remainingSec = Math.ceil(waitMs / 1000);
            onWaiting?.(remainingSec, this.queuePauseReason || 'Hàng đợi tạm dừng');
            this.notifyPause(true, remainingSec, this.queuePauseReason);

            const sleepChunk = Math.min(waitMs, 1000);
            await this.sleepWithAbort(sleepChunk, signal);
            continue;
          } else if (this.queuePausedUntil > 0 && now >= this.queuePausedUntil) {
            this.queuePausedUntil = 0;
            this.queuePauseReason = '';
            this.notifyPause(false, 0, '');
          }

          // 2. Sliding window check: prune timestamps older than 60s
          const windowStart = now - 60_000;
          this.timestamps = this.timestamps.filter((t) => t > windowStart);

          // 3. If under limit, grant token immediately!
          if (this.timestamps.length < this.maxRpm) {
            this.timestamps.push(now);
            // Record usage in daily request tracker
            incrementRequestsUsedToday(1);
            resolve();
            return;
          }

          // 4. Over limit: calculate wait time until oldest timestamp leaves the 60s window
          const oldest = this.timestamps[0];
          const waitMs = oldest + 60_000 - now + 80; // slight margin
          const remainingSec = Math.max(1, Math.ceil(waitMs / 1000));

          onWaiting?.(remainingSec, `Chờ lượt gọi API (còn ~${remainingSec} giây)`);

          const sleepChunk = Math.min(waitMs, 1000);
          await this.sleepWithAbort(sleepChunk, signal);
        }
      });
    });
  }

  private sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Thao tác đã bị hủy.', 'AbortError'));
        });
      }
    });
  }
}

// Global instance of RateLimiter
export const globalRateLimiter = new GlobalRateLimiter(4);

/**
 * Checks if markdown response appears truncated:
 * 1. finishReason is MAX_TOKENS
 * 2. Or for a multi-page chunk, the expected last page marker is missing
 */
export function checkIsTruncated(
  markdown: string,
  finishReason?: string,
  startPage?: number,
  endPage?: number
): boolean {
  if (finishReason === 'MAX_TOKENS') {
    return true;
  }
  if (startPage !== undefined && endPage !== undefined && endPage > startPage) {
    const lastPageMarkerRegex = new RegExp(`<!--\\s*page:\\s*${endPage}\\s*-->`, 'i');
    if (!lastPageMarkerRegex.test(markdown)) {
      return true;
    }
  }
  return false;
}

/**
 * Single raw API call passing through global rate limiter
 */
async function executeApiCall(
  pdfBase64: string,
  startPage: number,
  endPage: number,
  options: ExtractionRequestOptions,
  onWaiting?: (seconds: number, reason: string) => void
): Promise<{ text: string; finishReason?: string; tokens?: ChunkTokens; durationMs: number }> {
  // MUST pass through Rate Limiter
  if (options.maxRpm && options.maxRpm !== globalRateLimiter.getMaxRpm()) {
    globalRateLimiter.setMaxRpm(options.maxRpm);
  }

  await globalRateLimiter.acquireToken(options.signal, onWaiting);

  const startTime = Date.now();
  const response = await fetch('/api/gemini/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pdfBase64,
      startPage,
      endPage,
      model: options.model,
      systemInstruction: SYSTEM_PROMPT,
      customApiKey: options.customApiKey,
    }),
    signal: options.signal,
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }

    const status = response.status;
    const msg = errorData.error || `Lỗi máy chủ (${status})`;
    const details = errorData.details || '';

    // Handle 429
    if (status === 429) {
      const classification = classify429Error(msg, details, errorData.rawError);
      const err: any = new Error(msg);
      err.status = 429;
      err.classification = classification;
      err.details = details;
      throw err;
    }

    const err: any = new Error(msg);
    err.status = status;
    err.details = details;
    throw err;
  }

  const data = await response.json();
  return {
    text: data.text || '',
    finishReason: data.finishReason,
    tokens: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          candidatesTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
    durationMs,
  };
}

/**
 * Call the extraction API with smart 429 handling and exponential backoff
 */
export async function callExtractWithRetry(
  pdfBase64: string,
  startPage: number,
  endPage: number,
  options: ExtractionRequestOptions,
  onWaiting?: (seconds: number, reason: string) => void,
  max5xxRetries = 3
): Promise<ChunkResult> {
  let attempt5xx = 0;
  let unclear429Attempts = 0;

  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException('Thao tác đã bị hủy.', 'AbortError');
    }

    try {
      const res = await executeApiCall(pdfBase64, startPage, endPage, options, onWaiting);
      const isTruncated = checkIsTruncated(res.text, res.finishReason, startPage, endPage);

      return {
        chunkId: `chunk-${startPage}-${endPage}`,
        markdown: res.text,
        finishReason: res.finishReason,
        tokens: res.tokens,
        durationMs: res.durationMs,
        isTruncated,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }

      // Check for 429
      if (err.status === 429 && err.classification) {
        const cls: Classified429 = err.classification;

        // Daily Quota: STOP immediately. Do NOT retry.
        if (cls.type === 'daily') {
          throw new DailyQuotaExhaustedError(
            'Đã hết hạn mức request trong ngày. Các đoạn đã xong được giữ lại. Hãy chờ quota reset hoặc bật billing, rồi bấm "Tiếp tục".'
          );
        }

        // Per-minute Quota: Pause the whole queue for retryDelay (or 60s).
        // This does NOT count as a failed attempt for the chunk!
        if (cls.type === 'per_minute') {
          const pauseSec = cls.retryDelaySeconds || 60;
          globalRateLimiter.pauseQueue(pauseSec, 'Hạn mức phút (RPM/TPM)');
          // Will loop around, and acquireToken will wait for queue pause automatically!
          continue;
        }

        // Unclear 429: Retry at most 1 time after 60s, then treat as daily quota
        if (cls.type === 'unclear') {
          unclear429Attempts++;
          if (unclear429Attempts <= 1) {
            globalRateLimiter.pauseQueue(60, 'Lỗi 429 tạm thời (chờ 60s)');
            continue;
          } else {
            throw new DailyQuotaExhaustedError(
              'Đã hết hạn mức request trong ngày (sau lần kiểm tra lại). Các đoạn đã xong được giữ lại. Hãy chờ quota reset hoặc bật billing, rồi bấm "Tiếp tục".'
            );
          }
        }
      }

      // Non-retryable client errors (400, 401, 403)
      if (err.status === 400 || err.status === 401 || err.status === 403) {
        throw err;
      }

      // 500, 503, network, timeouts: Exponential backoff with jitter (max 3 retries)
      attempt5xx++;
      if (attempt5xx <= max5xxRetries) {
        const backoffMs = Math.pow(2, attempt5xx) * 1200 + Math.random() * 1000;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, backoffMs);
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Thao tác đã bị hủy.', 'AbortError'));
            });
          }
        });
        continue;
      }

      throw err;
    }
  }
}

/**
 * Runs chunks with concurrency control, sliding-window rate limiter,
 * auto-resuming, and smart 429 pause handling.
 */
export async function processChunksPool(
  sourceDoc: PDFDocument,
  chunks: PdfChunk[],
  options: ExtractionRequestOptions,
  concurrency = 2,
  onChunkUpdate: (updatedChunk: PdfChunk) => void,
  onChunksAdded?: (newChunks: PdfChunk[]) => void,
  onDailyQuotaExhausted?: (message: string) => void
): Promise<PdfChunk[]> {
  // Only process chunks that are not done yet!
  const queue: PdfChunk[] = chunks.filter((c) => c.status !== 'done');
  const results: Map<string, PdfChunk> = new Map();
  chunks.forEach((c) => results.set(c.id, c));

  let activeCount = 0;
  let hasAbort = false;
  let dailyQuotaHit = false;

  return new Promise((resolve, reject) => {
    function processNext() {
      if (hasAbort) return;

      if (options.signal?.aborted) {
        hasAbort = true;
        reject(new DOMException('Thao tác đã bị hủy.', 'AbortError'));
        return;
      }

      if (dailyQuotaHit) {
        // Stop all remaining and resolve current state
        resolve(Array.from(results.values()).sort((a, b) => a.startPage - b.startPage));
        return;
      }

      // Check if finished
      const pendingOrRunning = Array.from(results.values()).filter(
        (c) => c.status === 'pending' || c.status === 'running' || c.status === 'waiting-for-rate-limit'
      );
      if (queue.length === 0 && activeCount === 0 && pendingOrRunning.length === 0) {
        resolve(Array.from(results.values()).sort((a, b) => a.startPage - b.startPage));
        return;
      }

      while (activeCount < concurrency && queue.length > 0 && !dailyQuotaHit) {
        const chunk = queue.shift();
        if (!chunk) break;

        // Skip if already done
        if (chunk.status === 'done') continue;

        activeCount++;
        chunk.status = 'running';
        chunk.waitingSecondsRemaining = undefined;
        onChunkUpdate({ ...chunk });

        (async () => {
          try {
            // Extract pages into PDF base64 if not already prepared
            let base64 = chunk.pdfBase64;
            if (!base64) {
              const extracted = await extractPagesAsPdfBase64(sourceDoc, chunk.startPage, chunk.endPage);
              base64 = extracted.base64;
              chunk.pdfBase64 = base64;
            }

            const res = await callExtractWithRetry(
              base64,
              chunk.startPage,
              chunk.endPage,
              options,
              (waitSec, reason) => {
                // Update chunk status to waiting-for-rate-limit with countdown
                chunk.status = 'waiting-for-rate-limit';
                chunk.waitingSecondsRemaining = waitSec;
                chunk.error = reason;
                onChunkUpdate({ ...chunk });
              }
            );

            // Check truncation: auto-halve if multi-page chunk
            if (res.isTruncated && chunk.endPage > chunk.startPage) {
              chunk.status = 'split';
              chunk.markdown = res.markdown;
              onChunkUpdate({ ...chunk });

              const mid = Math.floor((chunk.startPage + chunk.endPage) / 2);
              const part1: PdfChunk = {
                id: `chunk-${chunk.startPage}-${mid}-part1`,
                startPage: chunk.startPage,
                endPage: mid,
                status: 'pending',
                markdown: '',
                attempts: 0,
              };
              const part2: PdfChunk = {
                id: `chunk-${mid + 1}-${chunk.endPage}-part2`,
                startPage: mid + 1,
                endPage: chunk.endPage,
                status: 'pending',
                markdown: '',
                attempts: 0,
              };

              results.delete(chunk.id);
              results.set(part1.id, part1);
              results.set(part2.id, part2);

              if (onChunksAdded) {
                onChunksAdded([part1, part2]);
              }

              queue.unshift(part2);
              queue.unshift(part1);
            } else {
              chunk.status = 'done';
              chunk.markdown = res.markdown;
              chunk.tokens = res.tokens;
              chunk.finishReason = res.finishReason;
              chunk.durationMs = res.durationMs;
              chunk.error = undefined;
              chunk.waitingSecondsRemaining = undefined;
              chunk.attempts += 1;
              results.set(chunk.id, chunk);
              onChunkUpdate({ ...chunk });
            }
          } catch (err: any) {
            if (err.name === 'AbortError') {
              hasAbort = true;
              return;
            }

            // Handle Daily Quota stop
            if (err instanceof DailyQuotaExhaustedError || err.name === 'DailyQuotaExhaustedError') {
              dailyQuotaHit = true;
              chunk.status = 'paused';
              chunk.error = 'Tạm dừng (hết quota ngày)';
              results.set(chunk.id, chunk);
              onChunkUpdate({ ...chunk });

              // Pause all other unfinished chunks in queue
              queue.forEach((c) => {
                c.status = 'paused';
                c.error = 'Tạm dừng (hết quota ngày)';
                results.set(c.id, c);
                onChunkUpdate({ ...c });
              });
              queue.length = 0;

              onDailyQuotaExhausted?.(err.message);
              return;
            }

            chunk.status = 'failed';
            chunk.error = err.message || 'Lỗi khi trích xuất đoạn này.';
            chunk.waitingSecondsRemaining = undefined;
            chunk.attempts += 1;
            results.set(chunk.id, chunk);
            onChunkUpdate({ ...chunk });
          } finally {
            activeCount--;
            processNext();
          }
        })();
      }
    }

    processNext();
  });
}
