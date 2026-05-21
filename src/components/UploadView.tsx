import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileText,
  Plus,
  BrainCircuit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Eye,
  Clock,
  XCircle,
  FileUp,
  ExternalLink,
} from 'lucide-react';
import { submitLawForVerification, getUserSubmittedLaws, uploadPdfToStorage } from '../firebase';
import { verifyAndCategorizeLaw } from '../gemini';
import type { UserProfile, VerifiedLaw } from '../types';
import { LEGAL_DOMAINS } from '../constants';

// PDF.js for reading PDF files
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface UploadViewProps {
  user: UserProfile | null;
}

type UploadStep = 'idle' | 'reading' | 'verifying' | 'submitting' | 'done' | 'error';

type PdfExtractionResult = {
  text: string;
  usedOcr: boolean;
  ocrPages: number;
  totalPages: number;
};

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters?: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

const MIN_DIRECT_PDF_TEXT_CHARS = 25;
const MIN_DIRECT_PDF_WORDS = 8;
const PDF_OCR_RENDER_SCALE = 3;
const TESSERACT_WORKER_PATH = '/tesseract/worker.min.js';
const TESSERACT_CORE_PATH = '/tesseract-core';
const TESSERACT_LANG_PATH = '/tesseract-lang';
const OCR_PAGE_SEG_MODE = '6';
const OCR_USER_DEFINED_DPI = '300';

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getMeaningfulCharCount(text: string): number {
  return text.replace(/[^A-Za-z0-9]/g, '').length;
}

