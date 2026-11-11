import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Navbar } from './components/Navbar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { UploadSettings } from './components/UploadSettings';
import { ExtractionProgress } from './components/ExtractionProgress';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { ValidationModal } from './components/ValidationModal';
import {
  AVAILABLE_MODELS,
  ExtractionSettings,
  PdfChunk,
  SavedPdfSession,
  ValidationReport,
} from './types';
import { loadAndValidatePdf } from './services/pdfSplitter';
import {
  validateAndParsePageRanges,
  generateChunkRangesForSelection,
} from './services/pageRange';
import {
  processChunksPool,
  globalRateLimiter,
  DailyQuotaExhaustedError,
} from './services/gemini';
import {
  mergeAllChunks,
  splitMarkdownIntoPages,
  updatePageInMergedMarkdown,
} from './services/markdownMerge';
import { generateValidationReport } from './services/validator';
import { downloadDocx } from './services/docxBuilder';
import { createSampleAnnualReportPdf } from './services/sampleData';
import {
  getRequestsUsedToday,
  loadPdfSession,
  savePdfSession,
  clearPdfSession,
} from './services/storage';
import { saveAs } from 'file-saver';
import { clearPdfDocCache } from './services/pdfRenderer';
import { RotateCcw, Play, CheckCircle2, History, ArrowLeft, AlertTriangle } from 'lucide-react';

/**
 * When a truncated chunk is auto-split, the parent chunk may stay in the list
 * next to its children. A chunk is "superseded" if another chunk has a page
 * range strictly contained inside it. Superseded chunks are ignored when
 * merging / deciding whether work remains, so pages are never double-counted.
 */
const getEffectiveChunks = (list: PdfChunk[]): PdfChunk[] =>
  list.filter(
    (c) =>
      !list.some(
        (o) =>
          o.id !== c.id &&
          o.startPage >= c.startPage &&
          o.endPage <= c.endPage &&
          (o.startPage !== c.startPage || o.endPage !== c.endPage)
      )
  );

/** Merge chunks returned by the pool into the latest list (adds unseen chunks, takes 'done' results). */
const mergeReturnedChunks = (current: PdfChunk[], returned: PdfChunk[]): PdfChunk[] => {
  const next = [...current];
  for (const r of returned) {
    const idx = next.findIndex((c) => c.id === r.id);
    if (idx < 0) {
      next.push(r);
    } else if (r.status === 'done' && next[idx].status !== 'done') {
      next[idx] = r;
    }
  }
  return next;
};

/** Seconds until the next midnight in Pacific Time (Gemini free-tier daily reset). Estimate only. */
const getSecondsUntilPacificMidnight = (): number => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const elapsed = get('hour') * 3600 + get('minute') * 60 + get('second');
    return Math.max(0, 86400 - elapsed);
  } catch {
    return 0;
  }
};

