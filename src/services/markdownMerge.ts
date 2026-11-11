import { PdfChunk } from '../types';

/**
 * Strips accidental markdown code fences ```markdown ... ``` or ``` ... ```
 */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*\n?/, '');
  } else if (cleaned.startsWith('```md')) {
    cleaned = cleaned.replace(/^```md\s*\n?/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*\n?/, '');
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

/**
 * Checks if a string line is a markdown table row (starts and ends with | or contains |)
 */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

/**
 * Checks if a line is a markdown table separator line (e.g., | --- | :---: | ---: |)
 */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) return false;
  const inner = trimmed.slice(1, -1);
  const cells = inner.split('|');
  return cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

/**
 * Counts cells in a markdown table row
 */
function countRowCells(line: string): number {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return 0;
  return trimmed.slice(1, -1).split('|').length;
}

/**
 * Stitches table across chunk boundaries if chunk A ends with a table
 * and chunk B begins with a table of identical column count.
 */
export function stitchTablesAcrossChunks(chunkA: string, chunkB: string): string {
  const linesA = chunkA.split('\n');
  const linesB = chunkB.split('\n');

  // Find trailing non-empty lines of A
  let lastNonEmptyA = linesA.length - 1;
  while (lastNonEmptyA >= 0 && linesA[lastNonEmptyA].trim() === '') {
    lastNonEmptyA--;
  }

  if (lastNonEmptyA < 0) {
    return chunkA + '\n\n' + chunkB;
  }

  // Check if chunk A ends with table rows
  if (!isTableRow(linesA[lastNonEmptyA])) {
    return chunkA + '\n\n' + chunkB;
  }

  const colCountA = countRowCells(linesA[lastNonEmptyA]);
  if (colCountA <= 1) {
    return chunkA + '\n\n' + chunkB;
  }

  // Find leading content in chunk B (skipping initial page markers or blank lines)
  let idxB = 0;
  const pageMarkersInB: string[] = [];
  while (idxB < linesB.length) {
    const line = linesB[idxB].trim();
    if (line === '') {
      idxB++;
      continue;
    }
    if (/^<!--\s*page:\s*\d+\s*-->$/i.test(line)) {
      pageMarkersInB.push(line);
      idxB++;
      continue;
    }
    break;
  }

  if (idxB >= linesB.length) {
    return chunkA + '\n\n' + chunkB;
  }

  // Check if B begins with a table
  if (!isTableRow(linesB[idxB])) {
    return chunkA + '\n\n' + chunkB;
  }

  const colCountB = countRowCells(linesB[idxB]);
  if (colCountB !== colCountA) {
    return chunkA + '\n\n' + chunkB;
  }

  // Check if chunk B starts with a repeated header row + separator row
  let startRowB = idxB;
  if (idxB + 1 < linesB.length && isTableSeparator(linesB[idxB + 1])) {
    // linesB[idxB] is header, linesB[idxB + 1] is separator
    // Skip them because chunk A already has the header
    startRowB = idxB + 2;
  }

  // Build the stitched content:
  // Chunk A lines up to lastNonEmptyA
  const contentA = linesA.slice(0, lastNonEmptyA + 1).join('\n');
  // If there were page markers at the start of B, we can either keep them right after the table or preserve
  // To keep valid markdown table format without breaking the table in Word, we can continue table rows
  const remainingRowsB: string[] = [];
  let postTableBIdx = startRowB;

  while (postTableBIdx < linesB.length) {
    const line = linesB[postTableBIdx];
    if (isTableRow(line)) {
      remainingRowsB.push(line);
      postTableBIdx++;
    } else {
      break;
    }
  }

  const restOfB = linesB.slice(postTableBIdx).join('\n');
  const pageMarkersStr = pageMarkersInB.length > 0 ? '\n' + pageMarkersInB.join('\n') + '\n' : '';

  // Merge table rows directly
  if (remainingRowsB.length > 0) {
    const mergedTable = contentA + '\n' + remainingRowsB.join('\n');
    return mergedTable + (pageMarkersStr ? pageMarkersStr : '\n\n') + restOfB;
  }

  return chunkA + '\n\n' + chunkB;
}

/**
 * Merges all completed chunks in ascending startPage order,
 * cleans fences and stitches cross-chunk tables.
 */
export function mergeAllChunks(chunks: PdfChunk[]): string {
  const sorted = [...chunks]
    .filter((c) => c.status === 'done' || (c.markdown && c.markdown.trim().length > 0))
    .sort((a, b) => a.startPage - b.startPage);

  if (sorted.length === 0) return '';

  let merged = stripCodeFences(sorted[0].markdown);

  for (let i = 1; i < sorted.length; i++) {
    const nextChunkClean = stripCodeFences(sorted[i].markdown);
    if (!nextChunkClean) continue;
    merged = stitchTablesAcrossChunks(merged, nextChunkClean);
  }

  return merged.trim();
}

/**
 * Splits a full markdown string into pages based on `<!-- page: N -->` markers.
 * Returns a map of pageNumber -> markdown content for that page.
 */
export function splitMarkdownIntoPages(markdown: string): Map<number, string> {
  const pageMap = new Map<number, string>();
  const pageRegex = /<!--\s*page:\s*(\d+)\s*-->/gi;

  const matches: Array<{ pageNum: number; index: number; markerLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = pageRegex.exec(markdown)) !== null) {
    matches.push({
      pageNum: parseInt(match[1], 10),
      index: match.index,
      markerLength: match[0].length,
    });
  }

  if (matches.length === 0) {
    pageMap.set(1, markdown);
    return pageMap;
  }

  // Text before first marker
  if (matches[0].index > 0) {
    const preamble = markdown.substring(0, matches[0].index).trim();
    if (preamble) {
      pageMap.set(0, preamble);
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const pageContent = markdown.substring(startIndex, endIndex).trim();
    pageMap.set(current.pageNum, pageContent);
  }

  return pageMap;
}

/**
 * Replaces or updates the markdown for a specific page inside the full document markdown
 */
export function updatePageInMergedMarkdown(
  originalMergedMarkdown: string,
  targetPageNum: number,
  newPageContent: string
): string {
  const pageMap = splitMarkdownIntoPages(originalMergedMarkdown);
  pageMap.set(targetPageNum, newPageContent.trim());

  // Rebuild in sorted page order
  const sortedPages = Array.from(pageMap.keys()).sort((a, b) => a - b);
  return sortedPages.map((p) => pageMap.get(p)).filter(Boolean).join('\n\n').trim();
}
