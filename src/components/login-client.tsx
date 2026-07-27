"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, MessageSquareText, ShoppingBasket, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { saveCustomerSession } from "@/lib/customer-session";
import { addNotification } from "@/lib/notifications";

type Screen = "welcome" | "signin" | "signup";
type Step = "form" | "otp";

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", otp: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function goBack() {
    if (step === "otp") {
      setStep("form");
      return;
    }
    if (screen !== "welcome") {
      setScreen("welcome");
      setMessage("");
      return;
    }
    router.push("/");
  }

  function startOtp() {
    const mobile = cleanMobile(form.mobile);
    if (screen === "signup" && form.name.trim().length < 2) {
      setMessage("Please enter your full name.");
      return;
    }
    if (screen === "signup" && !isValidEmail(form.email.trim())) {
      setMessage("Please enter a valid email address.");
      return;
    }
    if (mobile.length !== 10) {
      setMessage("Please enter a valid 10 digit phone number.");
      return;
    }
    if (screen === "signup" && form.password.trim().length < 6) {
      setMessage("Please enter a password with at least 6 characters.");
      return;
    }

    setForm((current) => ({ ...current, mobile }));
    setStep("otp");
    setMessage("Enter the OTP sent to your phone number.");
  }

  async function verifyOtp() {
    if (form.otp.trim().length < 4) {
      setMessage("Please enter the OTP.");
      return;
    }

    setLoading(true);
    setMessage(screen === "signup" ? "Creating your account..." : "Signing you in...");

    try {
      if (screen === "signin") {
        const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(cleanMobile(form.mobile))}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.customer) {
          setMessage("No account found for this phone number. Please create an account.");
          setStep("form");
          setScreen("signup");
          return;
        }
        saveCustomerSession({
          id: data.customer.id,
          name: data.customer.name,
          mobile: data.customer.mobile,
          email: data.customer.email || undefined,
        });
        addNotification(data.customer.mobile, {
          kind: "account",
          title: "Welcome back",
          body: `Hi ${data.customer.name}, you are signed in to Wah Thali.`,
        });
        router.push(next);
        return;
      }

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
        setMessage(data.error || "Could not create account. Please try again.");
        return;
      }

      saveCustomerSession({
        id: data.customer.id,
        name: data.customer.name,
        mobile: data.customer.mobile,
        email: data.customer.email || undefined,
      });
      addNotification(data.customer.mobile, {
        kind: "account",
        title: "Welcome to Wah Thali",
        body: "Your account is ready. Fresh homely meals are waiting for you.",
      });
      router.push(next);
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (screen === "welcome") {
    return (
      <main className="min-h-screen bg-white text-charcoal">
        <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-white">
          <div className="relative z-0 h-[500px] overflow-hidden bg-maroon">
            <Image src="/wah-thali-meal-cutout-v2.png" alt="" fill priority sizes="430px" className="object-contain object-center opacity-95" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-white/55 to-white" />
          </div>
          <div className="relative z-10 -mt-14 flex flex-1 flex-col bg-gradient-to-b from-white/5 via-white/82 via-35% to-white px-6 pb-10 pt-12 text-center">
            <h1 className="text-[28px] font-black leading-tight text-charcoal">Wah Thali</h1>
            <p className="mt-4 text-[17px] font-semibold text-charcoal/85">Get favourite homely meals online</p>
            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={() => setScreen("signup")}
                className="h-14 w-full rounded-2xl bg-maroon text-[18px] font-black text-white shadow-[0_18px_34px_rgba(141,0,33,0.22)]"
              >
                Get Started
              </button>
              <p className="mt-6 text-[16px] font-semibold text-charcoal">
                Already have an account?{" "}
                <button type="button" onClick={() => setScreen("signin")} className="font-black text-maroon">
                  Log In
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const isSignup = screen === "signup";

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-charcoal">
      <section className="mx-auto min-h-screen w-full max-w-[430px] px-5 pb-10 pt-6">
        <button type="button" onClick={goBack} className="grid h-10 w-10 place-items-center rounded-full text-charcoal" aria-label="Back">
          <ArrowLeft size={25} strokeWidth={3} />
        </button>

        <div className="mt-5 text-center">
          <div className="mx-auto grid h-[82px] w-[82px] place-items-center rounded-[24px] bg-[#d8f7e9] text-maroon">
            {isSignup ? <UserPlus size={36} fill="currentColor" /> : <ShoppingBasket size={36} fill="currentColor" />}
          </div>
          <h1 className="mt-7 text-[27px] font-black leading-tight text-charcoal">{isSignup ? "Create Account" : "Welcome Back"}</h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[16px] font-semibold leading-6 text-charcoal/85">
            {isSignup ? "Join Wah Thali and get fresh homely meals fast." : "Sign in to continue your fresh ordering experience."}
          </p>
        </div>

        <section className="mt-7 grid gap-4">
          {isSignup ? (
            <>
              <AuthInput label="Full Name" value={form.name} onChange={(name) => setForm({ ...form, name })} disabled={step === "otp"} />
              <AuthInput label="Email Address" value={form.email} onChange={(email) => setForm({ ...form, email })} disabled={step === "otp"} inputMode="email" />
            </>
          ) : null}

          <div className={isSignup ? "grid grid-cols-[1fr_96px] items-end gap-3" : ""}>
            <AuthInput
              label={isSignup ? "Phone Number" : "Phone Number (e.g. 9876543210)"}
              value={form.mobile}
              onChange={(mobile) => setForm({ ...form, mobile })}
              disabled={step === "otp"}
              inputMode="tel"
            />
            {isSignup ? (
              <button type="button" onClick={startOtp} disabled={step === "otp"} className="h-[58px] rounded-2xl bg-[#0dbb52] text-[15px] font-black text-white shadow-[0_10px_18px_rgba(13,187,82,0.18)] disabled:opacity-60">
                Send OTP
              </button>
            ) : null}
          </div>

          {isSignup ? (
            <label className="relative block">
              <span className="absolute -top-2.5 left-5 bg-[#f7f8fc] px-1 text-[13px] font-semibold text-muted">Password</span>
              <input
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                disabled={step === "otp"}
                type="password"
                className="h-[58px] w-full rounded-2xl border border-[#b7c0c9] bg-transparent px-5 pr-14 text-[16px] font-semibold text-charcoal outline-none focus:border-maroon"
              />
              <Eye className="absolute right-5 top-1/2 -translate-y-1/2 text-muted" size={21} />
            </label>
          ) : null}

          {step === "otp" ? (
            <AuthInput
              label="OTP"
              value={form.otp}
              onChange={(otp) => setForm({ ...form, otp: otp.replace(/\D/g, "").slice(0, 6) })}
              inputMode="numeric"
            />
          ) : null}

          {!isSignup || step === "otp" ? (
            <button
              type="button"
              onClick={step === "form" ? startOtp : verifyOtp}
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-maroon text-[18px] font-black text-white shadow-[0_14px_28px_rgba(141,0,33,0.2)] disabled:opacity-60"
            >
              {loading ? "Please wait..." : step === "form" ? (isSignup ? "Create Account" : "Send OTP") : isSignup ? "Create Account" : "Sign In"}
            </button>
          ) : null}

          {!isSignup ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-[22px] font-semibold tracking-[0.28em] text-muted">
                <span className="h-px bg-muted/50" />
                OR
                <span className="h-px bg-muted/50" />
              </div>
              <button type="button" onClick={startOtp} className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl border border-[#9aa6b2] text-[21px] font-semibold text-charcoal">
                <MessageSquareText size={27} /> Login with OTP
              </button>
              <button type="button" onClick={() => setScreen("signup")} className="text-[17px] font-semibold text-charcoal">
                New customer? <span className="font-black text-maroon">Create Account</span>
              </button>
            </>
          ) : (
            <p className="mx-auto max-w-[330px] text-center text-[16px] font-semibold leading-7 text-charcoal/85">
              By signing up, you agree to our{" "}
              <Link href="/terms-and-conditions" className="font-black text-maroon">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy-policy" className="font-black text-maroon">Privacy Policy</Link>.
            </p>
          )}
        </section>

        {message ? <p className="mt-5 rounded-2xl bg-white p-3 text-center text-xs font-black leading-5 text-muted shadow-sm ring-1 ring-border">{message}</p> : null}

        {isSignup ? (
          <p className="mt-16 text-center text-[16px] font-semibold text-charcoal">
            Already have an account?{" "}
            <button type="button" onClick={() => setScreen("signin")} className="font-black text-maroon">
              Log In
            </button>
          </p>
        ) : null}
      </section>
    </main>
  );
}

function AuthInput({
  label,
  value,
  onChange,
  disabled,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputMode?: "email" | "tel" | "numeric";
}) {
  return (
    <label className="relative block">
      <span className="absolute -top-2.5 left-5 bg-[#f7f8fc] px-1 text-[13px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        className="h-[58px] w-full rounded-2xl border border-[#b7c0c9] bg-transparent px-5 text-[16px] font-semibold text-charcoal outline-none focus:border-maroon disabled:opacity-70"
      />
    </label>
  );
}
