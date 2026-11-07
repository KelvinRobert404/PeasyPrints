'use client';

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import { CollegePicker } from '@/components/auth/CollegePicker';
import { AddCollegeEmail, DomainMismatchStep, postOnboarding } from '@/components/campus/AddCollegeEmail';
import { CourseStep, CourseSummary, type CourseSubmitResult } from '@/components/campus/CourseStep';
import { GirlsSpaceSection, IdCardInReviewNote, IdCardPending, IdCardUpload } from '@/components/campus/IdCardUpload';
import { ClockIcon, LockIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { EmptyState, IconTile, PageHeader, swButton } from '@/components/swoop/primitives';
import { useCampusSession } from '@/hooks/useCampusSession';
import { getCampus } from '@/lib/campus/catalog';
import { useHideDock } from '@/lib/stores/dockStore';
import { useCollegeStore, type CollegePick } from '@/lib/stores/collegeStore';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import type { CampusSession, MembershipCourse } from '@/types/campus';
import { cn } from '@/lib/utils/cn';

export default function CampusVerifyPage() {
  return (
    <Suspense fallback={<VerifySkeleton />}>
      <CampusVerify />
    </Suspense>
  );
}

function VerifySkeleton() {
  return (
    <div className="px-3 pt-3">
      <div className="skeleton h-72 rounded-[14px]" />
    </div>
  );
}

/** Where to go once onboarding is done, or null to stay on this page. */
function doneTarget(rawNext: string | null, session: CampusSession): string | null {
  if (!rawNext) return null;
  const next = safeRedirectPath(rawNext);
  // Never bounce back here.
  if (next === '/campus/verify' || next.startsWith('/campus/verify?') || next.startsWith('/campus/verify/')) return null;
  // The Girls' space gate sends approved students here to ask for access.
  if (next.startsWith('/girls-space') && !session.girlsSpaceApproved) return null;
  return next;
}

/** True once the persisted college store has read localStorage. */
function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useCollegeStore.persist.onFinishHydration(onChange),
    () => useCollegeStore.persist.hasHydrated(),
    () => false
  );
}

