import { QRCodeSVG } from 'qrcode.react';

// The qrcode.react-bearing chunk. Imported only via `lazy()` from QrCode.tsx so
// `qrcode.react` lands in its own async bundle and never enters the initial-JS
// budget in .size-limit.json. Rendered dark-on-white in BOTH themes on purpose:
// QR scanners need high light/dark contrast, so we never invert for dark mode.
export default function QrCodeSvg({
  value,
  size,
  level,
  label,
}: {
  value: string;
  size: number;
  level: 'L' | 'M' | 'Q' | 'H';
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="w-fit rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200"
    >
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        bgColor="#ffffff"
        fgColor="#0f172a"
        marginSize={2}
      />
    </div>
  );
}
