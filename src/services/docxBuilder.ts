import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  Packer,
  ShadingType,
  VerticalAlign,
  TableLayoutType,
} from 'docx';
import { marked, Token, Tokens } from 'marked';
import { saveAs } from 'file-saver';

export interface DocxOptions {
  title?: string;
  includePageMarkers?: boolean;
}

const COLOR_PRIMARY = '0F172A'; // Slate-900
const COLOR_SECONDARY = '334155'; // Slate-700
const COLOR_MUTED = '64748B'; // Slate-500
const COLOR_BORDER = 'CBD5E1'; // Slate-300
const COLOR_HEADER_BG = 'F1F5F9'; // Slate-100
const COLOR_ROW_ALT = 'F8FAFC'; // Slate-50

/**
 * Recursively converts marked inline tokens into docx TextRun instances (Ép Times New Roman, size 10pt)
 */
function convertInlineTokens(
  tokens: Token[] | undefined,
  baseStyle: {
    bold?: boolean;
    italics?: boolean;
    font?: string;
    size?: number; // in half-points (20 = 10pt)
    color?: string;
  } = {}
): TextRun[] {
  if (!tokens || tokens.length === 0) return [];

  const runs: TextRun[] = [];

  for (const token of tokens) {
    const bold = baseStyle.bold || token.type === 'strong';
    const italics = baseStyle.italics || token.type === 'em';
    const font = baseStyle.font || 'Times New Roman'; // Ép chuẩn Times New Roman
    const size = baseStyle.size || 20; // Ép chuẩn size 10pt (20 half-points)
    const color = baseStyle.color || COLOR_PRIMARY;

    if (token.type === 'text') {
      const textToken = token as Tokens.Text;
      if (textToken.tokens && textToken.tokens.length > 0) {
        runs.push(...convertInlineTokens(textToken.tokens, { ...baseStyle, bold, italics, font, size }));
      } else {
        runs.push(
          new TextRun({
            text: textToken.text,
            bold,
            italics,
            font,
            size,
            color,
          })
        );
      }
    } else if (token.type === 'strong') {
      const strongToken = token as Tokens.Strong;
      runs.push(
        ...convertInlineTokens(strongToken.tokens, {
          ...baseStyle,
          bold: true,
          italics,
          font,
          size,
          color,
        })
      );
    } else if (token.type === 'em') {
      const emToken = token as Tokens.Em;
      runs.push(
        ...convertInlineTokens(emToken.tokens, {
          ...baseStyle,
          bold,
          italics: true,
          font,
          size,
          color,
        })
      );
    } else if (token.type === 'codespan') {
      const codeToken = token as Tokens.Codespan;
      runs.push(
        new TextRun({
          text: codeToken.text,
          font: 'Times New Roman',
          size: 20, // Ép size 10pt
          color: '991B1B', // Dark red
          highlight: 'yellow',
        })
      );
    } else if (token.type === 'link') {
      const linkToken = token as Tokens.Link;
      runs.push(
        new TextRun({
          text: linkToken.text,
          bold,
          italics,
          color: '2563EB', // Blue link
          underline: {},
          font,
          size,
        })
      );
    } else if (token.type === 'br') {
      runs.push(new TextRun({ text: '\n', font, size }));
    } else if ('text' in token && typeof (token as any).text === 'string') {
      runs.push(
        new TextRun({
          text: (token as any).text,
          bold,
          italics,
          font,
          size,
          color,
        })
      );
    }
  }

  return runs;
}

/**
 * Creates table cell borders
 */
function getCellBorders() {
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: COLOR_BORDER,
  };
  return {
    top: border,
    bottom: border,
    left: border,
    right: border,
  };
}

/**
 * Converts a markdown table token into a native docx Table (Ép size 10pt / Times New Roman)
 */
function buildDocxTable(tableToken: Tokens.Table): Table {
  const headerCols = tableToken.header.length;
  const maxCols = Math.max(
    headerCols,
    ...tableToken.rows.map((row) => row.length)
  );

  const fontSize = 20; // Cố định 10pt (20 half-points)
  const cellPadding = { top: 100, bottom: 100, left: 140, right: 140 };

  const tableRows: TableRow[] = [];

  // Header row
  const headerCells: TableCell[] = [];
  for (let c = 0; c < maxCols; c++) {
    const cellToken = tableToken.header[c];
    const cellRuns = cellToken
      ? convertInlineTokens(cellToken.tokens, {
          bold: true,
          size: fontSize,
          font: 'Times New Roman',
          color: COLOR_PRIMARY,
        })
      : [new TextRun({ text: '', size: fontSize, font: 'Times New Roman' })];

    headerCells.push(
      new TableCell({
        children: [
          new Paragraph({
            children: cellRuns,
            alignment: AlignmentType.LEFT,
            spacing: { before: 30, after: 30 },
          }),
        ],
        shading: {
          type: ShadingType.CLEAR,
          fill: COLOR_HEADER_BG,
        },
        borders: getCellBorders(),
        verticalAlign: VerticalAlign.CENTER,
        margins: cellPadding,
      })
    );
  }

  tableRows.push(
    new TableRow({
      children: headerCells,
      tableHeader: true,
      cantSplit: true,
    })
  );

  // Data rows
  tableToken.rows.forEach((row, rowIndex) => {
    const rowCells: TableCell[] = [];
    const isAlt = rowIndex % 2 === 1;

    for (let c = 0; c < maxCols; c++) {
      const cellToken = row[c];
      const cellRuns = cellToken
        ? convertInlineTokens(cellToken.tokens, {
            bold: false,
            size: fontSize,
            font: 'Times New Roman',
            color: COLOR_SECONDARY,
          })
        : [new TextRun({ text: '', size: fontSize, font: 'Times New Roman' })];

      rowCells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: cellRuns,
              alignment: AlignmentType.LEFT,
              spacing: { before: 30, after: 30 },
            }),
          ],
          shading: isAlt
            ? {
                type: ShadingType.CLEAR,
                fill: COLOR_ROW_ALT,
              }
            : undefined,
          borders: getCellBorders(),
          verticalAlign: VerticalAlign.CENTER,
          margins: cellPadding,
        })
      );
    }

    tableRows.push(
      new TableRow({
        children: rowCells,
        cantSplit: true,
      })
    );
  });

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    layout: TableLayoutType.AUTOFIT,
  });
}

