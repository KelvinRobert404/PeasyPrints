import { cn } from '@/lib/utils/cn';

type Tone = 'black' | 'white' | 'royal';

const toneClass: Record<Tone, string> = {
  black: 'bg-ink text-white',
  white: 'bg-white text-ink',
  royal: 'bg-royal text-white'
};

const sparkClass: Record<Tone, string> = {
  black: 'text-royal-soft',
  white: 'text-royal',
  royal: 'text-ink'
};

/**
 * The Swoop logo: one straight piece of black tape with torn ends, "swoop" in Archivo Black Italic and a ✦ spark.
 * Locked 2026-10-09. Never rotate it.
 */
export function SwoopLogo({ size = 17, tone = 'black', className }: { size?: number; tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="swoop" className={cn('sw-tape font-logo', toneClass[tone], className)} style={{ fontSize: size }}>
      swoop
      <span aria-hidden="true" className={sparkClass[tone]} style={{ fontSize: '0.55em' }}>✦</span>
    </span>
  );
}

/**
 * Endless tape strip — ONLY where tape means something real (e.g. SOLD across a sold listing). Never decoration.
 * Rotation is allowed here (it's "stuck on" something), never on the logo.
 */
export function TapeStrip({
  word,
  tone = 'black',
  repeat = 4,
  className,
  style
}: {
  word: string;
  tone?: Tone;
  repeat?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span aria-label={word} className={cn('sw-strip font-logo', toneClass[tone], className)} style={style}>
      {Array.from({ length: repeat }).map((_, i) => (
        <span key={i} aria-hidden="true" className="contents">
          <span>{word}</span>
          {i < repeat - 1 && <span className={sparkClass[tone]}>✦</span>}
        </span>
      ))}
    </span>
  );
}
