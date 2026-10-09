"use client";

import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Card, IconTile, ListRow, PageHeader, SectionHeader } from '@/components/swoop/primitives';
import { ChevronRightIcon, RupeeIcon, type IconProps } from '@/components/swoop/icons';
import { BugIcon, BulbIcon, ChatIcon } from '@/components/auth/icons';
import { cn } from '@/lib/utils/cn';

function TopicRow({
  icon,
  title,
  children,
  divider = true
}: {
  icon: ComponentType<IconProps>;
  title: string;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="py-3">
        <IconTile icon={icon} />
      </span>
      <div className={cn('min-w-0 flex-1 py-3', divider && 'border-b border-line')}>
        <h3 className="text-[12.5px] font-bold text-ink">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-slate">{children}</p>
      </div>
    </div>
  );
}

export default function ContactPage() {
  // Hardcoded WhatsApp contact per request
  const phone = '918867224918';
  const text = encodeURIComponent('Hi Swoop, I have an issue with');
  const waLink = useMemo(() => {
    if (phone && /\d{8,15}/.test(phone)) {
      return `https://wa.me/${phone}?text=${text}`;
    }
    return `https://wa.me/?text=${text}`;
  }, [phone, text]);

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Help & support" backHref="/" />

      <main className="flex flex-col px-3 pb-3">
        <p className="pt-1 text-[12px] leading-[1.45] text-slate">Need help? We&apos;re here for you.</p>

        <section className="pt-3">
          <SectionHeader title="Talk to us" />
          <Card className="mt-2 px-3">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="campus-press block">
              <ListRow
                leading={<IconTile icon={ChatIcon} tone="go" />}
                title={
                  <>
                    Chat on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                  </>
                }
                subtitle="Send a message or a screenshot"
                trailing={<ChevronRightIcon size={12} className="shrink-0 text-text-muted" />}
                divider={false}
              />
            </a>
          </Card>
        </section>

        <section className="pt-3.5">
          <SectionHeader title="Common questions" />
          <Card className="mt-2 px-3">
            <TopicRow icon={RupeeIcon} title="Payment issues">
              If money gets debited but the order isn&apos;t showing up, don&apos;t worry. You can safely place a second order—we&apos;ll refund the
              first one. Any amount less than ₹100 will be refunded automatically.
            </TopicRow>
            <TopicRow icon={BugIcon} title="App or technical glitches">
              If you run into an error or a page that won&apos;t load, just take a screenshot and send it to us. Our team will look into it right
              away.
            </TopicRow>
            <TopicRow icon={BulbIcon} title="Feedback & ideas" divider={false}>
              Got suggestions? Think we should add new features? We&apos;d love to hear from you. Every bit of feedback helps us improve Swoop for
              your campus.
            </TopicRow>
          </Card>
        </section>
      </main>
    </div>
  );
}
