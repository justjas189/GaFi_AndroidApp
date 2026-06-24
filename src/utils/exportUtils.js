// exportUtils.js
// Pure helpers for exporting the user's expense history to a real file.
//
// Split into four concerns so the UI (ExportModal) stays thin:
//   1. Date math      — getRangeBounds / filterExpensesByRange / summarizeRange
//   2. CSV formatting  — expensesToCSV  (Excel-friendly: BOM + CRLF + quoting)
//   3. TXT formatting  — expensesToTXT  (monospace-aligned columns + totals)
//   4. File + share    — writeAndShareExport (expo-file-system new API + expo-sharing)
//
// Expense shape (from the `expenses` table, select('*')): the user's mental model
// is { id, title, amount, category, date } but the live column is `description`
// (sometimes `note`), so every text read falls back through title → description → note.

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const PESO = '₱'; // ₱

// ── Date helpers ──────────────────────────────────────────────────────────

// Parse anything the row throws at us (ISO date, full timestamp) into a Date,
// or null when it's unusable — callers decide how to treat the null.
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ISO `YYYY-MM-DD`: sortable, locale-proof, and Excel reads it as a real date.
function fmtDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The single source of truth for a row's date (date column first, created_at fallback).
const rowDate = (e) => e.date || e.created_at;

/**
 * Turn the user's range choice into concrete [start, end] Date bounds.
 * `all` → open-ended (null/null). `month`/`custom` → clamped to day edges so a
 * whole day's expenses are always included regardless of their time component.
 *
 * @param {'all'|'month'|'custom'} mode
 * @param {{ year?: number, month?: number, start?: Date, end?: Date }} opts
 */
export function getRangeBounds(mode, opts = {}) {
  if (mode === 'month') {
    const { year, month } = opts;
    return {
      start: new Date(year, month, 1, 0, 0, 0, 0),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999), // day 0 of next month = last day
    };
  }
  if (mode === 'custom') {
    const start = opts.start ? new Date(opts.start) : null;
    const end = opts.end ? new Date(opts.end) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return { start: null, end: null }; // all time
}

/**
 * Filter expenses to those falling inside [start, end] (either bound may be null
 * for open-ended). Rows with an unparseable date are dropped from a bounded range
 * but kept for "all time".
 */
export function filterExpensesByRange(expenses, { start, end } = {}) {
  if (!start && !end) return expenses;
  const lo = start ? start.getTime() : -Infinity;
  const hi = end ? end.getTime() : Infinity;
  return expenses.filter((e) => {
    const d = toDate(rowDate(e));
    if (!d) return false;
    const t = d.getTime();
    return t >= lo && t <= hi;
  });
}

/** Count + total for a filtered list — drives the live summary chip in the modal. */
export function summarizeRange(expenses) {
  let total = 0;
  for (const e of expenses) total += Number(e.amount) || 0;
  return { count: expenses.length, total };
}

