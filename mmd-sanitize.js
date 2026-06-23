#!/usr/bin/env node
'use strict';
// Repair the most common mistakes LLMs make in Mermaid source so it renders instead of erroring:
//   1. literal "\n" or real newlines inside a node label -> <br/>
//   2. unquoted node-shape labels -> double-quoted (handles ( ) / : . & etc.)
//   3. unquoted `subgraph id [Title]` / `subgraph Title` titles
// Reads stdin, writes sanitized Mermaid to stdout. Conservative: only rewrites node-shape tokens and
// subgraph titles; leaves arrows, classDef, class, style, and directives untouched.
let src = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (src += d));
process.stdin.on('end', () => {
  // Join backslash line-continuations (LLMs split labels like `P[Policy]\` <newline> `(detail)`).
  src = src.replace(/\\[ \t]*\r?\n/g, ' ');
  const lines = src.split('\n').map((line) => {
    // Leave subgraph lines untouched — `subgraph ID[Title]` and `subgraph Title` render fine as-is,
    // and quoting them would show literal quotes in the title.
    if (/^\s*subgraph\b/.test(line)) return line;
    // Merge a node bracket immediately followed by a parenthetical into one label:
    //   `P[Policy & Tests] (ISO 42001)` / `P[Policy](ISO 42001)` -> `P[Policy & Tests ISO 42001]`
    line = line.replace(/([A-Za-z0-9_]+)\[([^\]]*)\]\s*\(([^)]*)\)/g, (full, id, a, b) =>
      `${id}[${a.trim()} ${b.trim()}]`);
    return quoteNodes(line);
  });
  process.stdout.write(lines.join('\n'));
});

function clean(s) {
  return s
    .replace(/\\n/g, '<br/>')          // literal backslash-n
    .replace(/[\r\n]+/g, '<br/>')      // real newlines
    .replace(/"/g, '&quot;')           // stray quotes
    .trim();
}

// Per-shape passes, COMPOUND delimiters first so e.g. `[(`...`)]` (cylinder) is quoted before the
// simple `[`...`]`. Each open is paired with its OWN close, and the label is "anything up to that
// close char", so an inner `)` inside a `[ ]` label (e.g. "Agent (LangGraph)") doesn't end it early.
// Skip any label that already contains a quote → a compound shape quoted on an earlier pass is not
// re-processed by a later simple pass.
const SHAPES = [
  ['([', '])'], ['[(', ')]'], ['[[', ']]'], ['((', '))'], ['{{', '}}'],
  ['[', ']'], ['(', ')'], ['{', '}'],
];
function quoteNodes(line) {
  for (const [open, close] of SHAPES) {
    const lastCloseChar = close[close.length - 1];
    const re = new RegExp(`([A-Za-z0-9_]+)${esc(open)}([^${esc(lastCloseChar)}]*?)${esc(close)}`, 'g');
    line = line.replace(re, (full, id, label) => {
      if (label === '' || label.includes('"')) return full;
      return `${id}${open}"${clean(label)}"${close}`;
    });
  }
  return line;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
