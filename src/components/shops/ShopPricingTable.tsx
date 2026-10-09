import type { ShopPricing } from '@/types/models';
import { Card, EmptyState } from '@/components/swoop/primitives';
import { RupeeIcon } from '@/components/swoop/icons';

function Price({ value }: { value?: number }) {
  const v = Number(value ?? 0);
  if (v <= 0) return <span className="text-[11.5px] font-semibold text-slate">Unavailable</span>;
  return <span className="text-[12.5px] font-bold tabular-nums text-ink">₹{v}</span>;
}

function Group({ title, rows }: { title: string; rows: { label: string; value?: number }[] }) {
  return (
    <section className="px-3 pt-2.5 pb-1">
      <h3 className="font-heading text-[12.5px] leading-[1.15] text-ink">{title}</h3>
      <dl className="mt-1">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex min-h-9 items-center justify-between gap-3 ${i < rows.length - 1 ? 'border-b border-line' : ''}`}
          >
            <dt className="text-[12px] font-semibold text-text-secondary">{r.label}</dt>
            <dd>
              <Price value={r.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ShopPricingTable({ pricing }: { pricing?: ShopPricing }) {
  if (!pricing) return <EmptyState icon={RupeeIcon} title="Pricing not available" body="This shop hasn't published its prices yet." />;

  return (
    <Card className="divide-y divide-line overflow-hidden">
      <Group
        title="A4 · per page"
        rows={[
          { label: 'Single-sided B/W', value: pricing.a4?.singleBW },
          { label: 'Double-sided B/W', value: pricing.a4?.doubleBW },
          { label: 'Single-sided colour', value: pricing.a4?.singleColor },
          { label: 'Double-sided colour', value: pricing.a4?.doubleColor }
        ]}
      />
      <Group
        title="A3 · per page"
        rows={[
          { label: 'Single-sided B/W', value: pricing.a3?.singleBW },
          { label: 'Double-sided B/W', value: pricing.a3?.doubleBW },
          { label: 'Single-sided colour', value: pricing.a3?.singleColor },
          { label: 'Double-sided colour', value: pricing.a3?.doubleColor }
        ]}
      />
      <Group
        title="Services"
        rows={[
          { label: 'Soft binding', value: pricing.services.softBinding },
          { label: 'Spiral binding', value: pricing.services.spiralBinding },
          { label: 'Hard binding', value: pricing.services.hardBinding },
          { label: 'Rush', value: pricing.services.emergency }
        ]}
      />
    </Card>
  );
}
