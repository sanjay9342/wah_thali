"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Mail, MapPin, Phone, UsersRound, Utensils, Wallet } from "lucide-react";

type LeadIntent = "Office meals" | "Monthly subscription" | "Bulk event" | "Daily staff lunch";

const requirementOptions: LeadIntent[] = ["Bulk event", "Monthly subscription", "Office meals", "Daily staff lunch"];
const peopleOptions = ["10-20 people", "20-50 people", "50-100 people", "100+ people"];
const preferenceOptions = ["Veg", "Non-Veg", "Veg / Non-Veg", "Jain", "Eggetarian"];
const budgetOptions = ["Under Rs 120/person", "Rs 120-180/person", "Rs 180-250/person", "Custom budget"];

function cleanPhone(value: string) {
  return value.replace(/[^\d]/g, "").slice(-10);
}

export function BulkOrderFormClient() {
  const [form, setForm] = useState({
    intent: "Bulk event" as LeadIntent,
    name: "",
    phone: "",
    email: "",
    company: "",
    headcount: "20-50 people",
    mealsPerDay: "25",
    planFrequency: "One-time bulk order",
    startDate: "",
    area: "",
    budget: "Rs 120-180/person",
    deliveryTime: "12:30 PM - 1:30 PM",
    mealPreference: "Veg / Non-Veg",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const headcountNumber = useMemo(() => {
    const match = form.headcount.match(/\d+/);
    return match ? Number(match[0]) : Number(form.mealsPerDay || 25);
  }, [form.headcount, form.mealsPerDay]);

  async function submitLead() {
    const phone = cleanPhone(form.phone);
    if (!form.name.trim()) return setMessage("Please enter your full name.");
    if (!form.company.trim()) return setMessage("Please enter company or organization name.");
    if (!form.email.trim() || !form.email.includes("@")) return setMessage("Please enter work email.");
    if (phone.length !== 10) return setMessage("Please enter a valid 10 digit phone number.");
    if (!form.startDate.trim()) return setMessage("Please select date of requirement.");
    if (!form.area.trim()) return setMessage("Please enter delivery location.");

    setSubmitting(true);
    setMessage("Sending corporate meal inquiry...");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: form.intent,
          name: form.name,
          phone,
          email: form.email,
          company: form.company,
          headcount: headcountNumber,
          mealsPerDay: headcountNumber,
          planFrequency: form.planFrequency,
          startDate: form.startDate,
          area: form.area,
          budget: form.budget,
          deliveryTime: form.deliveryTime,
          notes: `Meal preference: ${form.mealPreference}\n${form.notes}`,
        }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Inquiry saved. Wah Thali team will contact you shortly." : data.error || "Could not save inquiry. Please try again.");
    } catch {
      setMessage("Could not save inquiry. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl bg-white px-5 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
      <section className="overflow-hidden rounded-[24px] bg-red p-6 text-white shadow-[0_16px_36px_rgba(214,0,50,0.16)] sm:p-8 lg:p-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Wah Thali offers</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Bulk meals and office catering</h1>
        <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/82">Fresh thalis for meetings, offices, subscriptions, and events.</p>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[22px] border border-[#f1e7e4] bg-white p-5 shadow-[0_12px_34px_rgba(34,31,32,0.06)]">
          <h2 className="text-xl font-black text-charcoal">Requirement type</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {requirementOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setForm({ ...form, intent: item, planFrequency: item === "Bulk event" ? "One-time bulk order" : "Weekdays" })}
                className={`rounded-2xl border p-4 text-left text-sm font-black ${form.intent === item ? "border-red bg-[#fff4f5] text-red" : "border-[#f1e7e4] bg-white text-charcoal"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#f1e7e4] bg-white p-5 shadow-[0_12px_34px_rgba(34,31,32,0.06)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field icon={<UsersRound size={20} />} label="Full Name" value={form.name} placeholder="Enter your full name" onChange={(name) => setForm({ ...form, name })} />
            <Field icon={<BriefcaseBusiness size={20} />} label="Company" value={form.company} placeholder="Company or organization" onChange={(company) => setForm({ ...form, company })} />
            <Field icon={<Mail size={20} />} label="Work Email" value={form.email} placeholder="name@company.com" onChange={(email) => setForm({ ...form, email })} />
            <Field icon={<Phone size={20} />} label="Phone Number" value={form.phone} placeholder="10 digit mobile" onChange={(phone) => setForm({ ...form, phone })} />
            <Select icon={<UsersRound size={20} />} label="Number of People" value={form.headcount} options={peopleOptions} onChange={(headcount) => setForm({ ...form, headcount })} />
            <Field icon={<CalendarDays size={20} />} label="Date" value={form.startDate} placeholder="DD/MM/YYYY" onChange={(startDate) => setForm({ ...form, startDate })} />
            <Select icon={<Utensils size={20} />} label="Meal Preference" value={form.mealPreference} options={preferenceOptions} onChange={(mealPreference) => setForm({ ...form, mealPreference })} />
            <Select icon={<Wallet size={20} />} label="Budget" value={form.budget} options={budgetOptions} onChange={(budget) => setForm({ ...form, budget })} />
          </div>

          <div className="mt-4 grid gap-4">
            <Field icon={<MapPin size={20} />} label="Delivery Location" value={form.area} placeholder="Complete delivery address" onChange={(area) => setForm({ ...form, area })} />
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="min-h-28 rounded-2xl border border-[#f1e7e4] bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal text-charcoal outline-none"
                placeholder="Menu preferences, timing, special requests"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={submitLead}
            disabled={submitting}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red text-base font-black text-white shadow-[0_10px_24px_rgba(214,0,50,0.22)] disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Request Quote"} <ArrowRight size={18} />
          </button>
          {message ? <p className="mt-4 rounded-2xl bg-[#fff4f5] p-3 text-center text-xs font-black text-muted" aria-live="polite">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}

function Field({ icon, label, value, placeholder, onChange }: { icon: React.ReactNode; label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
      {label}
      <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-[#f1e7e4] px-3">
        <span className="text-red">{icon}</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none" placeholder={placeholder} />
      </span>
    </label>
  );
}

function Select({ icon, label, value, options, onChange }: { icon: React.ReactNode; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
      {label}
      <span className="grid h-12 grid-cols-[34px_1fr] items-center rounded-2xl border border-[#f1e7e4] px-3">
        <span className="text-red">{icon}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-sm font-bold normal-case tracking-normal text-charcoal outline-none">
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </span>
    </label>
  );
}
