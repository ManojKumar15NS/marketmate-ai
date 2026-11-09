import JSZip from 'jszip';

export async function generateDocxBuffer(title: string, markdownContent: string): Promise<Buffer> {
  const zip = new JSZip();

  // Content Types
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // Relationships
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const escapeXml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const rawBlocks = markdownContent.split(/\n\n+/).filter(b => b.trim().length > 0);

  const paragraphsXml = rawBlocks.map(block => {
    const trimmed = block.trim();

    if (trimmed.startsWith('# ')) {
      const heading = escapeXml(trimmed.replace(/^#\s+/, ''));
      return `<w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${heading}</w:t></w:r>
      </w:p>`;
    }
    if (trimmed.startsWith('## ')) {
      const heading = escapeXml(trimmed.replace(/^##\s+/, ''));
      return `<w:p>
        <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:t>${heading}</w:t></w:r>
      </w:p>`;
    }
    if (trimmed.startsWith('### ')) {
      const heading = escapeXml(trimmed.replace(/^###\s+/, ''));
      return `<w:p>
        <w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>${heading}</w:t></w:r>
      </w:p>`;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split('\n').filter(i => i.trim().length > 0);
      return items.map(item => {
        const text = escapeXml(item.replace(/^[-*]\s+/, ''));
        return `<w:p>
          <w:r><w:t>• ${text}</w:t></w:r>
        </w:p>`;
      }).join('');
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed.split('\n').filter(i => i.trim().length > 0);
      return items.map(item => {
        const text = escapeXml(item.trim());
        return `<w:p>
          <w:r><w:t>${text}</w:t></w:r>
        </w:p>`;
      }).join('');
    }

    // Standard paragraph with lines
    const lines = trimmed.split('\n').map(l => escapeXml(l.trim())).join(' ');
    return `<w:p>
      <w:r><w:t>${lines}</w:t></w:r>
    </w:p>`;
  }).join('');

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>
    ${paragraphsXml}
  </w:body>
</w:document>`);

  return zip.generateAsync({ type: 'nodebuffer' });
}
