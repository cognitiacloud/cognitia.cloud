#!/usr/bin/env node
// Zero-dependency Markdown -> PDF renderer (no browser, no npm install).
//
// Deliberately dependency-free so it can run in locked-down CI / web sessions
// where pandoc/chromium/latex are unavailable. It renders a pragmatic subset of
// Markdown (headings, paragraphs, bullet/numbered lists, blockquotes, code
// fences, tables, horizontal rules) to a valid multi-page PDF using the PDF
// standard-14 fonts (Helvetica / Helvetica-Bold / Helvetica-Oblique / Courier),
// so no font embedding is needed. Styling is intentionally plain but reliable.
//
// Usage: node scripts/pdf/render-md-pdf.mjs <input.md> <output.pdf> [--title "..."]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ---- Helvetica AFM glyph widths (units / 1000) for ASCII 32..126 ----------
// Canonical Adobe Helvetica widths; lets us wrap text accurately.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const charWidth = (code, size) => {
  const w = code >= 32 && code <= 126 ? HELV[code - 32] : 556;
  return (w / 1000) * size;
};
const textWidth = (str, size) => {
  let w = 0;
  for (let i = 0; i < str.length; i++) w += charWidth(str.charCodeAt(i), size);
  return w;
};

// ---- Normalize unicode the standard fonts can't encode -> ASCII ------------
const asciiize = (s) =>
  s
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/×/g, 'x')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/✅/g, '[x]')
    .replace(/❌/g, '[ ]')
    .replace(/❓/g, '[?]')
    .replace(/⚠[️]?/g, '(!)')
    .replace(/\u{1F7E2}/gu, '(green)')
    .replace(/\u{1F7E1}/gu, '(amber)')
    .replace(/\u{1F534}/gu, '(red)')
    .replace(/[^\x09\x0a\x20-\x7e]/g, '');

// Strip inline markdown markers we don't style (keep the text).
const stripInline = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*/g, '$1$2');

const escPdf = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// ---- Page / layout constants ----------------------------------------------
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 56;
const MARGIN_BOT = 54;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const LEADING = 1.32;

const F = { body: 'F1', bold: 'F2', ital: 'F3', mono: 'F4' };

