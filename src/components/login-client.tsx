"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, MessageSquareText, Phone, ShoppingBasket, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { saveCustomerSession } from "@/lib/customer-session";
import { addNotification } from "@/lib/notifications";

type Screen = "welcome" | "signin" | "signup" | "reset";
type Step = "form" | "otp";
type SignInMethod = "password" | "otp";

type ApiCustomer = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
};

type ApiError = {
  error?: unknown;
  message?: unknown;
  code?: string;
  missing?: string[];
};

type ApiResponse = ApiError & {
  customer?: ApiCustomer;
  resetMode?: "email" | "whatsapp_otp" | "link";
  resetUrl?: string;
};

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function cleanApiMessage(value: unknown, fallback: string) {
  const message = typeof value === "string" && value.trim() ? value : fallback;
  if (/DATABASE_URL|SUPABASE_|RAZORPAY_|META_|SECRET|TOKEN/i.test(message)) {
    return "Service is temporarily unavailable. Please contact support.";
  }
  return message;
}

async function readApiJson(response: Response): Promise<ApiResponse> {
  return response.json().catch(() => ({}));
}

function otpErrorMessage(data: ApiError, fallback: string) {
  switch (data.code) {
    case "DATABASE_NOT_CONFIGURED":
      return "Login and registration are offline because the live server is missing its database connection.";
    case "WHATSAPP_NOT_CONFIGURED":
      return data.missing?.length
        ? `WhatsApp OTP is missing on the live server: ${data.missing.join(", ")}.`
        : "WhatsApp OTP is not configured on this server. Please contact support.";
    case "WHATSAPP_AUTH_FAILED":
      return "WhatsApp OTP credentials were rejected. Please contact support.";
    case "WHATSAPP_TEMPLATE_FAILED":
      return "WhatsApp OTP template or language is not approved correctly. Please contact support.";
    case "WHATSAPP_TEMPLATE_PARAMETERS_FAILED":
      return "WhatsApp OTP template button or parameter setup is incorrect. Please contact support.";
    case "WHATSAPP_SEND_FAILED":
      return "WhatsApp could not deliver the OTP right now. Please contact support.";
    case "OTP_CREATE_FAILED":
      return "Could not create OTP. Please try again.";
    default:
      return cleanApiMessage(data.error, fallback);
  }
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const initialMode = searchParams.get("mode");
  const resetToken = searchParams.get("token") || "";
  const [screen, setScreen] = useState<Screen>(
    initialMode === "signup" ? "signup" : initialMode === "signin" ? "signin" : initialMode === "reset" ? "reset" : "welcome",
  );
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", confirmPassword: "", otp: "", resetToken });
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
    if (screen === "reset") {
      openScreen("signin");
      return;
    }
    if (screen !== "welcome") {
      openScreen("welcome");
      return;
    }
    router.push("/");
  }

  async function saveSession(customer: ApiCustomer, title: string, body: string) {
    await saveCustomerSession({
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
    setMessage("");

    try {
      const response = await fetch("/api/customers/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "password", email, password: form.password }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        setMessage(cleanApiMessage(data.error, "Invalid email or password."));
        return;
      }
      if (!data.customer) {
        setMessage("Could not read your account details. Please try again.");
        return;
      }

      await saveSession(data.customer, "Welcome back", `Hi ${data.customer.name}, you are signed in to Wah Thali.`);
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
    setMessage("");
    try {
      const response = await fetch("/api/customers/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        setMessage(cleanApiMessage(data.error, "Could not request password reset."));
        return;
      }

      if (data.resetMode === "whatsapp_otp") {
        setForm((current) => ({ ...current, email, password: "", confirmPassword: "", otp: "", resetToken: "" }));
        setScreen("reset");
        setStep("form");
      } else if (data.resetMode === "link" && data.resetUrl) {
        const resetLink = new URL(data.resetUrl);
        setForm((current) => ({ ...current, email, password: "", confirmPassword: "", otp: "", resetToken: resetLink.searchParams.get("token") || "" }));
        setScreen("reset");
        setStep("form");
      }

      setMessage(cleanApiMessage(data.message, "Password reset request recorded."));
    } catch {
      setMessage("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const resetEmail = form.email.trim();
    const resetOtp = form.otp.trim();
    if (!form.resetToken && !isValidEmail(resetEmail)) {
      setMessage("Please request a fresh password reset from your account email.");
      return;
    }
    if (!form.resetToken && resetOtp.length < 4) {
      setMessage("Please enter the WhatsApp OTP sent for password reset.");
      return;
    }
    if (form.password.trim().length < 6) {
      setMessage("Please enter a password with at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Both password fields must match.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/customers/password-reset", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.resetToken
          ? { token: form.resetToken, password: form.password }
          : { email: resetEmail, otp: resetOtp, password: form.password }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        setMessage(cleanApiMessage(data.error, "Could not reset password."));
        return;
      }

      setForm((current) => ({ ...current, password: "", confirmPassword: "", otp: "", resetToken: "" }));
      setSignInMethod("password");
      setScreen("signin");
      setMessage(cleanApiMessage(data.message, "Your password has been reset. Please log in."));
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
    setMessage("");
    try {
      const response = await fetch("/api/customers/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, purpose: screen === "signup" ? "signup" : "signin" }),
      });
      const data = await readApiJson(response);
      if (!response.ok) {
        setMessage(otpErrorMessage(data, "Could not send WhatsApp OTP."));
        return;
      }

      setForm((current) => ({ ...current, mobile, otp: "" }));
      setStep("otp");
      setMessage(cleanApiMessage(data.message, "WhatsApp OTP sent."));
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
    setMessage("");

    try {
      if (screen === "signin") {
        const response = await fetch("/api/customers/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "whatsapp_otp", mobile: cleanMobile(form.mobile), otp: form.otp.trim() }),
        });
        const data = await readApiJson(response);
        if (!response.ok) {
          setMessage(otpErrorMessage(data, "Could not sign in with WhatsApp OTP."));
          return;
        }
        if (!data.customer) {
          setMessage("Could not read your account details. Please try again.");
          return;
        }

        await saveSession(data.customer, "Welcome back", `Hi ${data.customer.name}, you are signed in to Wah Thali.`);
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
      const data = await readApiJson(response);
      if (!response.ok) {
        setMessage(otpErrorMessage(data, "Could not create account. Please try again."));
        return;
      }
      if (!data.customer) {
        setMessage("Could not read your new account details. Please try again.");
        return;
      }

      await saveSession(data.customer, "Welcome to Wah Thali", "Your account is ready. Fresh homely meals are waiting for you.");
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
            <Image src="/wah-thali-meal-cutout-v2.png" alt="" fill loading="eager" sizes="430px" className="object-contain object-center opacity-95" />
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
  const isReset = screen === "reset";
  const isOtpSignIn = screen === "signin" && signInMethod === "otp";
  const otpFlowActive = isSignup || isOtpSignIn;
  const otpInlineMessage = otpFlowActive && /WhatsApp OTP|OTP sent/i.test(message) ? message : "";
  const pageMessage = otpInlineMessage ? "" : message;

  return (
    <main className="min-h-screen bg-white text-charcoal">
      <section className="mx-auto min-h-screen w-full max-w-[430px] px-5 pb-10 pt-6">
        <button type="button" onClick={goBack} className="grid h-10 w-10 place-items-center rounded-full text-charcoal" aria-label="Back">
          <ArrowLeft size={25} strokeWidth={3} />
        </button>

        <div className="mt-5 text-center">
          <div className="mx-auto grid h-[82px] w-[82px] place-items-center rounded-[24px] bg-[#d8f7e9] text-maroon">
            {isSignup ? <UserPlus size={36} fill="currentColor" /> : isReset ? <KeyRound size={36} /> : <ShoppingBasket size={36} fill="currentColor" />}
          </div>
          <h1 className="mt-7 text-[27px] font-black leading-tight text-charcoal">
            {isSignup ? "Create Account" : isReset ? "Reset Password" : isOtpSignIn ? "WhatsApp Login" : "Welcome Back"}
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[16px] font-semibold leading-6 text-charcoal/85">
            {isSignup
              ? "Join Wah Thali and get fresh homely meals fast."
              : isReset
                ? "Choose a new password for your Wah Thali account."
                : "Sign in to continue your fresh ordering experience."}
          </p>
        </div>

        <section className="mt-7 grid gap-4">
          {isReset ? (
            <>
              {!form.resetToken ? (
                <>
                  <AuthInput label="Account Email" value={form.email} onChange={(email) => setForm({ ...form, email })} inputMode="email" type="email" autoComplete="email" icon={<Mail size={19} />} />
                  <AuthInput
                    label="WhatsApp OTP"
                    value={form.otp}
                    onChange={(otp) => setForm({ ...form, otp: otp.replace(/\D/g, "").slice(0, 6) })}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </>
              ) : null}
              <PasswordInput label="New Password" value={form.password} onChange={(password) => setForm({ ...form, password })} showPassword={showPassword} setShowPassword={setShowPassword} autoComplete="new-password" />
              <PasswordInput label="Confirm Password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} showPassword={showPassword} setShowPassword={setShowPassword} autoComplete="new-password" />
            </>
          ) : isSignup ? (
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

          {pageMessage ? (
            <p className="-mt-1 rounded-2xl border border-[#f0d7dd] bg-[#fff4f5] px-4 py-3 text-center text-xs font-black leading-5 text-maroon" aria-live="polite">
              {pageMessage}
            </p>
          ) : null}

          <button
            type="button"
            onClick={isReset ? resetPassword : isSignup || isOtpSignIn ? (step === "form" ? startOtp : verifyOtp) : loginWithPassword}
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-maroon text-[17px] font-black text-white shadow-[0_14px_28px_rgba(141,0,33,0.2)] disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isReset
                ? "Reset Password"
                : isSignup
                ? step === "form" ? "Send WhatsApp OTP" : "Create Account"
                : isOtpSignIn
                  ? step === "form" ? "Send WhatsApp OTP" : "Sign In"
                  : "Login"}
          </button>
          {otpInlineMessage ? (
            <p className="-mt-2 text-center text-[12px] font-black leading-5 text-muted" aria-live="polite">
              {otpInlineMessage}
            </p>
          ) : null}

          {!isSignup && !isReset ? (
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

          {isReset ? (
            <button type="button" onClick={() => openScreen("signin")} className="text-[16px] font-semibold text-charcoal">
              Remembered it? <span className="font-black text-maroon">Log In</span>
            </button>
          ) : null}
        </section>

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
  label = "Password",
  value,
  onChange,
  disabled,
  showPassword,
  setShowPassword,
  autoComplete = "new-password",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showPassword: boolean;
  setShowPassword: (value: boolean | ((current: boolean) => boolean)) => void;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <span className="absolute -top-2.5 left-5 bg-[#f7f8fc] px-1 text-[13px] font-semibold text-muted">{label}</span>
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
