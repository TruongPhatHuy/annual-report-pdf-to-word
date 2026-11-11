import { InconsistentTableIssue, ValidationReport } from '../types';

/**
 * Parses markdown and generates a structured validation report
 */
export function generateValidationReport(
  markdown: string,
  totalPages: number,
  fileName: string,
  modelUsed: string
): ValidationReport {
  // 1. Pages covered & missing
  const pageMarkerRegex = /<!--\s*page:\s*(\d+)\s*-->/gi;
  const coveredSet = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = pageMarkerRegex.exec(markdown)) !== null) {
    const p = parseInt(match[1], 10);
    if (!isNaN(p)) {
      coveredSet.add(p);
    }
  }

  const coveredPages = Array.from(coveredSet).sort((a, b) => a - b);
  const missingPages: number[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (!coveredSet.has(i)) {
      missingPages.push(i);
    }
  }

  // 2. Tables & inconsistencies
  const lines = markdown.split('\n');
  let currentTableHeaders: string[] | null = null;
  let currentTableHeaderCols = 0;
  let currentTableIndex = 0;
  let currentTableStartLine = 0;
  let currentPage = 1;

  let totalTableCount = 0;
  const inconsistentTables: InconsistentTableIssue[] = [];

  let inTable = false;
  let currentIssue: InconsistentTableIssue | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check page marker
    const pageCheck = /^<!--\s*page:\s*(\d+)\s*-->$/i.exec(line);
    if (pageCheck) {
      currentPage = parseInt(pageCheck[1], 10);
      continue;
    }

    const isRow = line.startsWith('|') && line.endsWith('|') && line.includes('|');
    const isSep = isRow && line.slice(1, -1).split('|').every((c) => /^\s*:?-+:?\s*$/.test(c));

    if (isRow) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());

      if (!inTable) {
        // Potential table start
        // Peek next line for separator
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const nextIsRow = nextLine.startsWith('|') && nextLine.endsWith('|');
          const nextIsSep = nextIsRow && nextLine.slice(1, -1).split('|').every((c) => /^\s*:?-+:?\s*$/.test(c));

          if (nextIsSep) {
            inTable = true;
            totalTableCount++;
            currentTableIndex++;
            currentTableHeaders = cells;
            currentTableHeaderCols = cells.length;
            currentTableStartLine = i;
            currentIssue = null;
            continue;
          }
        }
      } else {
        // Already in table
        if (isSep) {
          // Separator row, skip cell comparison
          continue;
        }

        // Check row cell count
        if (currentTableHeaderCols > 0 && cells.length !== currentTableHeaderCols) {
          if (!currentIssue) {
            currentIssue = {
              pageNumber: currentPage,
              tableIndex: currentTableIndex,
              headerColumnCount: currentTableHeaderCols,
              rowDiscrepancies: [],
            };
          }
          currentIssue.rowDiscrepancies.push({
            rowIndex: i - currentTableStartLine,
            cellsFound: cells.length,
            expectedCells: currentTableHeaderCols,
            snippet: line.slice(0, 80),
          });
        }
      }
    } else {
      // Line is not a table row
      if (inTable) {
        if (currentIssue && currentIssue.rowDiscrepancies.length > 0) {
          inconsistentTables.push(currentIssue);
        }
        inTable = false;
        currentIssue = null;
        currentTableHeaders = null;
        currentTableHeaderCols = 0;
      }
    }
  }

  // Flush table if file ended inside table
  if (inTable && currentIssue && currentIssue.rowDiscrepancies.length > 0) {
    inconsistentTables.push(currentIssue);
  }

  // 3. Count estimated chart values "~"
  // Look for cells or words starting with ~ (e.g. ~15, ~12.5%, ~$3.2M, ~1,500)
  const estimatedMatches = markdown.match(/~\s*[\d$€£¥VND]+/g) || [];
  const estimatedValuesCount = estimatedMatches.length;

  // 4. Count "N/A" values (in tables or text)
  const naMatches = markdown.match(/\bN\/A\b|\bNA\b|\bn\/a\b/g) || [];
  const naValuesCount = naMatches.length;

  return {
    totalPages,
    coveredPagesCount: coveredPages.length,
    coveredPages,
    missingPages,
    tableCount: totalTableCount,
    inconsistentTables,
    estimatedValuesCount,
    naValuesCount,
    totalPageMarkersCount: coveredPages.length,
    timestamp: new Date().toISOString(),
    fileName,
    modelUsed,
  };
}
