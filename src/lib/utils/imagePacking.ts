export interface Size {
  w: number;
  h: number;
}

/**
 * Choose rows×cols grid that maximizes utilized area for given image sizes on a page.
 * Units are arbitrary as long as sizes and pageW/pageH match; gap is the same unit.
 */
export function chooseBestGrid(
  sizes: Size[],
  pageW: number,
  pageH: number,
  gap: number,
  maxRowsToTry = 8
): { rows: number; cols: number } {
  const k = Math.max(1, sizes.length);
  const candidates: Array<{ rows: number; cols: number }> = [];
  for (let r = 1; r <= Math.min(k, maxRowsToTry); r++) {
    const c = Math.ceil(k / r);
    candidates.push({ rows: r, cols: c });
  }
  const c0 = Math.ceil(Math.sqrt(k));
  const r0 = Math.ceil(k / c0);
  candidates.push({ rows: r0, cols: c0 });

  let best = candidates[0];
  let bestUtil = -1;
  for (const cand of candidates) {
    const cellW = (pageW - (cand.cols + 1) * gap) / cand.cols;
    const cellH = (pageH - (cand.rows + 1) * gap) / cand.rows;
    if (cellW <= 0 || cellH <= 0) continue;
    let used = 0;
    for (const s of sizes) {
      const scale0 = Math.min(cellW / s.w, cellH / s.h);
      const area0 = Math.max(scale0, 0) * s.w * Math.max(scale0, 0) * s.h;
      const scale1 = Math.min(cellW / s.h, cellH / s.w);
      const area1 = Math.max(scale1, 0) * s.w * Math.max(scale1, 0) * s.h;
      used += Math.max(area0, area1);
    }
    const util = used / (pageW * pageH);
    if (util > bestUtil) {
      bestUtil = util;
      best = cand;
    }
  }
  return best;
}