function getWordCount(text: string): number {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function shouldRunOcr(pageText: string): boolean {
  const meaningfulChars = getMeaningfulCharCount(pageText);
  const wordCount = getWordCount(pageText);

  return meaningfulChars < MIN_DIRECT_PDF_TEXT_CHARS || wordCount < MIN_DIRECT_PDF_WORDS;
}

export const UploadView: React.FC<UploadViewProps> = ({ user }) => {
  const [pasteText, setPasteText] = React.useState('');
  const [submittedLaws, setSubmittedLaws] = React.useState<VerifiedLaw[]>([]);
  const [uploadStep, setUploadStep] = React.useState<UploadStep>('idle');
  const [uploadMessage, setUploadMessage] = React.useState('');
  const [fetchingDocs, setFetchingDocs] = React.useState(true);
  const [previewLaw, setPreviewLaw] = React.useState<VerifiedLaw | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const lastOcrProgressRef = React.useRef(-1);

  React.useEffect(() => {
    if (user?.uid) {
      loadSubmittedLaws();
    }
  }, [user?.uid]);

  const loadSubmittedLaws = async () => {
    if (!user?.uid) return;
    setFetchingDocs(true);
    try {
      const laws = await getUserSubmittedLaws(user.uid);
      setSubmittedLaws(laws);
    } catch (err) {
      console.error('Error loading submitted laws:', err);
    } finally {
      setFetchingDocs(false);
    }
  };

  /**
   * Extract text from a PDF file using pdfjs-dist, falling back to OCR when a
   * page appears to be image-based rather than text-based.
   */
  const extractTextFromPDF = async (file: File): Promise<PdfExtractionResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const textParts: string[] = [];
    let usedOcr = false;
    let ocrPages = 0;
    let currentOcrPage = 0;
    const ocrState: { worker: OcrWorker | null } = { worker: null };

    const getPdfPageText = async (page: pdfjsLib.PDFPageProxy): Promise<string> => {
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          if (!('str' in item)) return '';
          return item.hasEOL ? `${item.str}\n` : item.str;
        })
        .join(' ');

      return normalizeExtractedText(pageText);
    };

    const getOcrWorker = async (): Promise<OcrWorker> => {
      if (ocrState.worker) return ocrState.worker;

      setUploadMessage('Scanned PDF detected. Starting OCR engine. First use may take a little longer...');

      const tesseractModule = (await import('tesseract.js')) as unknown as {
        createWorker: (
          langs?: string,
          oem?: number,
          options?: {
            corePath?: string;
            workerPath?: string;
            langPath?: string;
            gzip?: boolean;
            logger?: (message: { status: string; progress: number }) => void;
            errorHandler?: (error: unknown) => void;
          },
        ) => Promise<OcrWorker>;
      };

      ocrState.worker = await tesseractModule.createWorker('eng', 1, {
        workerPath: TESSERACT_WORKER_PATH,
        corePath: TESSERACT_CORE_PATH,
        langPath: TESSERACT_LANG_PATH,
        gzip: true,
        logger: (message) => {
          if (message.status === 'recognizing text') {
            const percent = Math.round(message.progress * 100);
            if (percent === lastOcrProgressRef.current) return;
            lastOcrProgressRef.current = percent;
            setUploadMessage(
              `Running OCR on scanned PDF page ${currentOcrPage} of ${pdf.numPages}... ${percent}%`
            );
            return;
          }

          if (message.status === 'loading language traineddata') {
            setUploadMessage('Loading local OCR language data...');
            return;
          }

          if (message.status === 'initializing api') {
            setUploadMessage('Initializing OCR engine...');
            return;
          }

          if (message.status === 'loading tesseract core') {
            setUploadMessage('Loading OCR core files...');
          }
        },
        errorHandler: (error) => {
          console.error('OCR worker error:', error);
        },
      });

      await ocrState.worker.setParameters?.({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: OCR_PAGE_SEG_MODE,
        user_defined_dpi: OCR_USER_DEFINED_DPI,
      });

      return ocrState.worker;
    };

    const getOcrTextFromPage = async (
      page: pdfjsLib.PDFPageProxy,
      worker: OcrWorker,
    ): Promise<string> => {
      const viewport = page.getViewport({ scale: PDF_OCR_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas rendering is unavailable in this browser.');
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      try {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvas: null,
          canvasContext: context,
          viewport,
          background: '#ffffff',
        }).promise;

        const result = await worker.recognize(canvas);
        return normalizeExtractedText(result.data.text || '');
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    };

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        setUploadMessage(`Reading PDF page ${i} of ${pdf.numPages}...`);

        const pageText = await getPdfPageText(page);
        if (!shouldRunOcr(pageText)) {
          textParts.push(pageText);
          page.cleanup();
          continue;
        }

        usedOcr = true;
        ocrPages += 1;
        currentOcrPage = i;
        lastOcrProgressRef.current = -1;

        const worker = await getOcrWorker();
        setUploadMessage(`Running OCR on scanned PDF page ${i} of ${pdf.numPages}...`);

        const ocrText = await getOcrTextFromPage(page, worker);
        if (ocrText) {
          textParts.push(ocrText);
        } else if (pageText) {
          textParts.push(pageText);
        }

        page.cleanup();
      }
    } finally {
      if (ocrState.worker) {
        await ocrState.worker.terminate();
      }
      await pdf.destroy();
    }

    return {
      text: textParts.filter(Boolean).join('\n\n').trim(),
      usedOcr,
      ocrPages,
      totalPages: pdf.numPages,
    };
  };

  const processAndSubmit = async (rawText: string, type: 'file' | 'text', pdfUrl?: string, originalFileName?: string) => {
    if (!user?.uid) return;

    if (!rawText.trim() || rawText.trim().length < 50) {
      setUploadStep('error');
      setUploadMessage('Text is too short. Please provide a substantial legal document (at least 50 characters).');
      return;
    }

    try {
      // Step 1: Verify with AI
      setUploadStep('verifying');
      setUploadMessage('🤖 AI is verifying your law using Groq... This may take a moment.');

      const verification = await verifyAndCategorizeLaw(rawText);

      if (!verification.isLegitimate) {
        setUploadStep('error');
        setUploadMessage(
          `This doesn't appear to be a legitimate Indian law. Reason: ${verification.reason}`
        );
        return;
      }

      // Step 2: Submit for admin approval
      setUploadStep('submitting');
      setUploadMessage('✅ Verified! Submitting for admin review...');

      await submitLawForVerification(
        user.uid,
        user.displayName || 'Unknown User',
        user.email || '',
        {
          title: verification.title,
          content: rawText,
          category: verification.category,
          sections: verification.sections,
          summary: verification.summary,
          type,
          pdfUrl,
          originalFileName,
        }
      );

      setUploadStep('done');
      setUploadMessage(
        `"${verification.title}" has been verified by AI and submitted for admin approval. It will appear in the Study section once approved.`
      );
      setPasteText('');
      await loadSubmittedLaws();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setUploadStep('error');
      setUploadMessage(error.message || 'Failed to process law. Please try again.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStep('reading');
      setUploadMessage(`📄 Reading "${file.name}"...`);

      let text: string;
      let pdfUrl: string | undefined;
      const originalFileName = file.name;

      if (file.name.toLowerCase().endsWith('.pdf')) {
        const extraction = await extractTextFromPDF(file);
        text = extraction.text;

        if (extraction.usedOcr) {
          setUploadMessage(
            `OCR completed for ${extraction.ocrPages} of ${extraction.totalPages} page(s). Preparing AI analysis...`
          );
        }

        // Upload original PDF to Firebase Storage
        if (user?.uid) {
          try {
            setUploadMessage('📤 Uploading original PDF to storage...');
            pdfUrl = await uploadPdfToStorage(user.uid, file);
          } catch (storageErr) {
            console.warn('PDF storage upload failed, continuing without it:', storageErr);
          }
        }
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        setUploadStep('error');
        setUploadMessage('Could not extract text from this file. Please try a different file.');
        return;
      }

      await processAndSubmit(text, 'file', pdfUrl, originalFileName);
    } catch (err) {
      console.error('File extraction failed:', err);
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Could not read file. Please try a .txt, .md, or .pdf file.';
      setUploadStep('error');
      setUploadMessage(errorMessage);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteAnalyze = () => {
    if (!pasteText.trim()) return;
    processAndSubmit(pasteText, 'text');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getCategoryLabel = (catId: string) => {
    const domain = LEGAL_DOMAINS.find((d) => d.id === catId);
    return domain?.title || catId;
  };

  const isProcessing = uploadStep === 'reading' || uploadStep === 'verifying' || uploadStep === 'submitting';

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8 h-full overflow-y-auto pb-24 md:pb-20">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold">Upload Law</h1>
        <p className="text-on-surface-variant max-w-2xl text-sm sm:text-base md:text-lg">
          Upload Indian law texts or PDFs, including scanned PDFs with OCR fallback. Each upload is <strong>verified by AI (Groq)</strong> and then submitted for admin approval. Approved laws appear in the global Study section.
        </p>
      </div>

      {/* AI Verification Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <BrainCircuit className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-indigo-900">AI-Powered Verification</h3>
            <p className="text-sm text-indigo-700 mt-1">
              Your uploaded law is automatically verified using <strong>Groq AI</strong>. The app extracts text directly from standard PDFs and uses OCR for scanned PDFs, then the AI checks if the document is a legitimate Indian law, categorizes it, and extracts key sections. Once verified, it goes to the admin for final approval.
            </p>
            <div className="flex items-center gap-3 sm:gap-6 mt-3 overflow-x-auto pb-1 text-xs font-bold text-indigo-600">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">1</span>
                Upload
              </span>
              <span className="text-indigo-300">→</span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span>
                AI Verify
              </span>
              <span className="text-indigo-300">→</span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">3</span>
                Admin Review
              </span>
              <span className="text-indigo-300">→</span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">4</span>
                Study Section
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Status Message */}
      <AnimatePresence>
        {uploadStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-start gap-3 p-5 rounded-xl border ${
              uploadStep === 'done'
                ? 'bg-green-50 border-green-200 text-green-800'
                : uploadStep === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {uploadStep === 'done' ? (
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : uploadStep === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
            )}
            <div className="flex-1">
              <span className="text-sm font-medium">{uploadMessage}</span>
              {isProcessing && (
                <div className="mt-2">
                  <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-600 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{
                        width: uploadStep === 'reading' ? '20%' : uploadStep === 'verifying' ? '60%' : '90%',
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
            </div>
            {(uploadStep === 'done' || uploadStep === 'error') && (
              <button onClick={() => setUploadStep('idle')} className="shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* File Upload */}
          <div className="bg-white rounded-xl border border-outline-variant p-5 md:p-8 flex flex-col shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="w-7 h-7 text-black" />
            <h2 className="text-xl md:text-2xl font-display font-bold">Upload Files</h2>
          </div>
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-6 md:p-12 bg-surface-container-low hover:bg-surface-container transition-all group ${
              isProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-10 h-10 text-black animate-spin mb-4" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-6 group-hover:scale-110 transition-all">
                <Plus className="w-8 h-8 text-on-secondary-container" />
              </div>
            )}
            <h3 className="text-lg font-bold mb-1">
              {isProcessing ? 'Processing...' : 'Drop legal documents here'}
            </h3>
            <p className="text-on-surface-variant mb-6 text-center text-sm">
              Or click to browse your computer. Scanned PDFs are supported via OCR.
            </p>
            <div className="flex gap-4 text-[11px] font-bold text-on-surface-variant border-t border-outline-variant pt-4 w-full justify-center opacity-60">
              <span className="flex items-center gap-1"><FileUp className="w-3.5 h-3.5" /> PDF</span>
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> TXT</span>
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> MD</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.log,.text,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Paste Text */}
          <div className="bg-white rounded-xl border border-outline-variant p-5 md:p-8 flex flex-col shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-7 h-7 text-black" />
            <h2 className="text-xl md:text-2xl font-display font-bold">Paste Law Text</h2>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="flex-1 w-full border border-outline rounded-xl p-4 md:p-6 font-sans text-sm outline-none focus:ring-2 focus:ring-black/5 resize-none placeholder:text-slate-400 min-h-[200px]"
              placeholder="Paste the full text of an Indian law, statute, act, or legal provision here..."
              disabled={isProcessing}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5 opacity-60">
                <BrainCircuit className="w-4 h-4" /> AI auto-verifies & categorizes
              </span>
              <button
                onClick={handlePasteAnalyze}
                disabled={isProcessing || !pasteText.trim()}
                className="w-full sm:w-auto justify-center bg-black text-white font-bold py-3 px-6 md:px-8 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <BrainCircuit className="w-5 h-5" />
                )}
                Verify & Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Laws List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold">Your Submissions</h2>
        <p className="text-sm text-on-surface-variant">
          Track the status of laws you've uploaded. Once approved by admin, they become available in the Study section for all users.
        </p>
        {fetchingDocs ? (
          <div className="flex items-center gap-3 text-on-surface-variant py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading submissions...</span>
          </div>
        ) : submittedLaws.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No laws submitted yet.</p>
            <p className="text-sm mt-1">Upload a law above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {submittedLaws.map((law) => (
              <motion.div
                key={law.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-black shrink-0" />
                    <h3 className="font-bold text-sm truncate">{law.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {getStatusBadge(law.status)}
                    <button
                      onClick={() => setPreviewLaw(law)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant line-clamp-2 mb-2">{law.summary}</p>
                {law.sections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {law.sections.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-surface-container rounded text-[10px] font-bold text-on-surface-variant border border-outline-variant"
                      >
                        {s.length > 25 ? s.slice(0, 25) + '...' : s}
                      </span>
                    ))}
                    {law.sections.length > 2 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-outline">
                        +{law.sections.length - 2} more
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-outline">
                    {getCategoryLabel(law.category)}
                  </span>
                  <div className="flex items-center gap-2">
                    {law.pdfUrl && (
                      <a
                        href={law.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" /> View PDF
                      </a>
                    )}
                    <span className="text-[10px] text-outline">
                      {law.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      <AnimatePresence>
        {previewLaw && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={() => setPreviewLaw(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-3 md:inset-16 bg-white rounded-xl shadow-2xl z-[101] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 p-4 md:p-6 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-xl font-display font-bold truncate">{previewLaw.title}</h2>
                  {getStatusBadge(previewLaw.status)}
                </div>
                <button
                  onClick={() => setPreviewLaw(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {previewLaw.summary && (
                <div className="px-6 py-3 border-b border-slate-100 bg-surface-container-low">
                  <p className="text-sm text-on-surface-variant">{previewLaw.summary}</p>
                </div>
              )}
              {previewLaw.sections.length > 0 && (
                <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                  {previewLaw.sections.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {previewLaw.pdfUrl && (
                <div className="px-6 py-3 border-b border-slate-100 bg-blue-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Original PDF: {previewLaw.originalFileName || 'Uploaded Document'}
                    </span>
                  </div>
                  <a
                    href={previewLaw.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Original PDF
                  </a>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="whitespace-pre-wrap text-sm text-on-surface font-sans leading-relaxed">
                  {previewLaw.content}
                </pre>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Status bar */}
      <div className="flex justify-center pb-8">
        <div className="inline-flex items-center gap-2 bg-surface-container border border-outline-variant px-5 py-2 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
            System Ready • {submittedLaws.length} Submissions
          </span>
        </div>
      </div>
    </div>
  );
};
