'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { AddCollegeEmailForm, DomainMismatchStep } from '@/components/campus/AddCollegeEmail';
import { CourseStep, CourseSummary, type CourseSubmitResult } from '@/components/campus/CourseStep';
import { GirlsSpaceSection, IdCardInReviewNote, IdCardPending, IdCardUpload, type UploadResult } from '@/components/campus/IdCardUpload';
import type { AuthResult } from '@/components/auth/useCollegeSignIn';
import { Chip, PageHeader, swButton } from '@/components/swoop/primitives';
import type { MembershipCourse } from '@/types/campus';

/**
 * Dev-only preview of the /campus/verify outcomes with fixture props and no-op
 * handlers, so the screens can be checked without Clerk or Firebase. 404 in production.
 */
export default function VerifyPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <VerifyPreview />;
}

type View = 'mismatch' | 'pending' | 'course' | 'done';

const VIEWS: { id: View; label: string }[] = [
  { id: 'mismatch', label: 'Not a KJU email' },
  { id: 'pending', label: 'ID card in review' },
  { id: 'course', label: 'Course' },
  { id: 'done', label: 'Done' },
];

const FIXTURE_COURSE: MembershipCourse = { programmeId: 'bba', specialisation: 'Finance', semester: 3 };

const PREVIEW_ONLY = 'Preview only. Nothing is sent.';
const noopSendCode = async (): Promise<AuthResult> => ({ ok: true });
const noopVerifyCode = async (): Promise<AuthResult> => ({ ok: false, error: PREVIEW_ONLY });
const noopUpload = async (): Promise<UploadResult> => ({ ok: false, error: PREVIEW_ONLY });
const noopCourse = async (): Promise<CourseSubmitResult> => ({ ok: false, error: PREVIEW_ONLY });

function VerifyPreview() {
  const [view, setView] = useState<View>('mismatch');
  const [pendingWithCourse, setPendingWithCourse] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <div className="border-b border-line bg-surface px-5 py-2">
        <div className="mx-auto flex w-full max-w-[428px] flex-col gap-1.5">
          <p className="text-[11px] font-bold text-slate">Verify preview. Nothing is sent.</p>
          <div role="group" aria-label="Preview step" className="flex flex-wrap gap-1.5">
            {VIEWS.map((item) => (
              <Chip key={item.id} selected={view === item.id} onClick={() => setView(item.id)}>
                {item.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto min-h-screen w-full max-w-[428px] bg-white pb-6">
        <PageHeader title="KJU Main" kicker={view === 'done' ? 'Your account' : 'Verify your account'} backHref="/login/preview" />
        <main key={view} className="flex flex-col gap-3 px-3 pt-2">
          {view === 'mismatch' && (
            <DomainMismatchStep
              collegeCode="KJU"
              status="unverified"
              email="riya@example.com"
              onSignOut={() => undefined}
              emailPanel={<AddCollegeEmailForm collegeCode="KJU" onSendCode={noopSendCode} onVerifyCode={noopVerifyCode} />}
              idCardPanel={<IdCardUpload kind="student" submit={noopUpload} />}
            />
          )}

          {view === 'pending' && (
            <>
              <div role="group" aria-label="Pending variant" className="flex gap-1.5">
                <Chip selected={!pendingWithCourse} onClick={() => setPendingWithCourse(false)}>
                  No course yet
                </Chip>
                <Chip selected={pendingWithCourse} onClick={() => setPendingWithCourse(true)}>
                  Course saved
                </Chip>
              </div>
              {pendingWithCourse ? (
                <IdCardPending onCheckAgain={() => undefined} />
              ) : (
                <CourseStep
                  note={<IdCardInReviewNote />}
                  onSubmit={noopCourse}
                />
              )}
            </>
          )}

          {view === 'course' && <CourseStep onSubmit={noopCourse} />}

          {view === 'done' && (
            <>
              <CourseSummary
                displayName="Sana"
                campusLabel="KJU Main"
                course={FIXTURE_COURSE}
                action={
                  <button type="button" className={swButton({ variant: 'white', size: 'md', className: 'w-full' })}>
                    Go to Swoop
                  </button>
                }
              />
              <GirlsSpaceSection status="unverified" submit={noopUpload} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
