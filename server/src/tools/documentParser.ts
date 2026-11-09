import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import * as pdfModule from 'pdf-parse';

export interface ParsedDocument {
  filename: string;
  fileType: string;
  sizeBytes: number;
  extractedText: string;
  wordCount: number;
  characterCount: number;
  metadata?: Record<string, any>;
}

export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ParsedDocument> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  let extractedText = '';
  const metadata: Record<string, any> = {};

  try {
    if (ext === 'pdf' || mimetype === 'application/pdf') {
      try {
        const PDFParseClass = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;
        if (PDFParseClass) {
          const parser = new PDFParseClass({ data: buffer });
          const textResult = await parser.getText();
          extractedText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
        } else if (typeof pdfModule === 'function') {
          const res = await (pdfModule as any)(buffer);
          extractedText = res.text || '';
        }
      } catch (pdfErr: any) {
        // Fallback simple string extraction for text-based PDFs
        extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      }
    } else if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || '';
      if (result.messages && result.messages.length > 0) {
        metadata.warnings = result.messages.map(m => m.message);
      }
    } else if (ext === 'xlsx' || ext === 'xls' || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const rows: string[] = [];

      workbook.eachSheet((worksheet, sheetId) => {
        rows.push(`--- Sheet: ${worksheet.name} ---`);
        worksheet.eachRow((row, rowNumber) => {
          const values = (row.values as any[])
            .filter(v => v !== undefined && v !== null)
            .map(v => typeof v === 'object' && v.text ? v.text : String(v));
          if (values.length > 0) {
            rows.push(values.join(' | '));
          }
        });
      });
      extractedText = rows.join('\n');
      metadata.sheetCount = workbook.worksheets.length;
    } else if (ext === 'csv' || mimetype === 'text/csv') {
      extractedText = buffer.toString('utf-8');
      metadata.lineCount = extractedText.split('\n').length;
    } else {
      // Plain text, markdown, json, etc.
      extractedText = buffer.toString('utf-8');
    }
  } catch (parseError: any) {
    throw new Error(`Failed to parse document ${filename}: ${parseError.message}`);
  }

  const cleanText = extractedText.trim();
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);

  return {
    filename,
    fileType: ext || mimetype,
    sizeBytes: buffer.length,
    extractedText: cleanText,
    wordCount: words.length,
    characterCount: cleanText.length,
    metadata
  };
}
