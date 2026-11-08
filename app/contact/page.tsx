"use client";

import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Card, IconTile, ListRow, PageHeader, SectionHeader } from '@/components/swoop/primitives';
import { ChevronRightIcon, RupeeIcon, type IconProps } from '@/components/swoop/icons';
import { BugIcon, BulbIcon, ChatIcon } from '@/components/auth/icons';
import { HandoffAnchor, useHandoff } from '@/components/demo/DemoHandoffSheet';
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
  const handoff = useHandoff();

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Help & support" backHref="/" />

      <main className="flex flex-col px-3 pb-3">
        <p className="pt-1 text-[12px] leading-[1.45] text-slate">Hey, need help? We&apos;re here.</p>

        <section className="pt-3">
          <SectionHeader title="Talk to us" />
          <Card className="mt-2 px-3">
            <HandoffAnchor
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="campus-press block"
              demoClassName="w-full"
              onHandoff={() => handoff.open('whatsapp', 'Swoop support', phone)}
            >
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
            </HandoffAnchor>
          </Card>
        </section>

        <section className="pt-3.5">
          <SectionHeader title="Common questions" />
          <Card className="mt-2 px-3">
            <TopicRow icon={RupeeIcon} title="Payment issues">
              Paid but no order? Place it again.
              <br />
              We refund the first payment.
              <br />
              Under Rs 100 comes back on its own.
            </TopicRow>
            <TopicRow icon={BugIcon} title="App or technical glitches">
              Page broken or not loading?
              <br />
              Send us a screenshot. We&apos;ll check fast.
            </TopicRow>
            <TopicRow icon={BulbIcon} title="Feedback & ideas" divider={false}>
              Got an idea or a wish?
              <br />
              Tell us. It shapes what we build next.
            </TopicRow>
          </Card>
        </section>
      </main>
      {handoff.sheet}
    </div>
  );
}
