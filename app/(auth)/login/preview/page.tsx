'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { CollegePicker } from '@/components/auth/CollegePicker';
import { StayStep } from '@/components/auth/StayStep';
import { SignInStep } from '@/components/auth/SignInStep';
import type { AuthResult } from '@/components/auth/useCollegeSignIn';
import { Chip, IconTile, swButton } from '@/components/swoop/primitives';
import { LandmarkIcon } from '@/components/swoop/icons';
import { getCampus, getCollege } from '@/lib/campus/catalog';
import type { CollegePick, StayChoice } from '@/lib/stores/collegeStore';

/**
 * Dev-only preview of every /login step with fixture props and no-op handlers,
 * so the screens can be checked without Clerk. 404 in production.
 */
export default function LoginPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LoginPreview />;
}

type View = 'college' | 'stay' | 'signin' | 'email' | 'stored';

const VIEWS: { id: View; label: string }[] = [
  { id: 'college', label: 'College' },
  { id: 'stay', label: 'Stay' },
  { id: 'signin', label: 'Sign in' },
  { id: 'email', label: 'Email code' },
  { id: 'stored', label: 'Stored pick' },
];

const STEP_OF: Record<View, number> = { college: 0, stay: 1, signin: 2, email: 2, stored: 2 };

const FIXTURE_PICK: CollegePick = { collegeId: 'kju', campusId: 'kju-main' };

const PREVIEW_ONLY: AuthResult = { ok: false, error: 'Preview only. No sign-in here.' };
const noopGoogle = async (): Promise<AuthResult> => PREVIEW_ONLY;
const noopSendCode = async (): Promise<AuthResult> => ({ ok: true });
const noopVerifyCode = async (): Promise<AuthResult> => PREVIEW_ONLY;

function LoginPreview() {
  const [view, setView] = useState<View>('college');
  const [pick, setPick] = useState<CollegePick | null>(null);
  const [stay, setStay] = useState<StayChoice | null>(null);

  const show = (next: View) => {
    // Every step after college needs a pick; fall back to the fixture campus.
    if (next === 'stored' || (next !== 'college' && !pick)) setPick(FIXTURE_PICK);
    setView(next);
  };

  const activePick = view === 'college' ? pick : pick ?? FIXTURE_PICK;
  const college = getCollege(activePick?.collegeId);
  const campus = getCampus(activePick?.campusId);
  const steps = { current: STEP_OF[view], total: 3 };

  return (
    <>
      <div className="border-b border-line bg-surface px-5 py-2">
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-1.5">
          <p className="text-[11px] font-bold text-slate">Login preview. Nothing is sent.</p>
          <div role="group" aria-label="Preview step" className="flex flex-wrap gap-1.5">
            {VIEWS.map((v) => (
              <Chip key={v.id} selected={view === v.id} onClick={() => show(v.id)}>
                {v.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {view === 'college' && (
        <AuthShell steps={steps}>
          <h1 className="sr-only">Sign in to Swoop</h1>
          <CollegePicker value={pick} onChange={setPick} />
          <div className="sticky bottom-0 mt-3 bg-white pb-1 pt-2">
            <button
              type="button"
              disabled={!pick}
              onClick={() => show('stay')}
              className={swButton({ size: 'lg', className: 'w-full' })}
            >
              Continue
            </button>
          </div>
        </AuthShell>
      )}

      {view === 'stay' && (
        <AuthShell steps={steps} onBack={() => show('college')}>
          <h1 className="sr-only">Sign in to Swoop</h1>
          <StayStep campusId={activePick?.campusId ?? null} value={stay} onChange={setStay} onSkip={() => show('signin')} />
          <button
            type="button"
            disabled={!stay}
            onClick={() => show('signin')}
            className={swButton({ size: 'lg', className: 'mt-4 w-full' })}
          >
            Continue
          </button>
        </AuthShell>
      )}

      {(view === 'signin' || view === 'email' || view === 'stored') && (
        <AuthShell steps={steps} onBack={() => show('stay')}>
          {campus && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[12px] bg-surface px-2.5 py-2">
              <IconTile icon={LandmarkIcon} tone="royal" size={28} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[12px] font-bold text-ink">{campus.label}</span>
                <span className="truncate text-[11px] text-slate">{college?.shortName ?? campus.name}</span>
              </span>
              <button
                type="button"
                onClick={() => show('college')}
                className="shrink-0 px-1 py-1 text-[12px] font-bold text-royal underline-offset-2 hover:underline"
              >
                Change
              </button>
            </div>
          )}
          <SignInStep
            key={view}
            collegeCode={college?.code ?? 'KJU'}
            initialView={view === 'email' ? 'email' : 'choose'}
            onGoogle={noopGoogle}
            onEmailCode={{ sendCode: noopSendCode, verifyCode: noopVerifyCode }}
          />
        </AuthShell>
      )}
    </>
  );
}
