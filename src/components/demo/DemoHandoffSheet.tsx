'use client';

// Demo only: WhatsApp, phone, email and Instagram hand-offs never leave the
// demo. Instead of following a wa.me, tel:, mailto: or instagram.com link, a
// small sheet says what the real app would open, with the sample contact
// greyed. Pages pick demo code at module level (HandoffAnchor, useHandoff), so
// with demo off the real anchors render unchanged.

import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CameraIcon, CloseIcon, type IconProps } from '@/components/swoop/icons';
import { IconButton, IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { ChatIcon } from '@/components/marketplace/icons';
import { isDemoMode } from '@/lib/demo/mode';
import { cn } from '@/lib/utils/cn';

export type HandoffChannel = 'whatsapp' | 'phone' | 'email' | 'instagram';

type Handoff = { channel: HandoffChannel; name: string; target: string };

export type HandoffApi = {
  /** Opens the sheet. `name` is who the real app would reach, `target` their number, email or handle. */
  open: (channel: HandoffChannel, name: string, target: string) => void;
  /** Render this once, anywhere in the component. Null while closed. */
  sheet: ReactNode;
};

/* Icons (same duotone pattern as the Swoop set) ---------------------------- */

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      opacity={0.32}
      d="M6.6 3.2 8.9 3a1.4 1.4 0 0 1 1.4.9l1.1 2.8a1.4 1.4 0 0 1-.3 1.5L9.6 9.7a11 11 0 0 0 4.7 4.7l1.5-1.5a1.4 1.4 0 0 1 1.5-.3l2.8 1.1a1.4 1.4 0 0 1 .9 1.4l-.2 2.3A2.6 2.6 0 0 1 18.2 20 15.2 15.2 0 0 1 4 5.8a2.6 2.6 0 0 1 2.6-2.6Z"
    />
    <path d="M14 3.5a6.5 6.5 0 0 1 6.5 6.5h-2A4.5 4.5 0 0 0 14 5.5Z" />
  </Svg>
);

const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={0.32} x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M4.2 6.6a1 1 0 0 1 1.4-.2L12 11l6.4-4.6a1 1 0 1 1 1.2 1.6l-7 5a1 1 0 0 1-1.2 0l-7-5a1 1 0 0 1-.2-1.4Z" />
  </Svg>
);

const CHANNELS: Record<HandoffChannel, { label: string; icon: ComponentType<IconProps>; line: (name: string) => string }> = {
  whatsapp: { label: 'WhatsApp', icon: ChatIcon, line: (name) => `This opens WhatsApp with ${name}.` },
  phone: { label: 'Phone', icon: PhoneIcon, line: (name) => `This calls ${name}.` },
  email: { label: 'Email', icon: MailIcon, line: (name) => `This opens an email to ${name}.` },
  instagram: { label: 'Instagram', icon: CameraIcon, line: (name) => `This opens ${name} on Instagram.` },
};

/** A tidy label for the greyed contact: '+91 98765 43210', '@handle' or the email. */
export function handoffTargetLabel(channel: HandoffChannel, target: string): string {
  const raw = target.trim();
  if (channel === 'instagram') return raw.startsWith('@') ? raw : `@${raw}`;
  if (channel === 'email') return raw;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return raw;
}

/** The number from a wa.me link, or '' when there is none. */
export function whatsappNumberFromUrl(url: string): string {
  const match = /wa\.me\/(\d+)/.exec(url);
  return match ? match[1] : '';
}

/* Sheet ------------------------------------------------------------------- */

export function DemoHandoffSheet({ channel, name, target, onClose }: Handoff & { onClose: () => void }) {
  const titleId = useId();
  const lineId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const meta = CHANNELS[channel];
  const shown = target ? handoffTargetLabel(channel, target) : '';

  useEffect(() => {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    okRef.current?.focus();
    // Capture phase, so Escape closes only this sheet, not one beneath it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      returnTo?.focus();
    };
  }, [onClose]);

  // Portalled to body, so a transformed parent cannot trap the fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lineId}
        className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Tag tone="royal">Demo</Tag>
            <h2 id={titleId} className="mt-1 font-heading text-[16px] leading-[1.1] text-ink">
              In the real app
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>

        <p id={lineId} className="mt-2 break-words text-[12.5px] font-semibold leading-[1.45] text-ink">
          {meta.line(name)}
        </p>

        <div className="mt-2.5 flex items-center gap-2.5 rounded-[12px] bg-surface px-3 py-2">
          <IconTile icon={meta.icon} tone={channel === 'whatsapp' ? 'go' : 'royal'} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate">{meta.label}</p>
            {shown ? (
              <p className="truncate text-[12.5px] font-semibold text-slate tabular-nums" aria-label={`${meta.label}: ${shown}, sample`}>
                {shown}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-[11px] font-semibold text-slate">Sample data. Nothing leaves the demo.</p>

        <button ref={okRef} type="button" onClick={onClose} className={cn(swButton(), 'mt-3 w-full')}>
          OK
        </button>
      </section>
    </div>,
    document.body,
  );
}

/* Hooks ------------------------------------------------------------------- */

/** Demo hand-off: `open(channel, name, target)` shows the sheet, render `sheet` once. */
export function useDemoHandoff(): HandoffApi {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const open = useCallback((channel: HandoffChannel, name: string, target: string) => {
    setHandoff({ channel, name: name.trim() || 'them', target });
  }, []);
  const close = useCallback(() => setHandoff(null), []);
  const sheet = handoff ? <DemoHandoffSheet {...handoff} onClose={close} /> : null;
  return { open, sheet };
}

const NO_HANDOFF: HandoffApi = { open: () => {}, sheet: null };

function useNoHandoff(): HandoffApi {
  return NO_HANDOFF;
}

/** Picked once at module level: the demo sheet in demo, a no-op otherwise. */
export const useHandoff: () => HandoffApi = isDemoMode() ? useDemoHandoff : useNoHandoff;

/* Anchor ------------------------------------------------------------------ */

type AnchorProps = {
  href: string;
  /** The anchor's target attribute, e.g. '_blank'. Ignored in demo. */
  target?: string;
  rel?: string;
  className?: string;
  /** Demo only: extra classes for the button, e.g. 'w-full' where the anchor was a block. */
  demoClassName?: string;
  /** Demo only: called instead of following the link. */
  onHandoff: () => void;
  children: ReactNode;
};

function RealAnchor({ href, target, rel, className, children }: AnchorProps) {
  return (
    <a href={href} target={target} rel={rel} className={className}>
      {children}
    </a>
  );
}

function DemoAnchor({ className, demoClassName, onHandoff, children }: AnchorProps) {
  return (
    <button type="button" onClick={onHandoff} className={cn('text-left', className, demoClassName)}>
      {children}
    </button>
  );
}

/**
 * An external hand-off link. Demo off: the plain anchor. Demo on: the same
 * classes on a button that calls `onHandoff`, so no wa.me, tel:, mailto: or
 * instagram navigation can happen.
 */
export const HandoffAnchor: (props: AnchorProps) => ReactNode = isDemoMode() ? DemoAnchor : RealAnchor;
