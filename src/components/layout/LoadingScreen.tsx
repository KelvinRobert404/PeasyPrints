import { SwoopLogo } from '@/components/swoop/Logo';

export default function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-white">
      <SwoopLogo size={24} className="animate-pulse" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
