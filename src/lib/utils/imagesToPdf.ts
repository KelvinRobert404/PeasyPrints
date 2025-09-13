import { PDFDocument, degrees } from 'pdf-lib';
import { chooseBestGrid } from '@/lib/utils/imagePacking';

function paperSizePts(paper: 'A4' | 'A3'): [number, number] {
  // Portrait points (1pt = 1/72 inch)
  return paper === 'A3' ? [841.89, 1190.55] : [595.28, 841.89];
}

export async function imagesToPdf(
  files: File[],
  pages: number,
  paper: 'A4' | 'A3',
  gapCm: number = 0,
  scaleFactor: number = 1.0
): Promise<Uint8Array> {
  async function fileToPngBytes(f: File): Promise<{ bytes: Uint8Array; w: number; h: number }> {
    // Decode via browser to normalize EXIF orientation, then re-encode to PNG
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unsupported');
      ctx.drawImage(img, 0, 0);
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
      const arrBuf = await blob.arrayBuffer();
      return { bytes: new Uint8Array(arrBuf), w: canvas.width, h: canvas.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const doc = await PDFDocument.create();
  const targetPages = Math.max(1, Math.min(5, Math.floor(pages || 1)));
  const n = files.length;
  const perPage = Math.max(1, Math.ceil(n / targetPages));

  // use shared chooser

  const [pw, ph] = paperSizePts(paper);

  // Convert cm gap to points (1in=72pt, 1cm≈28.3465pt)
  const gapPt = Math.max(0, Math.min(gapCm, 4)) * 28.3465;

  for (let p = 0; p < targetPages; p++) {
    const page = doc.addPage([pw, ph]);
    // Collect files for this page
    const pageFiles = [] as { file: File; img: any; w: number; h: number }[];
    for (let i = 0; i < perPage; i++) {
      const idx = p * perPage + i;
      if (idx >= n) break;
      const file = files[idx];
      const { bytes, w, h } = await fileToPngBytes(file);
      const img = await doc.embedPng(bytes);
      pageFiles.push({ file, img, w, h });
    }
    const grid = chooseBestGrid(pageFiles.map(f => ({ w: f.w, h: f.h })), pw, ph, gapPt);
    const cellW = (pw - (grid.cols + 1) * gapPt) / grid.cols;
    const cellH = (ph - (grid.rows + 1) * gapPt) / grid.rows;
    for (let i = 0; i < pageFiles.length; i++) {
      const r = Math.floor(i / grid.cols);
      const c = i % grid.cols;
      const f = pageFiles[i];
      const ar = f.w > 0 && f.h > 0 ? f.w / f.h : 1; // aspect ratio (pixels)

      // compute fit dims by aspect ratio only (units: page points)
      function fitDims(cellWpt: number, cellHpt: number, aspect: number): { iw: number; ih: number } {
        const cellAR = cellWpt / cellHpt;
        if (cellAR > aspect) {
          // height-constrained
          const ih = cellHpt;
          const iw = ih * aspect;
          return { iw, ih };
        } else {
          const iw = cellWpt;
          const ih = iw / aspect;
          return { iw, ih };
        }
      }

      const unrot = fitDims(cellW, cellH, ar);
      const rot = fitDims(cellW, cellH, 1 / Math.max(ar, 1e-6));
      const useRot = rot.iw * rot.ih > unrot.iw * unrot.ih;
      let iw = useRot ? rot.iw : unrot.iw;
      let ih = useRot ? rot.ih : unrot.ih;

      // apply scaleFactor but never exceed cell
      const scaleClamp = Math.max(0.5, Math.min(scaleFactor, 1.0));
      iw *= scaleClamp;
      ih *= scaleClamp;

      const cx = gapPt + c * (cellW + gapPt) + cellW / 2;
      // Convert from top-origin layout math to PDF's bottom-origin math.
      // Center should be: ph - (topEdge + cellH/2), where topEdge = gap + r*(cellH+gap)
      const cy = ph - (gapPt + r * (cellH + gapPt) + cellH / 2);
      if (useRot) {
        // Rotate around the image's lower-left corner. To keep the image
        // centered within the cell (like the canvas preview), we must place
        // the pre-rotation origin so that after a 90° rotation the center
        // lands at (cx, cy). For a 90° rotation, the vector from origin to
        // center (iw/2, ih/2) becomes (-ih/2, iw/2). Therefore set:
        // origin = (cx + iw/2, cy - ih/2).
        const rx = cx + (iw / 2);
        const ry = cy - (ih / 2);
        page.drawImage(f.img, { x: rx, y: ry, width: ih, height: iw, rotate: degrees(90) });
      } else {
        const x = cx - (iw / 2);
        const y = cy - (ih / 2);
        page.drawImage(f.img, { x, y, width: iw, height: ih });
      }
    }
  }

  return await doc.save();
}