/**
 * Builds a docx Document from structured Markdown using marked lexer tokens
 */
export async function buildDocxFromMarkdown(
  markdown: string,
  options: DocxOptions = {}
): Promise<Blob> {
  const includePageMarkers = options.includePageMarkers ?? true;
  const tokens = marked.lexer(markdown);
  const docElements: Array<Paragraph | Table> = [];

  for (const token of tokens) {
    if (token.type === 'heading') {
      const headingToken = token as Tokens.Heading;
      
      // Ép toàn bộ Heading về chung size 10pt (20 half-points) và Times New Roman, in đậm
      const runs = convertInlineTokens(headingToken.tokens, {
        bold: true,
        font: 'Times New Roman',
        size: 20, // 10pt
        color: COLOR_PRIMARY,
      });

      docElements.push(
        new Paragraph({
          children: runs,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (token.type === 'paragraph') {
      const pToken = token as Tokens.Paragraph;
      const rawText = pToken.text.trim();

      // Check if this paragraph contains a page marker <!-- page: N -->
      const pageMarkerMatch = /^<!--\s*page:\s*(\d+)\s*-->$/i.exec(rawText);
      if (pageMarkerMatch) {
        if (includePageMarkers) {
          const pageNum = pageMarkerMatch[1];
          docElements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.LEFT,
              spacing: { before: 300, after: 100 },
              children: [
                new TextRun({
                  text: `Trang PDF ${pageNum}`,
                  font: 'Times New Roman', // Đã chuyển sang Times New Roman
                  color: '00BFFF',
                  size: 20,                // Ép size 10pt luôn
                  bold: true,
                }),
              ],
            })
          );
        }
        continue;
      }

      const runs = convertInlineTokens(pToken.tokens, {
        font: 'Times New Roman', 
        size: 20, // 10pt
        color: COLOR_SECONDARY,
      });

      docElements.push(
        new Paragraph({
          children: runs,
          alignment: AlignmentType.JUSTIFIED, // Căn đều 2 bên
          spacing: { before: 60, after: 100, line: 276 }, 
        })
      );
    } else if (token.type === 'table') {
      const table = buildDocxTable(token as Tokens.Table);
      docElements.push(table);
      docElements.push(new Paragraph({ spacing: { after: 140 } }));
    } else if (token.type === 'list') {
      const listToken = token as Tokens.List;
      listToken.items.forEach((item, index) => {
        const itemRuns = convertInlineTokens(item.tokens, {
          font: 'Times New Roman',
          size: 20, // 10pt
          color: COLOR_SECONDARY,
        });

        docElements.push(
          new Paragraph({
            children: itemRuns,
            alignment: AlignmentType.JUSTIFIED,
            bullet: listToken.ordered ? undefined : { level: 0 },
            numbering: listToken.ordered
              ? {
                  reference: 'default-numbering',
                  level: 0,
                  instance: index + 1,
                }
              : undefined,
            spacing: { before: 40, after: 40 },
          })
        );
      });
      docElements.push(new Paragraph({ spacing: { after: 80 } }));
    } else if (token.type === 'blockquote') {
      const bqToken = token as Tokens.Blockquote;
      const bqRuns = convertInlineTokens(bqToken.tokens, {
        font: 'Times New Roman',
        size: 20, // 10pt
        italics: true,
        color: COLOR_MUTED,
      });

      docElements.push(
        new Paragraph({
          children: bqRuns,
          indent: { left: 720 },
          spacing: { before: 100, after: 100 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 12,
              color: '3B82F6',
            },
          },
        })
      );
    } else if (token.type === 'hr') {
      docElements.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: COLOR_BORDER,
            },
          },
          spacing: { before: 180, after: 180 },
        })
      );
    } else if (token.type === 'html') {
      const rawHtml = token.raw.trim();
      const pageMatch = /^<!--\s*page:\s*(\d+)\s*-->$/i.exec(rawHtml);
      if (pageMatch && includePageMarkers) {
        docElements.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { before: 300, after: 100 },
            children: [
              new TextRun({
                text: `Trang PDF ${pageMatch[1]}`,
                font: 'Times New Roman',
                size: 20, // 10pt
                color: '00BFFF',
                bold: true,
              }),
            ],
          })
        );
      }
    }
  }

  // Create docx Document configured for A4 portrait with 2cm (1134 twips) margins
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips (210mm)
              height: 16838, // A4 height in twips (297mm)
            },
            margin: {
              top: 1134, // 2 cm = 1134 twips
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        children: docElements.length > 0 ? docElements : [new Paragraph({ text: 'Tài liệu trống' })],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Helper to download generated document
 */
export async function downloadDocx(
  markdown: string,
  fileName: string,
  options: DocxOptions = {}
): Promise<void> {
  const blob = await buildDocxFromMarkdown(markdown, options);
  const targetName = fileName.replace(/\.pdf$/i, '') + '.docx';
  saveAs(blob, targetName);
}