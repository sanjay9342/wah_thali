"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Root layout failed.", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="wt-soft-type min-h-screen bg-white font-sans text-charcoal">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-12 sm:px-6 lg:px-8">
          <section className="w-full rounded-[24px] border border-[#eadfd5] bg-white p-6 text-center shadow-[0_18px_48px_rgba(34,31,32,0.07)] sm:p-10">
            <title>Something went wrong | Wah Thali</title>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon/70">Wah Thali</p>
            <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-black leading-tight text-charcoal sm:text-5xl">
              We could not load the page.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-muted sm:text-base">
              Please try again. If this continues, contact support and share the error code.
            </p>
            {error.digest ? (
              <p className="mx-auto mt-4 inline-flex max-w-full rounded-full bg-[#fff8f9] px-4 py-2 text-xs font-black text-maroon ring-1 ring-[#f1dce1]">
                Error code: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-black text-white shadow-[0_12px_26px_rgba(141,0,33,0.16)]"
            >
              <RefreshCw size={18} strokeWidth={2.6} />
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
