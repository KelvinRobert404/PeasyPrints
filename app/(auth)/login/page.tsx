'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { AuthShell } from '@/components/auth/AuthShell';
import { CollegePicker } from '@/components/auth/CollegePicker';
import { StayStep } from '@/components/auth/StayStep';
import { SampleStudentSkip, SignInStep } from '@/components/auth/SignInStep';
import { useCollegeSignIn } from '@/components/auth/useCollegeSignIn';
import { skipInAsSampleStudent } from '@/components/demo/auth/useDemoCollegeSignIn';
import { isDemoMode } from '@/lib/demo/mode';
import { IconTile, swButton } from '@/components/swoop/primitives';
import { LandmarkIcon } from '@/components/swoop/icons';
import { getCampus, getCollege } from '@/lib/campus/catalog';
import { useCollegeStore, type CollegePick } from '@/lib/stores/collegeStore';

type Step = 'college' | 'stay' | 'signin';

/** Demo only: "Just looking? Skip in as a sample student" on step 1 and the sign-in step. */
const SHOW_SKIP_IN = isDemoMode();

const STEPS: readonly Step[] = ['college', 'stay', 'signin'];

function parseStep(raw: string | null): Step | null {
  return STEPS.includes(raw as Step) ? (raw as Step) : null;
}

/** The step to show: stay and sign-in need a full pick; no step asked means sign-in if one is stored. */
function resolveStep(requested: Step | null, pick: CollegePick | null): Step {
  if (!pick) return 'college';
  return requested ?? 'signin';
}

/** Writes ?step= into the URL, keeping every other param (redirect_url included). */
function writeStep(step: Step, mode: 'push' | 'replace') {
  const params = new URLSearchParams(window.location.search);
  params.set('step', step);
  const url = `${window.location.pathname}?${params.toString()}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

/** Runs `fn` once the persisted college store has read localStorage. */
function afterStoreHydration(fn: () => void): (() => void) | undefined {
  const persist = useCollegeStore.persist;
  if (!persist || persist.hasHydrated()) {
    fn();
    return undefined;
  }
  return persist.onFinishHydration(() => fn());
}

/**
 * /login: step 1 is college and campus, then an optional stay, then step 2 sign in.
 * The step lives in client state, mirrored to ?step= so the browser Back button works.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell>{null}</AuthShell>}>
      <LoginFlow />
    </Suspense>
  );
}

function LoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get('redirect_url'));
  const requested = parseStep(searchParams.get('step'));
  const { isSignedIn, isLoaded } = useAuth();
  const auth = useCollegeSignIn();

  const pick = useCollegeStore((s) => s.pick);
  const stay = useCollegeStore((s) => s.stay);
  const setPick = useCollegeStore((s) => s.setPick);
  const setStay = useCollegeStore((s) => s.setStay);

  // null until the stored pick is known, so a stored pick never flashes the college step.
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirect);
    }
  }, [isLoaded, isSignedIn, redirect, router]);

  // URL -> state: first load, and browser Back or Forward. Fixes a step the pick can't reach.
  useEffect(
    () =>
      afterStoreHydration(() => {
        const next = resolveStep(requested, useCollegeStore.getState().pick);
        setStep(next);
        if (next !== requested) writeStep(next, 'replace');
      }),
    [requested]
  );

  const skipIn = useCallback(() => skipInAsSampleStudent(redirect), [redirect]);

  const go = useCallback((next: Step) => {
    setStep(next);
    writeStep(next, 'push');
  }, []);

  if (!step) return <AuthShell>{null}</AuthShell>;

  const index = STEPS.indexOf(step);
  const steps = { current: index, total: STEPS.length };

  if (step === 'college') {
    return (
      <AuthShell steps={steps}>
        <h1 className="sr-only">Sign in to Swoop</h1>
        <CollegePicker value={pick} onChange={setPick} />
        <div className="sticky bottom-0 mt-3 bg-white pb-1 pt-2">
          <button
            type="button"
            disabled={!pick}
            onClick={() => go('stay')}
            className={swButton({ size: 'lg', className: 'w-full' })}
          >
            Continue
          </button>
          {SHOW_SKIP_IN && <SampleStudentSkip onSkipIn={skipIn} className="mt-2.5" />}
        </div>
      </AuthShell>
    );
  }

  if (step === 'stay') {
    return (
      <AuthShell steps={steps} onBack={() => go('college')}>
        <h1 className="sr-only">Sign in to Swoop</h1>
        <StayStep campusId={pick?.campusId ?? null} value={stay} onChange={setStay} onSkip={() => go('signin')} />
        <button
          type="button"
          disabled={!stay}
          onClick={() => go('signin')}
          className={swButton({ size: 'lg', className: 'mt-4 w-full' })}
        >
          Continue
        </button>
      </AuthShell>
    );
  }

  const college = getCollege(pick?.collegeId);
  const campus = getCampus(pick?.campusId);

  return (
    <AuthShell steps={steps} onBack={() => go('stay')}>
      {campus && (
        <div className="mb-5 flex items-center gap-2.5 rounded-[12px] bg-surface px-2.5 py-2">
          <IconTile icon={LandmarkIcon} tone="royal" size={28} />
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[12px] font-bold text-ink">{campus.label}</span>
            <span className="truncate text-[11px] text-slate">{college?.shortName ?? campus.name}</span>
          </span>
          <button
            type="button"
            onClick={() => go('college')}
            className="shrink-0 px-1 py-1 text-[12px] font-bold text-royal underline-offset-2 hover:underline"
          >
            Change
          </button>
        </div>
      )}
      <SignInStep
        collegeCode={college?.code ?? ''}
        onGoogle={() => auth.google(redirect)}
        onEmailCode={{ sendCode: auth.sendCode, verifyCode: (code) => auth.verifyCode(code, redirect) }}
        onSkipIn={SHOW_SKIP_IN ? skipIn : undefined}
      />
    </AuthShell>
  );
}