/** Human label for the chosen range, reused in the chip, filename, and report header. */
export function describeRange(mode, opts = {}) {
  if (mode === 'month') {
    const d = new Date(opts.year, opts.month, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (mode === 'custom') {
    return `${fmtDate(opts.start)} to ${fmtDate(opts.end)}`;
  }
  return 'All time';
}

// ── CSV formatting ────────────────────────────────────────────────────────

// Hoisted: only quote a cell when it actually contains a delimiter/quote/newline.
const CSV_NEEDS_QUOTE = /[",\r\n]/;

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return CSV_NEEDS_QUOTE.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Oldest → newest reads naturally in a report; rows arrive newest-first.
function sortedAscending(expenses) {
  return [...expenses].sort((a, b) => {
    const da = toDate(rowDate(a));
    const db = toDate(rowDate(b));
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
}

const expenseTitle = (e) => e.title || e.description || e.note || '';

/**
 * Build an Excel-clean CSV string.
 * - Leading BOM so Excel decodes UTF-8 (the ₱ sign, accents) instead of mojibake.
 * - CRLF line endings (what Excel expects).
 * - Amount stays a bare number so Excel treats the column as numeric.
 */
export function expensesToCSV(expenses) {
  const rows = sortedAscending(expenses);
  const lines = ['Date,Category,Title,Amount'];
  for (const e of rows) {
    lines.push(
      [
        csvCell(fmtDate(rowDate(e))),
        csvCell(e.category || 'Uncategorized'),
        csvCell(expenseTitle(e)),
        (Number(e.amount) || 0).toFixed(2),
      ].join(',')
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n'; // U+FEFF BOM so Excel decodes UTF-8 (₱, accents)
}

// ── TXT formatting ────────────────────────────────────────────────────────

const colWidth = (rows, header, key) =>
  rows.reduce((max, r) => Math.max(max, r[key].length), header.length);

/**
 * Build a monospace-aligned plain-text report: padded columns, a rule under the
 * header, and a totals footer. Amounts are right-aligned with the ₱ sign.
 *
 * @param {Array} expenses
 * @param {{ rangeLabel?: string }} meta
 */
export function expensesToTXT(expenses, meta = {}) {
  const rangeLabel = meta.rangeLabel || 'All time';
  const rows = sortedAscending(expenses).map((e) => ({
    date: fmtDate(rowDate(e)),
    category: e.category || 'Uncategorized',
    title: expenseTitle(e) || '—',
    amount: `${PESO}${(Number(e.amount) || 0).toFixed(2)}`,
  }));

  const H = { date: 'DATE', category: 'CATEGORY', title: 'TITLE', amount: 'AMOUNT' };
  const w = {
    date: colWidth(rows, H.date, 'date'),
    category: colWidth(rows, H.category, 'category'),
    title: colWidth(rows, H.title, 'title'),
    amount: colWidth(rows, H.amount, 'amount'),
  };

  const line = (r) =>
    `${r.date.padEnd(w.date)}  ${r.category.padEnd(w.category)}  ${r.title.padEnd(w.title)}  ${r.amount.padStart(w.amount)}`;

  const total = rows.reduce((s, r) => s + Number(r.amount.slice(1)), 0);
  const header = line({ date: H.date, category: H.category, title: H.title, amount: H.amount });
  const rule = '-'.repeat(header.length);

  const out = [
    'GaFi Expense Report',
    `Range:    ${rangeLabel}`,
    `Entries:  ${rows.length}`,
    `Total:    ${PESO}${total.toFixed(2)}`,
    `Exported: ${fmtDate(new Date())}`,
    '',
    header,
    rule,
    ...rows.map(line),
    rule,
    `${'TOTAL'.padEnd(w.date + w.category + w.title + 4)}  ${`${PESO}${total.toFixed(2)}`.padStart(w.amount)}`,
    '',
  ];
  return out.join('\n');
}

// ── Filename + file write/share ───────────────────────────────────────────

const FILENAME_UNSAFE = /[^a-z0-9._-]+/gi;

/** Slugify the range into a filename: `gafi-expenses_all-time_2026-06-24.csv`. */
export function buildFileName(format, rangeLabel) {
  const slug = (rangeLabel || 'all-time').toLowerCase().replace(FILENAME_UNSAFE, '-').replace(/^-+|-+$/g, '');
  const stamp = fmtDate(new Date());
  return `gafi-expenses_${slug}_${stamp}.${format}`;
}

// iOS keys off `UTI`, Android off `mimeType` — independent fields, so we set both
// per format. These are the precise, "correct" types: iOS Files/Numbers tag the
// file right, and a desktop receiver labels it as a real CSV/TXT.
const FORMAT_META = {
  csv: { mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
  txt: { mimeType: 'text/plain', uti: 'public.plain-text' },
};

// Android-only override. A `text/*` ACTION_SEND gets routed into Messenger's
// "type a message" activity, which reads EXTRA_TEXT and silently drops the file
// stream — so nothing attaches. A generic application/* type forces the
// file-attach path instead. Gmail, Drive, Sheets and Excel still open it fine
// because they resolve the type from the .csv/.txt extension, not the MIME.
// iOS is untouched and keeps the precise per-format UTI above.
const ANDROID_SHARE_MIME = 'application/octet-stream';

/**
 * Write `content` to a real file in the cache directory and open the native share
 * sheet on it. Cache (not document) dir: these are throwaway export artifacts.
 *
 * @returns {Promise<string>} the file:// uri that was shared
 * @throws if the device can't share (caller surfaces the message)
 */
export async function writeAndShareExport({ content, format, rangeLabel }) {
  const meta = FORMAT_META[format] || FORMAT_META.txt;
  const fileName = buildFileName(format, rangeLabel);

  const file = new File(Paths.cache, fileName);
  // A same-name export from earlier today would otherwise make create() throw.
  try {
    if (file.exists) file.delete();
  } catch {
    // best-effort cleanup; write below is the real failure surface
  }
  file.create();
  file.write(content);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    // Android: generic doc type so strict receivers (Messenger) attach the file
    // instead of dropping it as message text. iOS: precise per-format UTI.
    mimeType: Platform.OS === 'android' ? ANDROID_SHARE_MIME : meta.mimeType,
    UTI: meta.uti,
    dialogTitle: 'Export GaFi expenses',
  });
  return file.uri;
}