// ---- Block parser ----------------------------------------------------------
function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lines: code });
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      blocks.push({ type: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }
    const b = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (b) {
      flushPara();
      const indent = Math.floor(b[1].length / 2);
      const ordered = /\d/.test(b[2]);
      blocks.push({ type: 'li', indent, ordered, marker: b[2], text: b[3] });
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      blocks.push({ type: 'quote', text: line.replace(/^\s*>\s?/, '') });
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return blocks;
}

// ---- Word-wrap helper ------------------------------------------------------
function wrap(text, size, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const word of words) {
    let w = word;
    // hard-break words longer than the line
    while (textWidth(w, size) > maxW && w.length > 1) {
      let cut = w.length;
      while (cut > 1 && textWidth(w.slice(0, cut), size) > maxW) cut--;
      if (cur) {
        out.push(cur);
        cur = '';
      }
      out.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, size) > maxW && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

// ---- Renderer: blocks -> pages of draw ops ---------------------------------
function layout(blocks) {
  const pages = [];
  let ops = [];
  let y = PAGE_H - MARGIN_TOP;
  const newPage = () => {
    pages.push(ops);
    ops = [];
    y = PAGE_H - MARGIN_TOP;
  };
  const need = (h) => {
    if (y - h < MARGIN_BOT) newPage();
  };
  const emit = (font, size, x, text) => {
    ops.push({ font, size, x, y, text: escPdf(asciiize(text)) });
  };
  const line = (font, size, x, text) => {
    need(size * LEADING);
    emit(font, size, x, text);
    y -= size * LEADING;
  };

  for (const blk of blocks) {
    if (blk.type === 'h') {
      const sizes = { 1: 20, 2: 15, 3: 12.5, 4: 11, 5: 10.5, 6: 10 };
      const size = sizes[blk.level] || 11;
      y -= (blk.level <= 2 ? 10 : 6);
      need(size * LEADING + 4);
      for (const ln of wrap(stripInline(blk.text), size, CONTENT_W)) line(F.bold, size, MARGIN_X, ln);
      if (blk.level === 1) {
        // underline rule
        need(2);
        ops.push({ rule: true, x1: MARGIN_X, x2: PAGE_W - MARGIN_X, y: y + 6 });
      }
      y -= 3;
    } else if (blk.type === 'p') {
      const size = 9.6;
      for (const ln of wrap(stripInline(blk.text), size, CONTENT_W)) line(F.body, size, MARGIN_X, ln);
      y -= 3;
    } else if (blk.type === 'li') {
      const size = 9.6;
      const x = MARGIN_X + 14 + blk.indent * 16;
      const bullet = blk.ordered ? blk.marker.replace(/[)]/, '.') : '-';
      const wrapped = wrap(stripInline(blk.text), size, CONTENT_W - (x - MARGIN_X) - 4);
      need(size * LEADING);
      emit(F.body, size, x - 12, bullet);
      emit(F.body, size, x, wrapped[0]);
      y -= size * LEADING;
      for (let k = 1; k < wrapped.length; k++) line(F.body, size, x, wrapped[k]);
    } else if (blk.type === 'quote') {
      const size = 9.4;
      for (const ln of wrap(stripInline(blk.text), size, CONTENT_W - 14))
        line(F.ital, size, MARGIN_X + 14, ln);
      y -= 2;
    } else if (blk.type === 'code') {
      const size = 8.2;
      y -= 2;
      for (const raw of blk.lines) {
        const t = raw.replace(/\t/g, '  ');
        // hard-wrap monospace by char budget
        const budget = Math.floor(CONTENT_W / (size * 0.6));
        if (t.length <= budget) {
          line(F.mono, size, MARGIN_X + 4, t);
        } else {
          for (let p = 0; p < t.length; p += budget) line(F.mono, size, MARGIN_X + 4, t.slice(p, p + budget));
        }
      }
      y -= 3;
    } else if (blk.type === 'hr') {
      need(8);
      ops.push({ rule: true, x1: MARGIN_X, x2: PAGE_W - MARGIN_X, y: y - 2 });
      y -= 10;
    } else if (blk.type === 'table') {
      const rows = blk.rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
      const ncol = Math.max(...blk.rows.map((r) => r.length));
      const widths = new Array(ncol).fill(3);
      for (const r of rows)
        for (let c = 0; c < ncol; c++) widths[c] = Math.max(widths[c], asciiize(stripInline(r[c] || '')).length);
      const size = 8;
      const colChars = Math.floor(CONTENT_W / (size * 0.6));
      const total = widths.reduce((a, b) => a + b + 1, 0);
      if (total > colChars) {
        const scale = colChars / total;
        for (let c = 0; c < ncol; c++) widths[c] = Math.max(3, Math.floor(widths[c] * scale));
      }
      y -= 2;
      rows.forEach((r, ri) => {
        let s = '';
        for (let c = 0; c < ncol; c++) {
          let cell = asciiize(stripInline(r[c] || ''));
          if (cell.length > widths[c]) cell = cell.slice(0, widths[c]);
          s += cell.padEnd(widths[c] + 1, ' ');
        }
        line(ri === 0 ? F.bold : F.mono, size, MARGIN_X + 2, s);
        if (ri === 0) {
          ops.push({ rule: true, x1: MARGIN_X, x2: PAGE_W - MARGIN_X, y: y + 4 });
        }
      });
      y -= 4;
    }
  }
  pages.push(ops);
  return pages;
}

// ---- PDF assembly ----------------------------------------------------------
function buildPdf(pages, title) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };
  // reserve: 1 catalog, 2 pages tree -> fill later
  objects.push(null); // 1 catalog
  objects.push(null); // 2 pages
  const fontObjs = {
    F1: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    F2: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    F3: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'),
    F4: add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'),
  };
  const fontDict =
    `<< ${Object.entries(fontObjs).map(([k, n]) => `/${k} ${n} 0 R`).join(' ')} >>`;

  const pageObjNums = [];
  pages.forEach((ops, idx) => {
    let stream = '';
    for (const op of ops) {
      if (op.rule) {
        stream += `0.6 w 0.5 0.5 0.5 RG ${op.x1.toFixed(1)} ${op.y.toFixed(1)} m ${op.x2.toFixed(
          1,
        )} ${op.y.toFixed(1)} l S\n`;
        continue;
      }
      stream += `BT /${op.font} ${op.size} Tf 0 0 0 rg 1 0 0 1 ${op.x.toFixed(1)} ${op.y.toFixed(
        1,
      )} Tm (${op.text}) Tj ET\n`;
    }
    // footer: page number
    const footer = `Cognitia / Demandara Master Execution Report   -   page ${idx + 1} of ${pages.length}`;
    stream += `BT /F4 7.5 Tf 0.45 0.45 0.45 rg 1 0 0 1 ${MARGIN_X} 30 Tm (${escPdf(
      asciiize(footer),
    )}) Tj ET\n`;
    const contentNum = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`);
    const pageNum = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font ${fontDict} >> /Contents ${contentNum} 0 R >>`,
    );
    pageObjNums.push(pageNum);
  });

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageObjNums
    .map((n) => `${n} 0 R`)
    .join(' ')} ] >>`;

  // serialize
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escPdf(
    asciiize(title),
  )}) >> >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

// ---- main ------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const titleIdx = args.indexOf('--title');
  let title = 'Cognitia / Demandara Master Execution Report';
  if (titleIdx !== -1) {
    title = args[titleIdx + 1];
    args.splice(titleIdx, 2);
  }
  const [input, output] = args;
  if (!input || !output) {
    console.error('Usage: node scripts/pdf/render-md-pdf.mjs <input.md> <output.pdf> [--title "..."]');
    process.exit(1);
  }
  const md = readFileSync(input, 'utf8');
  const blocks = parseBlocks(md);
  const pages = layout(blocks);
  const pdf = buildPdf(pages, title);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, pdf);
  console.log(`Wrote ${output} (${pdf.length} bytes, ${pages.length} pages, ${blocks.length} blocks)`);
}

main();
