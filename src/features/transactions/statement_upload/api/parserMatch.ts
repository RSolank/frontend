import type { ParserOption } from './schemas';

// Match an uploaded file's name against the parser catalog so the
// FE can pre-select the parser class before sending the upload.
// The user supplies the parser class to the BE explicitly; this
// helper is the predictor that saves them a manual pick when the
// filename carries the parser identifier (the common case —
// statements typically download with names like
// `phonepe-statement-may-2026.pdf` or `icici-savings.csv`).
//
// Strategy: for each parser, check whether its `key`,
// `source_type`, or the first word of its `label` appears anywhere
// in the lowercased filename. Returns the first matching parser
// (registration order wins on ties — mirrors BE tie-break in
// `detect_parser()`). Returns `null` when no parser matches.
//
// Future-friendly: a new parser shipped by the BE — `icici`,
// `axis`, `cred` etc. — slots in here with zero FE change as long
// as the BE chooses a recognisable `key` or `label` first word.
// When that assumption breaks (e.g. a parser keyed `acme_bank`
// that statements never label `acme_bank`), the user falls back
// to the explicit picker — same UX, just one extra click.

export function matchParserByFilename(
  filename: string,
  parsers: readonly ParserOption[]
): ParserOption | null {
  if (!filename) return null;
  // Strip the trailing extension before matching so a parser key
  // that happens to share a file extension (e.g. `csv`) doesn't
  // false-positive on every `.csv` upload. The user's intent is
  // "match the parser identifier word in the filename", not "the
  // file extension is the parser." Statements with an institution
  // name in the stem (`phonepe-may-2026.pdf`,
  // `icici-savings.csv`) still match.
  const stem = stripExtension(filename).toLowerCase();
  if (!stem) return null;
  for (const parser of parsers) {
    if (matchesParser(stem, parser)) return parser;
  }
  return null;
}

function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  // No dot, or the dot is the leading char (`.env`-style) → keep
  // everything; otherwise drop the trailing `.ext`.
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

function matchesParser(lowerFilename: string, parser: ParserOption): boolean {
  const candidates = collectCandidates(parser);
  for (const candidate of candidates) {
    if (candidate && lowerFilename.includes(candidate)) return true;
  }
  return false;
}

function collectCandidates(parser: ParserOption): string[] {
  const out: string[] = [];
  const key = parser.key.toLowerCase().trim();
  if (key) out.push(key);
  const source = parser.source_type.toLowerCase().trim();
  if (source && source !== key) out.push(source);
  const firstLabelWord = firstWord(parser.label);
  if (firstLabelWord && firstLabelWord !== key && firstLabelWord !== source) {
    out.push(firstLabelWord);
  }
  return out;
}

function firstWord(label: string): string {
  const lower = label.toLowerCase().trim();
  if (!lower) return '';
  // Split on whitespace OR punctuation so a label like
  // "PhonePe statement (PDF)" yields "phonepe".
  const match = /^[\p{L}\p{N}_]+/u.exec(lower);
  return match ? match[0] : '';
}
