function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function' && !prefersReducedMotion();
}

function vibrate(pattern: number | number[]): void {
  if (canVibrate()) {
    (navigator as any).vibrate(pattern);
  }
}

export const haptics = {
  tap(): void {
    vibrate(10);
  },
  success(): void {
    vibrate([20, 30, 20]);
  },
  warn(): void {
    vibrate([30, 40, 30]);
  },
  error(): void {
    vibrate([50, 50, 50]);
  }
};

export default haptics;


