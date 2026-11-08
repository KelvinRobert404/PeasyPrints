'use client';

// The demo's account button, rendered by the Clerk stand-in's <UserButton/>.
// Signed in: a round initial opening a small menu (name, email, Profile,
// Switch student, Sign out). Signed out: a Sign in link.

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { demoClerkUser } from '@/lib/demo/server/identity';
import { currentDemoPath, signInAs, signOut, useDemoSession } from '@/lib/demo/client/session';
import { Initial, isWalkthroughPick, openDemoAccountChooser } from '@/components/demo/auth/DemoAccountChooser';
import { LogOutIcon, UserIcon, UsersIcon, type IconProps } from '@/components/swoop/icons';
import { Tag, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

export function DemoUserMenu({ afterSignOutUrl = '/', className }: { afterSignOutUrl?: string; className?: string }) {
  const state = useDemoSession();
  const account = useMemo(() => {
    if (!state.isLoaded || !state.session) return null;
    const user = demoClerkUser(state.session);
    return { name: user.fullName, email: user.primaryEmailAddress?.emailAddress ?? null };
  }, [state]);

  if (!state.isLoaded) {
    return <span aria-hidden="true" className={cn('h-8 w-8 shrink-0 rounded-full bg-surface', className)} />;
  }

  if (!account) {
    return (
      <Link href="/login" className={swButton({ variant: 'surface', size: 'pill', className: cn('shrink-0', className) })}>
        Sign in
      </Link>
    );
  }

  return <AccountMenu name={account.name} email={account.email} afterSignOutUrl={afterSignOutUrl} className={className} />;
}

function AccountMenu({
  name,
  email,
  afterSignOutUrl,
  className,
}: {
  name: string;
  email: string | null;
  afterSignOutUrl: string;
  className?: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  // Outside click and Escape close the menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Up and Down move between items.
  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const switchStudent = async () => {
    close(false);
    const pick = await openDemoAccountChooser({ mode: 'students' });
    if (!pick || isWalkthroughPick(pick)) return;
    setBusy(true);
    try {
      await signInAs(pick, currentDemoPath());
    } catch {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    close(false);
    setBusy(true);
    await signOut(afterSignOutUrl);
  };

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className="campus-press grid h-8 w-8 place-items-center rounded-full bg-surface transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:opacity-45"
      >
        <Initial name={name} size={28} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[248px] max-w-[calc(100vw-24px)] rounded-[14px] bg-white p-1.5 shadow-[0_8px_30px_rgba(16,24,40,0.18)] ring-1 ring-line"
        >
          <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
            <Initial name={name} size={32} />
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-[12.5px] font-bold text-ink">{name}</span>
                <Tag tone="royal" className="shrink-0">
                  Demo
                </Tag>
              </span>
              {email ? <span className="truncate text-[11px] text-slate">{email}</span> : null}
              <span className="truncate text-[10.5px] text-slate">Sample account, not a real one</span>
            </div>
          </div>
          <div className="border-t border-line pt-1">
            <MenuItem icon={UserIcon} label="Profile" href="/profile" onSelect={() => close(false)} />
            <MenuItem icon={UsersIcon} label="Switch student" onSelect={() => void switchStudent()} />
            <MenuItem icon={LogOutIcon} label="Sign out" onSelect={() => void doSignOut()} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onSelect,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  href?: string;
  onSelect: () => void;
}) {
  const cls =
    'campus-press flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2 text-left text-[12.5px] font-bold text-ink hover:bg-surface focus-visible:bg-surface focus-visible:outline-none';
  const body = (
    <>
      <Icon size={18} className="shrink-0 text-slate" />
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} role="menuitem" tabIndex={-1} onClick={onSelect} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" tabIndex={-1} onClick={onSelect} className={cls}>
      {body}
    </button>
  );
}

export default DemoUserMenu;
