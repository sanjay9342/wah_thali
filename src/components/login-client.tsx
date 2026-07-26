"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { saveCustomerSession } from "@/lib/customer-session";

type LoginMode = "whatsapp" | "email";

function cleanMobile(value: string) {
  return value.replace(/[^\d]/g, "").slice(-10);
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const [mode, setMode] = useState<LoginMode>("whatsapp");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [form, setForm] = useState({ name: "", mobile: "", email: "", otp: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Login or create your Wah Thali account.");

  function requestOtp() {
    const mobile = cleanMobile(form.mobile);
    if (!form.name.trim()) {
      setMessage("Please enter your name.");
      return;
    }
    if (mobile.length !== 10) {
      setMessage("Please enter a valid 10 digit mobile number.");
      return;
    }
    if (mode === "email" && form.email.trim() && !form.email.includes("@")) {
      setMessage("Please enter a valid email address.");
      return;
    }

    setForm((current) => ({ ...current, mobile }));
    setStep("otp");
    setMessage(mode === "whatsapp" ? "Enter OTP 123456 to continue. WhatsApp gateway can be connected later." : "Enter OTP 123456 to continue.");
  }

  async function verifyOtp() {
    if (form.otp.trim() !== "123456") {
      setMessage("Invalid OTP. Use 123456 for this demo login.");
      return;
    }

    setLoading(true);
    setMessage("Creating your customer profile...");
    try {
      const response = await fetch("/api/customers/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: cleanMobile(form.mobile),
          email: form.email.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed. Please check Supabase connection.");
        return;
      }

      saveCustomerSession({
        id: data.customer.id,
        name: data.customer.name,
        mobile: data.customer.mobile,
        email: data.customer.email || undefined,
      });
      router.push(next);
    } catch {
      setMessage("Login failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-charcoal">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1fr_440px]">
        <section className="relative hidden overflow-hidden bg-red p-10 text-white lg:block">
          <Link href="/" className="relative block h-20 w-64 overflow-hidden rounded-2xl bg-white/95 p-3">
            <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill priority sizes="256px" className="object-contain p-3" />
          </Link>
          <div className="mt-20 max-w-xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-white/75">Homely Meals, Everyday.</p>
            <h1 className="mt-4 text-7xl font-black leading-[0.95]">Sign in for faster ordering.</h1>
            <p className="mt-6 text-xl font-semibold leading-8 text-white/82">Save addresses, track orders, and reorder your favourite thalis in a few taps.</p>
          </div>
          <div className="absolute -bottom-12 right-0 h-[420px] w-[560px]">
            <Image src="/wah-thali-meal-cutout-v2.png" alt="" fill priority sizes="560px" className="object-contain drop-shadow-[0_26px_30px_rgba(34,31,32,0.32)]" />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-6 sm:px-5 lg:flex lg:max-w-none lg:items-center lg:px-10 lg:pb-10 lg:pt-10">
          <div className="w-full">
            <div className="flex items-center justify-between gap-3">
              <Link href="/account" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back">
                <ArrowLeft size={20} strokeWidth={3} />
              </Link>
              <Link href="/" className="relative h-12 w-40 overflow-hidden lg:hidden">
                <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill priority sizes="160px" className="object-contain" />
              </Link>
              <span className="h-10 w-10" />
            </div>

            <div className="mt-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red">Wah Thali</p>
              <h1 className="mt-2 text-3xl font-black leading-tight">Login or sign up</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">Use WhatsApp or email to continue.</p>
            </div>

            <section className="mt-6 rounded-[26px] bg-white p-4 shadow-[0_16px_44px_rgba(34,31,32,0.08)] ring-1 ring-border">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#fff4f5] p-1">
                {(["whatsapp", "email"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black ${
                      mode === item ? "bg-red text-white shadow-[0_8px_18px_rgba(214,0,50,0.18)]" : "text-charcoal"
                    }`}
                  >
                    {item === "whatsapp" ? <MessageCircle size={17} /> : <Mail size={17} />}
                    {item === "whatsapp" ? "WhatsApp" : "Email"}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                  Name
                  <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-border px-3">
                    <UserRound size={19} className="text-red" />
                    <input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      disabled={step === "otp"}
                      className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none"
                      placeholder="Customer name"
                    />
                  </span>
                </label>

                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                  Mobile number
                  <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-border px-3">
                    <Phone size={19} className="text-red" />
                    <input
                      value={form.mobile}
                      onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                      disabled={step === "otp"}
                      inputMode="tel"
                      className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none"
                      placeholder="10 digit number"
                    />
                  </span>
                </label>

                {mode === "email" ? (
                  <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                    Email
                    <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-border px-3">
                      <Mail size={19} className="text-red" />
                      <input
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        disabled={step === "otp"}
                        inputMode="email"
                        className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none"
                        placeholder="you@example.com"
                      />
                    </span>
                  </label>
                ) : null}

                {step === "otp" ? (
                  <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                    OTP
                    <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-border px-3">
                      <ShieldCheck size={19} className="text-red" />
                      <input
                        value={form.otp}
                        onChange={(event) => setForm({ ...form, otp: event.target.value })}
                        inputMode="numeric"
                        className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none"
                        placeholder="Enter OTP"
                      />
                    </span>
                  </label>
                ) : null}
              </div>

              <button
                type="button"
                onClick={step === "details" ? requestOtp : verifyOtp}
                disabled={loading}
                className="mt-5 h-12 w-full rounded-2xl bg-red text-base font-black text-white shadow-[0_10px_24px_rgba(214,0,50,0.22)] disabled:opacity-60"
              >
                {loading ? "Please wait..." : step === "details" ? "Send OTP" : "Verify and continue"}
              </button>
              {step === "otp" ? (
                <button type="button" onClick={() => setStep("details")} className="mt-3 h-11 w-full rounded-2xl border border-border bg-white text-sm font-black text-red">
                  Edit details
                </button>
              ) : null}
            </section>

            <p className="mt-4 rounded-2xl bg-[#fff4f5] p-3 text-center text-xs font-black leading-5 text-muted" aria-live="polite">
              {message}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