function CampusVerify() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const { session: fetched, loading, refresh } = useCampusSession();
  // Session returned by an onboarding POST, newer than the fetched one.
  const [saved, setSaved] = useState<CampusSession | null>(null);
  const session = saved ?? fetched;
  const needs = session.signedIn ? session.onboarding?.needs ?? null : null;
  const firstLoad = loading && !fetched.signedIn && !saved;
  const redirectTo = !firstLoad && session.signedIn && needs === null ? doneTarget(rawNext, session) : null;

  useHideDock(firstLoad || needs !== null || Boolean(redirectTo));

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const reload = useCallback(async () => {
    setSaved(null);
    await refresh();
  }, [refresh, setSaved]);

  if (firstLoad || redirectTo) return <VerifySkeleton />;

  const verifyHref = `/campus/verify${rawNext ? `?next=${encodeURIComponent(safeRedirectPath(rawNext))}` : ''}`;
  if (!session.signedIn) {
    return (
      <div className="pb-3">
        <PageHeader title="Verify your account" kicker="Only verified students" />
        <div className="px-3 pt-2">
          <EmptyState
            icon={ShieldCheckIcon}
            title="Sign in first"
            body="Then we check you’re a student."
            action={
              <Link
                href={`/login?redirect_url=${encodeURIComponent(verifyHref)}`}
                className={cn(swButton({ size: 'sm' }), 'mt-1')}
              >
                Sign in
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const membership = session.membership;
  const campusLabel = session.campus?.label ?? membership?.campusLabel ?? null;
  const collegeCode = session.campus?.code ?? membership?.collegeCode ?? 'college';

  return (
    <div className="pb-6">
      <PageHeader title={campusLabel ?? 'Swoop'} kicker={needs ? 'Verify your account' : 'Your account'} />
      <main className="flex flex-col gap-3 px-3 pt-2">
        {needs === 'college' ? (
          <CollegeStep onSaved={setSaved} />
        ) : needs === 'verify' ? (
          <VerifyStep session={session} collegeCode={collegeCode} onSaved={setSaved} reload={reload} checking={loading} />
        ) : needs === 'course' ? (
          <CourseStep initial={membership?.course} onSubmit={(course) => saveCourse(course, setSaved)} />
        ) : !session.verifiedStudent || !membership ? (
          // The session route falls back to this when the lookup fails.
          <EmptyState
            icon={ShieldCheckIcon}
            title="We couldn’t load your account"
            body="Check your connection and try again."
            action={
              <button type="button" onClick={() => void reload()} disabled={loading} className={cn(swButton({ size: 'sm' }), 'mt-1')}>
                {loading ? 'Checking…' : 'Try again'}
              </button>
            }
          />
        ) : (
          <>
            <CourseSummary
              displayName={membership?.displayName}
              campusLabel={campusLabel}
              course={membership?.course}
              action={
                <Link href="/" className={swButton({ variant: 'white', size: 'md', className: 'w-full' })}>
                  Go to Swoop
                </Link>
              }
            />
            <GirlsSpaceSection status={membership.girlsSpace.status} onSubmitted={reload} />
          </>
        )}
      </main>
    </div>
  );
}

async function saveCourse(course: MembershipCourse, onSaved: (session: CampusSession) => void): Promise<CourseSubmitResult> {
  const result = await postOnboarding({ course });
  if (!result.ok) return { ok: false, error: result.error };
  onSaved(result.session);
  return { ok: true };
}

/* Step: college (only when sign-in skipped the picker) -------- */

function CollegeStep({ onSaved }: { onSaved: (session: CampusSession) => void }) {
  const hydrated = useStoreHydrated();
  const storedPick = useCollegeStore((state) => state.pick);
  const storedStay = useCollegeStore((state) => state.stay);
  const [pick, setPick] = useState<CollegePick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The stored pick is tried once; after a failure the picker takes over.
  const [autoState, setAutoState] = useState<'waiting' | 'saving' | 'done'>('waiting');
  const started = useRef(false);

  const save = useCallback(
    async (choice: CollegePick, stay: typeof storedStay) => {
      setBusy(true);
      setError(null);
      const result = await postOnboarding({
        collegeId: choice.collegeId,
        campusId: choice.campusId,
        ...(stay ? { stay: { type: stay.type, distanceM: stay.distanceM } } : {}),
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      onSaved(result.session);
      return true;
    },
    [onSaved]
  );

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    if (!storedPick) {
      setAutoState('done');
      return;
    }
    setAutoState('saving');
    setPick(storedPick);
    void save(storedPick, storedStay).then(() => setAutoState('done'));
  }, [hydrated, storedPick, storedStay, save]);

  if (autoState !== 'done') {
    const label = getCampus(storedPick?.campusId)?.label;
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] bg-surface p-3" role="status">
        <IconTile icon={ClockIcon} tone="royal" size={32} />
        <p className="text-[12.5px] font-semibold text-ink">{label ? `Setting up ${label}…` : 'Getting things ready…'}</p>
      </div>
    );
  }

  return (
    <>
      <CollegePicker value={pick} onChange={setPick} />
      {error ? (
        <p role="alert" className="text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-0 bg-white pb-[calc(8px+env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          disabled={!pick || busy}
          onClick={() => pick && void save(pick, pick.campusId === storedPick?.campusId ? storedStay : null)}
          className={swButton({ size: 'lg', className: 'w-full' })}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </>
  );
}

/* Step: verify --------------------------------------------- */

function VerifyStep({
  session,
  collegeCode,
  onSaved,
  reload,
  checking,
}: {
  session: CampusSession;
  collegeCode: string;
  onSaved: (session: CampusSession) => void;
  reload: () => Promise<void>;
  checking: boolean;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const membership = session.membership;
  const status = membership?.student.status ?? 'unverified';

  const switchAccount = async () => {
    try {
      await signOut({ redirectUrl: '/login' });
    } catch {
      router.push('/login');
    }
  };

  if (status === 'pending') {
    // A pending ID card still asks for the course, so the wait is useful.
    if (!membership?.course) {
      return (
        <CourseStep
          note={<IdCardInReviewNote />}
          onSubmit={(course) => saveCourse(course, onSaved)}
        />
      );
    }
    return <IdCardPending onCheckAgain={() => void reload()} checking={checking} />;
  }

  if (status === 'revoked') {
    return (
      <EmptyState
        icon={LockIcon}
        title="Your access is paused"
        body="Talk to the campus team to sort it out."
        action={
          <button type="button" onClick={() => void switchAccount()} className={cn(swButton({ variant: 'white', size: 'sm' }), 'mt-1')}>
            Sign in with another account
          </button>
        }
      />
    );
  }

  return (
    <DomainMismatchStep
      collegeCode={collegeCode}
      status={status}
      email={user?.primaryEmailAddress?.emailAddress ?? null}
      onSignOut={() => void switchAccount()}
      emailPanel={<AddCollegeEmail collegeCode={collegeCode} onChecked={onSaved} />}
      idCardPanel={<IdCardUpload kind="student" onSubmitted={reload} />}
    />
  );
}
