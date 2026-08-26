"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed.", error);
  }, [error]);

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-74px)] w-full max-w-5xl items-center px-5 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-16">
        <section className="w-full overflow-hidden rounded-[24px] border border-[#eadfd5] bg-white p-6 text-center shadow-[0_18px_48px_rgba(34,31,32,0.07)] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon/70">Something went wrong</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-black leading-tight text-charcoal sm:text-5xl">
            We hit a temporary problem.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-muted sm:text-base">
            Please try again. If it keeps happening, contact support and share the error code shown here.
          </p>
          {error.digest ? (
            <p className="mx-auto mt-4 inline-flex max-w-full rounded-full bg-[#fff8f9] px-4 py-2 text-xs font-black text-maroon ring-1 ring-[#f1dce1]">
              Error code: {error.digest}
            </p>
          ) : null}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-black text-white shadow-[0_12px_26px_rgba(141,0,33,0.16)]"
            >
              <RefreshCw size={18} strokeWidth={2.6} />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#fff4f5] px-5 text-sm font-black text-maroon ring-1 ring-[#f1dce1]"
            >
              <Home size={18} strokeWidth={2.6} />
              Home
            </Link>
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
