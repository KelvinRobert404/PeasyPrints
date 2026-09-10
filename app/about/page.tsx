import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 pt-6 pb-28">
      <div className="mx-auto max-w-lg">
        <p className="font-coolvetica text-[13px] tracking-[0.02em] text-slate-400">about</p>
        <h1 className="mt-1 font-poster text-black text-[34px] leading-[1.02] tracking-[0.01em]">CAMPUS, SORTED.</h1>

        <div className="mt-4 rounded-[20px] bg-ink p-5">
          <p className="font-quinn text-cream text-[18px] font-bold">SWOOP</p>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-white/70">
            Print, Market Place, Housing and Canteen for your campus — one account, one wallet, pickup nearby.
          </p>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-[20px] bg-royal p-4">
            <p className="font-poster text-white text-[22px] leading-none">PRINT</p>
            <p className="mt-1 text-[11px] font-semibold text-white/70">Upload PDFs, ready in minutes.</p>
          </div>
          <div className="rounded-[20px] bg-cream p-4">
            <p className="font-poster text-ink text-[22px] leading-none">MARKET</p>
            <p className="mt-1 text-[11px] font-bold text-ink/60">Pre-loved finds on campus.</p>
          </div>
        </div>

        <Link href="/" className="campus-press mt-4 block rounded-full bg-ink py-3.5 text-center font-coolvetica text-[15px] text-white">
          back home
        </Link>
      </div>
    </div>
  );
}