const formatDuration = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút ${s} giây`;
  return `${s} giây`;
};

export default function App() {
  // Model and Settings state
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [settings, setSettings] = useState<ExtractionSettings>({
    model: 'gemini-3.8-flash',
    chunkSize: 8,
    concurrency: 2,
    includePageMarkers: true,
    apiTier: 'free',
    maxRpm: 4, // Safety limit under 5 RPM
    dailyQuota: 20, // 20 requests per day for free tier
    pageRangeInput: '',
  });

  // API Key state (in-memory only). A personal key is now REQUIRED:
  // the server's environment key is never used for users.
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Pipeline stage: 'upload' | 'processing' | 'review'
  const [activeStage, setActiveStage] = useState<'upload' | 'processing' | 'review'>('upload');

  // Extraction chunks and progress state
  const [chunks, setChunks] = useState<PdfChunk[]>([]);
  // Always mirrors the latest chunks (avoids stale closures in async handlers)
  const chunksRef = useRef<PdfChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persistence helpers (debounced)
  const sessionMetaRef = useRef<{
    fileName: string;
    fileSizeBytes: number;
    totalPages: number;
    model: string;
  } | null>(null);
  const persistTimerRef = useRef<any>(null);

  // Pages the user edited and saved in the review screen (kept when the preview auto-refreshes)
  const editedPagesRef = useRef<Map<number, string>>(new Map());
  // Signature of the done chunks currently shown in the partial review
  const reviewSigRef = useRef<string>('');

  // Rate limiter & Quota UI states
  const [dailyQuotaBanner, setDailyQuotaBanner] = useState<string | null>(null);
  const [queuePausedCountdown, setQueuePausedCountdown] = useState<number>(0);
  const [queuePausedReason, setQueuePausedReason] = useState<string>('');
  const [requestsUsedToday, setRequestsUsedToday] = useState<number>(getRequestsUsedToday());

  // Session resumption state
  const [savedSessionFound, setSavedSessionFound] = useState<SavedPdfSession | null>(null);

  // Merged output & Review state
  const [mergedMarkdown, setMergedMarkdown] = useState<string>('');
  const [pageMarkdownMap, setPageMarkdownMap] = useState<Map<number, string>>(new Map());
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);
  const [isBuildingDocx, setIsBuildingDocx] = useState<boolean>(false);
  // True when the review screen was opened from the progress screen (partial results)
  const [isPartialReview, setIsPartialReview] = useState<boolean>(false);
  // Live countdown (seconds) until the estimated daily quota reset
  const [quotaResetSeconds, setQuotaResetSeconds] = useState<number>(0);

  // ---- chunk state helpers -------------------------------------------------

  /** Compute next chunks from the ref, then update ref + state (no side effects in updaters). */
  const updateChunks = (updater: (prev: PdfChunk[]) => PdfChunk[]) => {
    const next = updater(chunksRef.current);
    chunksRef.current = next;
    setChunks(next);
  };

  const persistNow = async () => {
    const meta = sessionMetaRef.current;
    if (!meta) return;
    try {
      await savePdfSession({
        fileName: meta.fileName,
        fileSizeBytes: meta.fileSizeBytes,
        totalPages: meta.totalPages,
        savedAt: new Date().toLocaleString(),
        model: meta.model,
        chunks: chunksRef.current,
      });
    } catch (err) {
      console.warn('Không thể lưu phiên làm việc:', err);
    }
  };

  const schedulePersist = () => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void persistNow();
    }, 500);
  };

  const flushPersist = async () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    await persistNow();
  };

  const getDoneChunks = () => getEffectiveChunks(chunksRef.current).filter((c) => c.status === 'done');

  /** Re-apply the user's saved page edits on top of freshly merged Markdown. */
  const applyEditedPages = (md: string): string => {
    let out = md;
    editedPagesRef.current.forEach((text, page) => {
      out = updatePageInMergedMarkdown(out, page, text);
    });
    return out;
  };

  const getDoneSignature = () =>
    getDoneChunks()
      .map((c) => `${c.id}:${c.markdown ? c.markdown.length : 0}`)
      .join('|');

  // Sync settings.model when selectedModel changes (Navbar -> Settings)
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setSettings((prev) => ({ ...prev, model }));
  };

  // Sync selectedModel when settings changes from UploadSettings (Settings -> Navbar)
  const handleSettingsChange = (newSettings: ExtractionSettings | ((prev: ExtractionSettings) => ExtractionSettings)) => {
    setSettings((prev) => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      if (updated.model !== prev.model) {
        setSelectedModel(updated.model);
      }
      return updated;
    });
  };

  // Listen to GlobalRateLimiter pause changes
  useEffect(() => {
    const unsub = globalRateLimiter.onPauseChange((isPaused, sec, reason) => {
      setQueuePausedCountdown(sec);
      setQueuePausedReason(reason);
    });

    // Update daily usage counter periodically
    const interval = setInterval(() => {
      setRequestsUsedToday(getRequestsUsedToday());
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Timer handling
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setRequestsUsedToday(getRequestsUsedToday());
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  // Countdown to the estimated daily quota reset while the quota banner is shown
  useEffect(() => {
    if (!dailyQuotaBanner) return;
    setQuotaResetSeconds(getSecondsUntilPacificMidnight());
    const id = setInterval(() => {
      setQuotaResetSeconds(getSecondsUntilPacificMidnight());
    }, 1000);
    return () => clearInterval(id);
  }, [dailyQuotaBanner]);

  // Load and validate selected PDF file
  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    setFileError(null);
    setSavedSessionFound(null);
    clearPdfDocCache();

    try {
      const buffer = await file.arrayBuffer();
      const { doc, pageCount: count } = await loadAndValidatePdf(buffer);

      setSelectedFile(file);
      setPdfArrayBuffer(buffer);
      setPdfDoc(doc);
      setPageCount(count);
      setFileSizeBytes(file.size);
      setActiveStage('upload');

      // Check for saved session in storage (async, never blocks the app on failure)
      try {
        const existingSession = await loadPdfSession(file.name, file.size);
        if (existingSession && existingSession.chunks && existingSession.chunks.some((c) => c.status === 'done')) {
          setSavedSessionFound(existingSession);
        }
      } catch (storageErr) {
        console.warn('Không thể đọc phiên đã lưu:', storageErr);
      }
    } catch (err: any) {
      console.error('File load error:', err);
      setFileError(err.message || 'Lỗi khi đọc file PDF');
      setSelectedFile(null);
      setPdfArrayBuffer(null);
      setPdfDoc(null);
      setPageCount(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Restore saved session
  const handleRestoreSession = () => {
    if (!savedSessionFound || !pageCount || !selectedFile) return;

    const restoredChunks: PdfChunk[] = savedSessionFound.chunks.map((c) => ({
      ...c,
      status: c.status === 'running' || c.status === 'waiting-for-rate-limit' ? 'pending' : c.status,
    }));

    sessionMetaRef.current = {
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      totalPages: pageCount,
      model: settings.model,
    };
    editedPagesRef.current = new Map();
    updateChunks(() => restoredChunks);

    // Merge completed chunks
    const completed = getEffectiveChunks(restoredChunks).filter((c) => c.status === 'done');
    const merged = mergeAllChunks(completed);
    setMergedMarkdown(merged);
    const pageMap = splitMarkdownIntoPages(merged);
    setPageMarkdownMap(pageMap);

    // If all completed, open review directly, otherwise show progress with Resume button
    const allDone = getEffectiveChunks(restoredChunks).every((c) => c.status === 'done');
    if (allDone) {
      const report = generateValidationReport(merged, pageCount, selectedFile.name, settings.model);
      setValidationReport(report);
      setActiveStage('review');
    } else {
      setActiveStage('processing');
      setIsProcessing(false);
    }

    setSavedSessionFound(null);
  };

  // Dismiss saved session and start fresh
  const handleDismissSavedSession = async () => {
    if (selectedFile) {
      try {
        await clearPdfSession(selectedFile.name, selectedFile.size);
      } catch (err) {
        console.warn('Không thể xóa phiên đã lưu:', err);
      }
    }
    setSavedSessionFound(null);
  };

  // Load sample report for quick trial
  const handleLoadSample = async () => {
    setIsLoadingFile(true);
    setFileError(null);
    setSavedSessionFound(null);
    clearPdfDocCache();
    try {
      const { file, bytes } = await createSampleAnnualReportPdf();
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const { doc, pageCount: count } = await loadAndValidatePdf(buffer as ArrayBuffer);

      setSelectedFile(file);
      setPdfArrayBuffer(buffer as ArrayBuffer);
      setPdfDoc(doc);
      setPageCount(count);
      setFileSizeBytes(file.size);
      setActiveStage('upload');

      try {
        const existingSession = await loadPdfSession(file.name, file.size);
        if (existingSession && existingSession.chunks && existingSession.chunks.some((c) => c.status === 'done')) {
          setSavedSessionFound(existingSession);
        }
      } catch (storageErr) {
        console.warn('Không thể đọc phiên đã lưu:', storageErr);
      }
    } catch (err: any) {
      setFileError(err.message || 'Không thể tạo tài liệu mẫu.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  /** Merge all effective chunks, build the validation report and open the review stage. */
  const finalizeReview = (effective: PdfChunk[]) => {
    if (!pageCount || !selectedFile) return;
    const merged = applyEditedPages(mergeAllChunks(effective));
    setMergedMarkdown(merged);

    const pageMap = splitMarkdownIntoPages(merged);
    setPageMarkdownMap(pageMap);

    const report = generateValidationReport(merged, pageCount, selectedFile.name, settings.model);
    setValidationReport(report);

    setIsProcessing(false);
    setIsPartialReview(false);
    setActiveStage('review');
  };

  /** Shared runner for start and resume: processes `toRun`, then merges using the LATEST chunks. */
  const runExtraction = async (toRun: PdfChunk[]) => {
    if (!pdfDoc || !pageCount || !selectedFile) return;

    sessionMetaRef.current = {
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      totalPages: pageCount,
      model: settings.model,
    };

    setIsProcessing(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const returned = await processChunksPool(
        pdfDoc,
        toRun,
        {
          model: settings.model,
          customApiKey: customApiKey,
          signal: abortController.signal,
          maxRpm: settings.maxRpm,
        },
        settings.concurrency,
        (updatedChunk) => {
          updateChunks((prev) => prev.map((c) => (c.id === updatedChunk.id ? updatedChunk : c)));
          schedulePersist();
        },
        (newChunks) => {
          // Add auto-split child chunks (skip any id already present)
          updateChunks((prev) => {
            const ids = new Set(prev.map((c) => c.id));
            return [...prev, ...newChunks.filter((c) => !ids.has(c.id))];
          });
          schedulePersist();
        },
        (dailyQuotaMsg) => {
          setDailyQuotaBanner(dailyQuotaMsg);
          setIsProcessing(false);
          void flushPersist();
        }
      );

      // Combine pool result with the latest state (includes split children)
      updateChunks((prev) => mergeReturnedChunks(prev, returned));
      await flushPersist();

      const effective = getEffectiveChunks(chunksRef.current);
      if (effective.some((c) => c.status !== 'done')) {
        setIsProcessing(false);
        return;
      }

      finalizeReview(effective);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('Extraction paused or aborted by user.');
      } else {
        console.error('Extraction error:', err);
      }
      await flushPersist();
      setIsProcessing(false);
    }
  };

  // Start Extraction Pipeline
  const handleStartExtraction = async () => {
    if (!pdfDoc || !pageCount || !pdfArrayBuffer || !selectedFile) {
      return;
    }

    // Personal API key is required
    if (!customApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    // Parse and validate page ranges
    const rangeResult = validateAndParsePageRanges(settings.pageRangeInput, pageCount);
    if (!rangeResult.isValid || rangeResult.contiguousRanges.length === 0) {
      alert(rangeResult.errorMessage || 'Khoảng trang đã chọn không hợp lệ.');
      return;
    }

    // Configure rate limiter
    globalRateLimiter.setMaxRpm(settings.maxRpm);

    const ranges = generateChunkRangesForSelection(rangeResult.contiguousRanges, settings.chunkSize);
    const initialChunks: PdfChunk[] = ranges.map((r) => ({
      id: r.id,
      startPage: r.startPage,
      endPage: r.endPage,
      status: 'pending',
      markdown: '',
      attempts: 0,
    }));

    editedPagesRef.current = new Map();
    updateChunks(() => initialChunks);
    setDailyQuotaBanner(null);
    setActiveStage('processing');

    await runExtraction(initialChunks);
  };

  // Resume processing (only unfinished chunks)
  const handleResumeExtraction = async () => {
    if (!pdfDoc || !pdfArrayBuffer || !selectedFile || !pageCount) return;

    // Personal API key is required
    if (!customApiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setDailyQuotaBanner(null);
    globalRateLimiter.setMaxRpm(settings.maxRpm);

    // Only chunks that are not done (ignoring superseded parents of split chunks)
    const effective = getEffectiveChunks(chunksRef.current);
    const unfinished = effective.filter((c) => c.status !== 'done');
    if (unfinished.length === 0) {
      finalizeReview(effective);
      return;
    }

    // Reset status of paused/waiting chunks to pending
    const resetUnfinished: PdfChunk[] = unfinished.map((c) => ({
      ...c,
      status: 'pending',
      waitingSecondsRemaining: undefined,
      error: undefined,
    }));

    updateChunks((prev) =>
      prev.map((c) => {
        const found = resetUnfinished.find((r) => r.id === c.id);
        return found ? found : c;
      })
    );

    await runExtraction(resetUnfinished);
  };

  // Retry only failed chunks
  const handleRetryFailed = async () => {
    handleResumeExtraction();
  };

  // Cancel processing
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);

    // Mark running or waiting chunks as paused so user can resume anytime
    updateChunks((prev) =>
      prev.map((c) =>
        c.status === 'running' || c.status === 'waiting-for-rate-limit'
          ? { ...c, status: 'paused', error: 'Tạm dừng bởi người dùng' }
          : c
      )
    );
    void flushPersist();
  };

  // Partial Docx download
  const handleDownloadPartialDocx = async () => {
    if (!selectedFile) return;
    const completed = getDoneChunks();
    if (completed.length === 0) {
      alert('Chưa có đoạn nào hoàn thành để xuất file.');
      return;
    }

    const partialMarkdown = mergeAllChunks(completed);
    setIsBuildingDocx(true);
    try {
      const partialName = selectedFile.name.replace(/\.pdf$/i, '') + '_PhanDaXong.docx';
      await downloadDocx(partialMarkdown, partialName, {
        includePageMarkers: settings.includePageMarkers,
      });
    } catch (err) {
      console.error('Docx download error:', err);
      alert('Không thể tạo file Word một phần.');
    } finally {
      setIsBuildingDocx(false);
    }
  };

  // Partial Markdown download
  const handleDownloadPartialMd = () => {
    if (!selectedFile) return;
    const completed = getDoneChunks();
    if (completed.length === 0) {
      alert('Chưa có đoạn nào hoàn thành để xuất file.');
      return;
    }

    const partialMarkdown = mergeAllChunks(completed);
    const blob = new Blob([partialMarkdown], { type: 'text/markdown;charset=utf-8' });
    const targetName = selectedFile.name.replace(/\.pdf$/i, '') + '_PhanDaXong.md';
    saveAs(blob, targetName);
  };

  // View partial review
  const handleViewPartialReview = () => {
    const completed = getDoneChunks();
    if (completed.length === 0 || !pageCount || !selectedFile) return;

    const partialMarkdown = applyEditedPages(mergeAllChunks(completed));
    setMergedMarkdown(partialMarkdown);
    const pageMap = splitMarkdownIntoPages(partialMarkdown);
    setPageMarkdownMap(pageMap);

    const report = generateValidationReport(partialMarkdown, pageCount, selectedFile.name, settings.model);
    setValidationReport(report);

    reviewSigRef.current = getDoneSignature();
    setIsPartialReview(true);
    setActiveStage('review');
  };

  // Back from partial review to the progress screen (keeps processing running if it is)
  const handleBackToProgress = () => {
    setIsPartialReview(false);
    setActiveStage('processing');
  };

  // Save single page markdown edit
  const handleSavePageMarkdown = (pageNum: number, newMarkdown: string) => {
    editedPagesRef.current.set(pageNum, newMarkdown);
    const updatedMap = new Map(pageMarkdownMap);
    updatedMap.set(pageNum, newMarkdown);
    setPageMarkdownMap(updatedMap);

    const updatedMerged = updatePageInMergedMarkdown(mergedMarkdown, pageNum, newMarkdown);
    setMergedMarkdown(updatedMerged);

    if (pageCount && selectedFile) {
      const updatedReport = generateValidationReport(
        updatedMerged,
        pageCount,
        selectedFile.name,
        settings.model
      );
      setValidationReport(updatedReport);
    }
  };

  // Save full document markdown edit
  const handleSaveAllMarkdown = (newMergedMarkdown: string) => {
    setMergedMarkdown(newMergedMarkdown);
    const updatedMap = splitMarkdownIntoPages(newMergedMarkdown);
    setPageMarkdownMap(updatedMap);

    // Remember every page whose text differs from the extracted chunks
    const base = splitMarkdownIntoPages(mergeAllChunks(getDoneChunks()));
    updatedMap.forEach((text, page) => {
      if (base.get(page) !== text) editedPagesRef.current.set(page, text);
    });

    if (pageCount && selectedFile) {
      const updatedReport = generateValidationReport(
        newMergedMarkdown,
        pageCount,
        selectedFile.name,
        settings.model
      );
      setValidationReport(updatedReport);
    }
  };

  // Download complete DOCX
  const handleDownloadDocx = async () => {
    if (!mergedMarkdown || !selectedFile) return;
    setIsBuildingDocx(true);
    try {
      await downloadDocx(mergedMarkdown, selectedFile.name, {
        includePageMarkers: settings.includePageMarkers,
      });
    } catch (err) {
      console.error('Docx download error:', err);
      alert('Không thể tạo file Word. Vui lòng kiểm tra nội dung Markdown.');
    } finally {
      setIsBuildingDocx(false);
    }
  };

  // Download Raw Markdown (.md)
  const handleDownloadMd = () => {
    if (!mergedMarkdown || !selectedFile) return;
    const blob = new Blob([mergedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const targetName = selectedFile.name.replace(/\.pdf$/i, '') + '.md';
    saveAs(blob, targetName);
  };

  // Download Validation Report (.json)
  const handleDownloadReportJson = () => {
    if (!validationReport || !selectedFile) return;
    const jsonStr = JSON.stringify(validationReport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const targetName = `${selectedFile.name.replace(/\.pdf$/i, '')}_BaoCaoKiemTra.json`;
    saveAs(blob, targetName);
  };

  // Reset to Upload Stage
  const handleReset = () => {
    if (isProcessing) {
      handleCancelProcessing();
    }
    editedPagesRef.current = new Map();
    setIsPartialReview(false);
    setActiveStage('upload');
  };

  // Auto-refresh the partial preview when more chunks finish in the background.
  // Saved page edits are re-applied, so they are never overwritten.
  useEffect(() => {
    if (activeStage !== 'review' || !isPartialReview) return;
    const sig = getDoneSignature();
    if (sig === reviewSigRef.current) return;
    reviewSigRef.current = sig;

    const completed = getDoneChunks();
    if (completed.length === 0 || !pageCount || !selectedFile) return;

    const merged = applyEditedPages(mergeAllChunks(completed));
    setMergedMarkdown(merged);
    setPageMarkdownMap(splitMarkdownIntoPages(merged));
    setValidationReport(generateValidationReport(merged, pageCount, selectedFile.name, settings.model));
  }, [chunks, activeStage, isPartialReview]);

  // Going back to the main screen stops running work, so confirm first
  const handleResetWithConfirm = () => {
    if (
      isProcessing &&
      !window.confirm(
        'Về màn hình chính sẽ dừng xử lý đang chạy (các đoạn đã xong vẫn được lưu). Bạn có chắc không?'
      )
    ) {
      return;
    }
    handleReset();
  };

  // Derived notices (visible on the progress screen and on the review screen)
  const effectiveNow = getEffectiveChunks(chunks);
  const allChunksDone = effectiveNow.length > 0 && effectiveNow.every((c) => c.status === 'done');
  const showQuotaNotice = Boolean(dailyQuotaBanner);
  const showRateWaitNotice = !showQuotaNotice && queuePausedCountdown > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      {/* hasEnvKey is forced to false: the server key is never used, a personal key is required */}
      <Navbar
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        hasEnvKey={false}
        customApiKey={customApiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        isProcessing={isProcessing}
        requestsUsedToday={requestsUsedToday}
        dailyQuotaLimit={settings.dailyQuota}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Small notices: all chunks done (green) */}
        {activeStage !== 'upload' && allChunksDone && (
          <div role="status" className="px-3 py-1.5 rounded-xl bg-green-900 border border-green-600/60 text-green-100 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Đã hoàn thành quá trình. Mời bạn tải file!</span>
          </div>
        )}

        {/* Small notices: quota exhausted / waiting for requests (yellow) */}
        {activeStage !== 'upload' && showQuotaNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-yellow-900/40 border border-yellow-500/50 text-yellow-300 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {quotaResetSeconds > 0
                ? `Đã hết hạn mức request trong ngày. Quota dự kiến reset sau ~${formatDuration(quotaResetSeconds)} (khoảng ${new Date(
                    Date.now() + quotaResetSeconds * 1000
                  ).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} giờ máy bạn). Các đoạn đã xong được giữ lại.`
                : 'Quota có thể đã được reset. Hãy quay lại màn hình tiến độ và bấm "Tiếp tục".'}
            </span>
          </div>
        )}
        {activeStage !== 'upload' && showRateWaitNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-yellow-900/40 border border-yellow-500/50 text-yellow-300 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Tạm dừng gọi API do giới hạn request, tự chạy tiếp sau ~{queuePausedCountdown} giây
              {queuePausedReason ? ` (${queuePausedReason})` : ''}.
            </span>
          </div>
        )}

        {/* Saved Session Resumption Banner */}
        {savedSessionFound && activeStage === 'upload' && (
          <div className="p-4 rounded-2xl bg-blue-950/70 border border-blue-500/30 text-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-sm text-white">
                  Phát hiện phiên làm việc đã lưu từ trước
                </h4>
                <p className="text-slate-300">
                  Tập tin <strong>{savedSessionFound.fileName}</strong> có{' '}
                  <strong className="text-emerald-400">
                    {savedSessionFound.chunks.filter((c) => c.status === 'done').length} /{' '}
                    {savedSessionFound.chunks.length} đoạn
                  </strong>{' '}
                  đã hoàn thành (lưu lúc {savedSessionFound.savedAt}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center">
              <button
                type="button"
                onClick={handleDismissSavedSession}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Bắt đầu mới
              </button>
              <button
                type="button"
                onClick={handleRestoreSession}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục để tiếp tục</span>
              </button>
            </div>
          </div>
        )}

        {activeStage === 'upload' && (
          <UploadSettings
            onFileSelected={handleFileSelected}
            selectedFile={selectedFile}
            pageCount={pageCount}
            fileSizeBytes={fileSizeBytes}
            isLoadingFile={isLoadingFile}
            fileError={fileError}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onStartExtraction={handleStartExtraction}
            isProcessing={isProcessing}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeStage === 'processing' && (
          <ExtractionProgress
            chunks={chunks}
            isProcessing={isProcessing}
            elapsedSeconds={elapsedSeconds}
            onCancel={handleCancelProcessing}
            onResume={handleResumeExtraction}
            onRetryFailed={handleRetryFailed}
            onDownloadPartialDocx={handleDownloadPartialDocx}
            onDownloadPartialMd={handleDownloadPartialMd}
            onViewPartialReview={handleViewPartialReview}
            model={settings.model}
            dailyQuotaBanner={dailyQuotaBanner}
            queuePausedCountdown={queuePausedCountdown}
            queuePausedReason={queuePausedReason}
            requestsUsedToday={requestsUsedToday}
            dailyQuotaLimit={settings.dailyQuota}
          />
        )}

        {activeStage === 'review' && isPartialReview && (
          <div className="p-3 rounded-2xl bg-blue-950/70 border border-blue-500/30 text-blue-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <p className="text-xs text-slate-300">
              Đang xem trước <strong>phần đã hoàn thành</strong>{' '}
              {isProcessing ? '(các đoạn còn lại vẫn đang xử lý nền).' : '(xử lý đang tạm dừng).'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBackToProgress}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/40 shadow-lg shadow-blue-600/25 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại tiến độ các đoạn</span>
              </button>
            </div>
          </div>
        )}

        {activeStage === 'review' && pdfArrayBuffer && pageCount && selectedFile && (
          <ReviewWorkspace
            pdfArrayBuffer={pdfArrayBuffer}
            totalPages={pageCount}
            fileName={selectedFile.name}
            mergedMarkdown={mergedMarkdown}
            pageMarkdownMap={pageMarkdownMap}
            onSavePageMarkdown={handleSavePageMarkdown}
            onSaveAllMarkdown={handleSaveAllMarkdown}
            onDownloadDocx={handleDownloadDocx}
            onDownloadMd={handleDownloadMd}
            onOpenValidationModal={() => setIsValidationModalOpen(true)}
            validationReport={validationReport}
            onReset={handleResetWithConfirm}
            isBuildingDocx={isBuildingDocx}
          />
        )}
      </main>

      {/* Validation Modal */}
      <ValidationModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        report={validationReport}
        onDownloadReportJson={handleDownloadReportJson}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        hasEnvKey={false}
        currentCustomKey={customApiKey}
        onSaveCustomKey={setCustomApiKey}
      />
    </div>
  );
}