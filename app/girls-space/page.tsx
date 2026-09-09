import Link from 'next/link';
import { House, Sparkles } from 'lucide-react';
import { CampusGate } from '@/components/campus/CampusGate';
import { CampusHeader } from '@/components/campus/CampusHeader';

export default function GirlsSpacePage() {
  return (
    <CampusGate girlsOnly>
      <div className="min-h-screen bg-[#fff1f6] pb-12">
        <CampusHeader title="Girls’ Space" eyebrow="Private · KJU verified" accent="#c23b73" />
        <main className="mx-auto max-w-2xl px-4 pt-5">
          <div className="rounded-[32px] bg-[#3b1024] p-6 text-white"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-pink-100">Only approved members</span><h1 className="mt-16 max-w-sm font-quinn text-[38px] font-bold leading-[0.93]">A smaller circle.<br />A safer exchange.</h1><p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/55">Marketplace and housing stay separate—your private access connects them.</p></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link href="/girls-space/marketplace" className="campus-press relative overflow-hidden rounded-[28px] bg-[#ff77ac] p-5 text-[#3b1024]"><Sparkles size={30} /><h2 className="mt-20 font-quinn text-[27px] font-bold leading-none">Girls<br />Marketplace</h2><p className="mt-3 text-xs font-bold text-[#3b1024]/60">Private resale and requests.</p></Link>
            <Link href="/girls-space/housing" className="campus-press relative overflow-hidden rounded-[28px] bg-[#d8ff6a] p-5 text-[#193c31]"><House size={30} /><h2 className="mt-20 font-quinn text-[27px] font-bold leading-none">Girls<br />Housing</h2><p className="mt-3 text-xs font-bold text-[#193c31]/60">Rooms and roommates.</p></Link>
          </div>
        </main>
      </div>
    </CampusGate>
  );
}
