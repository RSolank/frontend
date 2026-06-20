import { Check, Copy } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';

// Shared QR primitive. Any feature that needs a scannable code calls this —
// 2FA enrollment today; future UPI-payment QRs (paying bills / consumption tax
// from the savings account, pre-mobile-app) will reuse it once the payment +
// security flow exists. It is deliberately value-agnostic: callers build the
// encoded string (a URL, an `otpauth://` URI, a `upi://pay?…` intent) and own
// when to fetch it (a button-triggered mutation, or an eager on-mount fetch for
// a dedicated QR page). This component only renders.
//
// The qrcode.react impl is lazy-loaded (see QrCodeSvg) so the library stays out
// of the initial-JS bundle budgeted in .size-limit.json — it loads on first QR
// render. The internal <Suspense> means consumers get the code-split for free.
const QrCodeSvg = lazy(() => import('./QrCodeSvg'));

export type QrCodeProps = {
  /** String encoded into the QR (URL, `otpauth://` URI, `upi://pay?…`, …). */
  value: string;
  /** Pixel size of the QR square. Default 160. */
  size?: number;
  /**
   * Error-correction level. Default 'M'. Bump to 'Q' / 'H' when overlaying a
   * center logo (e.g. a future UPI-payment QR) so the code still scans.
   */
  level?: 'L' | 'M' | 'Q' | 'H';
  /** Accessible name for the QR image. Default "QR code". */
  label?: string;
  /**
   * Opt-in human-readable text shown under the QR with a copy button, so a user
   * can copy/paste it. Pass the encoded value ONLY when it is short and
   * NON-SENSITIVE (a URL or UPI id). NEVER pass a secret — e.g. an `otpauth://`
   * URI carries the TOTP shared secret, so 2FA passes no caption.
   */
  caption?: string;
  className?: string;
  /** Override the skeleton shown while the QR chunk loads. */
  fallback?: ReactNode;
};

export function QrCode({
  value,
  size = 160,
  level = 'M',
  label = 'QR code',
  caption,
  className,
  fallback,
}: QrCodeProps) {
  const boxPx = size + 24; // QR + p-3 padding, for the loading skeleton
  return (
    <div className={className}>
      <Suspense
        fallback={
          fallback ?? (
            <div
              aria-hidden
              style={{ width: boxPx, height: boxPx }}
              className="animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
            />
          )
        }
      >
        <QrCodeSvg value={value} size={size} level={level} label={label} />
      </Suspense>
      {caption ? <QrCaption text={caption} /> : null}
    </div>
  );
}

function QrCaption({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the text stays
      // selectable, so the user can still copy it manually.
    }
  }

  return (
    <div className="mt-2 flex max-w-64 items-center gap-2">
      <code
        data-testid="qr-caption"
        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs break-all text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        {text}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
        className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        {copied ? (
          <Check className="text-success-600 dark:text-success-400 h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
