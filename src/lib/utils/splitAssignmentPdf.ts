import { PDFDocument } from 'pdf-lib';

export async function splitAssignmentPdf(
  src: ArrayBuffer,
  colorPages: number[]
): Promise<{ bwBytes: Uint8Array; colorBytes: Uint8Array }> {
  const srcDoc = await PDFDocument.load(src);
  const total = srcDoc.getPageCount();
  const colorSet = new Set(colorPages.filter((p) => p >= 1 && p <= total));

  const bwDoc = await PDFDocument.create();
  const colorDoc = await PDFDocument.create();

  for (let i = 0; i < total; i++) {
    const [copied] = await (colorSet.has(i + 1) ? colorDoc : bwDoc).copyPages(srcDoc, [i]);
    (colorSet.has(i + 1) ? colorDoc : bwDoc).addPage(copied);
  }

  const bwBytes = await bwDoc.save();
  const colorBytes = await colorDoc.save();
  return { bwBytes, colorBytes };
}


