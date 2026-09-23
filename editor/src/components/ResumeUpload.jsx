// "Upload résumé PDF" — the one way to fill in a résumé now that the editor is
// gone. Reads the PDF in the browser, hands the parsed fields to onParsed, and
// never stores the file itself.
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { extractTextFromPdfFile, parseResumeTextHeuristically } from '../utils/resumePdf.js';

// Anything bigger is almost certainly a scan (images, no text layer) and would
// stall pdf.js on a phone for nothing.
const MAX_BYTES = 10 * 1024 * 1024;

const COPY = {
  en: { upload: 'Upload résumé PDF', reading: 'Reading PDF…', notPdf: 'Choose a PDF file.', tooBig: 'That PDF is over 10 MB.', failed: 'Could not read that PDF.', noText: 'No text found in that PDF. It may be a scanned image.' },
  ja: { upload: '履歴書PDFをアップロード', reading: 'PDFを読み込み中…', notPdf: 'PDFファイルを選んでください。', tooBig: 'PDFが10MBを超えています。', failed: 'PDFを読み込めませんでした。', noText: 'PDFから文字を読み取れませんでした（画像のみのPDFの可能性があります）。' },
};

export default function ResumeUpload({ isJa = false, onParsed, onError, className = '' }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const inputRef = useRef(null);
  const [reading, setReading] = useState(false);

  const onFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { onError?.(t.notPdf); return; }
    if (file.size > MAX_BYTES) { onError?.(t.tooBig); return; }
    setReading(true);
    try {
      const text = await extractTextFromPdfFile(file);
      if (!text.trim()) { onError?.(t.noText); return; }
      await onParsed(parseResumeTextHeuristically(text), file.name);
    } catch (error) {
      onError?.(error?.message ? `${t.failed} (${error.message})` : t.failed);
    } finally {
      setReading(false);
    }
  };

  return (
    <>
      <button type="button" className={`btn resume-upload-btn ${className}`} onClick={() => inputRef.current?.click()} disabled={reading}>
        <Upload size={15} /> {reading ? t.reading : t.upload}
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFile} data-testid="resume-pdf-input" />
    </>
  );
}
