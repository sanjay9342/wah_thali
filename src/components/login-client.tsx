"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Mail, MessageSquareText, Phone, ShoppingBasket, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { saveCustomerSession } from "@/lib/customer-session";
import { addNotification } from "@/lib/notifications";

type Screen = "welcome" | "signin" | "signup";
type Step = "form" | "otp";
type SignInMethod = "password" | "otp";

type ApiCustomer = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
};

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const initialMode = searchParams.get("mode");
  const [screen, setScreen] = useState<Screen>(initialMode === "signup" ? "signup" : initialMode === "signin" ? "signin" : "welcome");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", otp: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function openScreen(nextScreen: Screen) {
    setScreen(nextScreen);
    setStep("form");
    setMessage("");
    if (nextScreen === "signin") setSignInMethod("password");
  }

  function goBack() {
    if (step === "otp") {
      setStep("form");
      setMessage("");
      return;
    }
    if (screen === "signin" && signInMethod === "otp") {
      setSignInMethod("password");
      setMessage("");
      return;
    }
    if (screen !== "welcome") {
      openScreen("welcome");
      return;
    }
    router.push("/");
  }

  function saveSession(customer: ApiCustomer, title: string, body: string) {
    saveCustomerSession({
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email || undefined,
    });
    addNotification(customer.mobile, { kind: "account", title, body });
    router.push(next);
  }

  async function loginWithPassword() {
    const email = form.email.trim();
    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.");
      return;
    }
    if (form.password.trim().length < 6) {
      setMessage("Please enter your password.");
      return;
    }

    setLoading(true);
    setMessage("Signing you in...");

    try {
      const response = await fetch("/api/customers/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "password", email, password: form.password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Invalid email or password.");
        return;
      }

      saveSession(data.customer, "Welcome back", `Hi ${data.customer.name}, you are signed in to Wah Thali.`);
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    const email = form.email.trim();
    if (!isValidEmail(email)) {
      setMessage("Enter your account email first.");
      return;
    }

    setLoading(true);
    setMessage("Checking your account...");
    try {
      const response = await fetch("/api/customers/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setMessage(data.message || (response.ok ? "Password reset request recorded." : "Could not request password reset."));
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startOtp() {
    const mobile = cleanMobile(form.mobile);
    if (screen === "signup" && form.name.trim().length < 2) {
      setMessage("Please enter your full name.");
      return;
    }
    if (screen === "signup" && !isValidEmail(form.email)) {
      setMessage("Please enter a valid email address.");
      return;
    }
    if (mobile.length !== 10) {
      setMessage("Please enter a valid 10 digit WhatsApp number.");
      return;
    }
    if (screen === "signup" && form.password.trim().length < 6) {
      setMessage("Please enter a password with at least 6 characters.");
      return;
    }

    setLoading(true);
    setMessage("Sending WhatsApp OTP...");
    try {
      const response = await fetch("/api/customers/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, purpose: screen === "signup" ? "signup" : "signin" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not send WhatsApp OTP.");
        return;
      }

      setForm((current) => ({ ...current, mobile, otp: "" }));
      setStep("otp");
      setMessage(data.devOtp ? `${data.message} Dev OTP: ${data.devOtp}` : data.message);
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
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
        const response = await fetch("/api/customers/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "whatsapp_otp", mobile: cleanMobile(form.mobile), otp: form.otp.trim() }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || "Could not sign in with WhatsApp OTP.");
          return;
        }

        saveSession(data.customer, "Welcome back", `Hi ${data.customer.name}, you are signed in to Wah Thali.`);
        return;
      }

      const response = await fetch("/api/customers/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: cleanMobile(form.mobile),
          email: form.email.trim(),
          password: form.password,
          otp: form.otp.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not create account. Please try again.");
        return;
      }

      saveSession(data.customer, "Welcome to Wah Thali", "Your account is ready. Fresh homely meals are waiting for you.");
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
                onClick={() => openScreen("signup")}
                className="h-14 w-full rounded-2xl bg-maroon text-[18px] font-black text-white shadow-[0_18px_34px_rgba(141,0,33,0.22)]"
              >
                Get Started
              </button>
              <p className="mt-6 text-[16px] font-semibold text-charcoal">
                Already have an account?{" "}
                <button type="button" onClick={() => openScreen("signin")} className="font-black text-maroon">
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
  const isOtpSignIn = screen === "signin" && signInMethod === "otp";

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
          <h1 className="mt-7 text-[27px] font-black leading-tight text-charcoal">
            {isSignup ? "Create Account" : isOtpSignIn ? "WhatsApp Login" : "Welcome Back"}
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[16px] font-semibold leading-6 text-charcoal/85">
            {isSignup ? "Join Wah Thali and get fresh homely meals fast." : "Sign in to continue your fresh ordering experience."}
          </p>
        </div>

        <section className="mt-7 grid gap-4">
          {isSignup ? (
            <>
              <AuthInput label="Full Name" value={form.name} onChange={(name) => setForm({ ...form, name })} disabled={step === "otp"} autoComplete="name" />
              <AuthInput label="Email Address" value={form.email} onChange={(email) => setForm({ ...form, email })} disabled={step === "otp"} inputMode="email" type="email" autoComplete="email" />
              <AuthInput label="WhatsApp Number" value={form.mobile} onChange={(mobile) => setForm({ ...form, mobile })} disabled={step === "otp"} inputMode="tel" autoComplete="tel" />
              <PasswordInput value={form.password} onChange={(password) => setForm({ ...form, password })} disabled={step === "otp"} showPassword={showPassword} setShowPassword={setShowPassword} />
            </>
          ) : isOtpSignIn ? (
            <AuthInput label="WhatsApp Number" value={form.mobile} onChange={(mobile) => setForm({ ...form, mobile })} disabled={step === "otp"} inputMode="tel" autoComplete="tel" icon={<Phone size={19} />} />
          ) : (
            <>
              <AuthInput label="Email Address" value={form.email} onChange={(email) => setForm({ ...form, email })} inputMode="email" type="email" autoComplete="email" icon={<Mail size={19} />} />
              <PasswordInput value={form.password} onChange={(password) => setForm({ ...form, password })} showPassword={showPassword} setShowPassword={setShowPassword} autoComplete="current-password" />
              <button type="button" onClick={requestPasswordReset} disabled={loading} className="-mt-1 justify-self-end text-[13px] font-black text-maroon disabled:opacity-60">
                Forgot password?
              </button>
            </>
          )}

          {step === "otp" ? (
            <AuthInput
              label="OTP"
              value={form.otp}
              onChange={(otp) => setForm({ ...form, otp: otp.replace(/\D/g, "").slice(0, 6) })}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          ) : null}

          <button
            type="button"
            onClick={isSignup || isOtpSignIn ? (step === "form" ? startOtp : verifyOtp) : loginWithPassword}
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-maroon text-[17px] font-black text-white shadow-[0_14px_28px_rgba(141,0,33,0.2)] disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isSignup
                ? step === "form" ? "Send WhatsApp OTP" : "Create Account"
                : isOtpSignIn
                  ? step === "form" ? "Send WhatsApp OTP" : "Sign In"
                  : "Login"}
          </button>

          {!isSignup ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-[17px] font-semibold tracking-[0.18em] text-muted">
                <span className="h-px bg-muted/40" />
                OR
                <span className="h-px bg-muted/40" />
              </div>
              {isOtpSignIn ? (
                <button type="button" onClick={() => { setSignInMethod("password"); setStep("form"); setMessage(""); }} className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#9aa6b2] text-[17px] font-bold text-charcoal">
                  <Mail size={22} /> Use email and password
                </button>
              ) : (
                <button type="button" onClick={() => { setSignInMethod("otp"); setStep("form"); setMessage(""); }} className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#9aa6b2] text-[17px] font-bold text-charcoal">
                  <MessageSquareText size={22} /> Login with WhatsApp OTP
                </button>
              )}
              <button type="button" onClick={() => openScreen("signup")} className="text-[16px] font-semibold text-charcoal">
                New customer? <span className="font-black text-maroon">Create Account</span>
              </button>
            </>
          ) : (
            <p className="mx-auto max-w-[330px] text-center text-[15px] font-semibold leading-7 text-charcoal/85">
              By signing up, you agree to our{" "}
              <Link href="/terms-and-conditions" className="font-black text-maroon">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy-policy" className="font-black text-maroon">Privacy Policy</Link>.
            </p>
          )}
        </section>

        {message ? <p className="mt-5 rounded-2xl bg-white p-3 text-center text-xs font-black leading-5 text-muted shadow-sm ring-1 ring-border">{message}</p> : null}

        {isSignup ? (
          <p className="mt-12 text-center text-[16px] font-semibold text-charcoal">
            Already have an account?{" "}
            <button type="button" onClick={() => openScreen("signin")} className="font-black text-maroon">
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
  type = "text",
  autoComplete,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputMode?: "email" | "tel" | "numeric";
  type?: "email" | "text";
  autoComplete?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="absolute -top-2.5 left-5 bg-[#f7f8fc] px-1 text-[13px] font-semibold text-muted">{label}</span>
      {icon ? <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">{icon}</span> : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        type={type}
        autoComplete={autoComplete}
        className={`h-[58px] w-full rounded-2xl border border-[#b7c0c9] bg-transparent ${icon ? "pl-12" : "px-5"} text-[16px] font-semibold text-charcoal outline-none focus:border-maroon disabled:opacity-70`}
      />
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  disabled,
  showPassword,
  setShowPassword,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showPassword: boolean;
  setShowPassword: (value: boolean | ((current: boolean) => boolean)) => void;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <span className="absolute -top-2.5 left-5 bg-[#f7f8fc] px-1 text-[13px] font-semibold text-muted">Password</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        className="h-[58px] w-full rounded-2xl border border-[#b7c0c9] bg-transparent px-5 pr-14 text-[16px] font-semibold text-charcoal outline-none focus:border-maroon disabled:opacity-70"
      />
      <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
      </button>
    </label>
  );
}
