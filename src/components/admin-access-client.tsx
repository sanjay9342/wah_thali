"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { useAdminAccess } from "@/components/admin-access-gate";
import {
  adminRoles,
  roleDescriptions,
  roleLabels,
  type AdminAccessAssignment,
  type AdminRole,
} from "@/lib/admin-access-shared";

type AccessCustomer = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
};

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function assignmentKey(assignment: AdminAccessAssignment) {
  return assignment.customerId || cleanMobile(assignment.mobile) || assignment.email || assignment.name;
}

export function AdminAccessClient() {
  const adminAccess = useAdminAccess();
  const [customers, setCustomers] = useState<AccessCustomer[]>([]);
  const [assignments, setAssignments] = useState<AdminAccessAssignment[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const actor = adminAccess?.session;

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!actor) return;
      setLoading(true);
      setMessage("");

      const params = new URLSearchParams({
        actorId: actor.id ?? "",
        actorName: actor.name,
        actorMobile: actor.mobile,
        actorEmail: actor.email ?? "",
      });

      try {
        const response = await fetch(`/api/admin/access?${params.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setMessage(data.error ?? "Could not load staff access.");
          return;
        }

        setCustomers(data.customers ?? []);
        setAssignments(data.assignments ?? []);
      } catch {
        if (!cancelled) setMessage("Could not connect to staff access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [actor]);

  const assignmentByMobile = useMemo(() => {
    return new Map(assignments.map((assignment) => [cleanMobile(assignment.mobile), assignment]));
  }, [assignments]);

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (!needle) return true;
      const assignment = assignmentByMobile.get(cleanMobile(customer.mobile));
      return `${customer.name} ${customer.mobile} ${customer.email ?? ""} ${assignment?.role ?? ""}`.toLowerCase().includes(needle);
    });
  }, [assignmentByMobile, customers, query]);

  const activeAssignments = assignments.filter((assignment) => assignment.active);

  function updateAccess(customer: AccessCustomer, role: AdminRole, active = true) {
    if (!actor) return;
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/admin/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          target: {
            id: customer.id,
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email ?? undefined,
          },
          role,
          active,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not update staff access.");
        return;
      }

      setAssignments((current) => [
        data.assignment,
        ...current.filter((assignment) => assignmentKey(assignment) !== assignmentKey(data.assignment)),
      ]);
      setMessage(`${customer.name} is now ${active ? roleLabels[role] : "disabled"}.`);
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Role based access</p>
            <h1 className="text-3xl font-black text-maroon">Staff Access</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Give logged-in customer accounts permission to manage admin pages.</p>
          </div>
        </div>
        <AdminSectionNav />

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {adminRoles.map((role) => (
            <div key={role} className="surface rounded-2xl p-5">
              <ShieldCheck className="text-red" size={24} />
              <h2 className="mt-4 text-xl font-black text-maroon">{roleLabels[role]}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{roleDescriptions[role]}</p>
              <p className="mt-4 text-sm font-black text-charcoal">
                {activeAssignments.filter((assignment) => assignment.role === role).length} active
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="surface rounded-2xl p-5">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-cream px-3">
              <Search size={17} className="text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold"
                placeholder="Search users"
              />
            </label>

            <div className="mt-5 rounded-xl border border-border bg-[#fff9fa] p-4">
              <h2 className="text-sm font-black text-maroon">How it works</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                Users must create or log into a normal Wah Thali account first. Then an Admin can assign their role here.
              </p>
            </div>
          </aside>

          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-black text-maroon">Logged-in accounts</h2>
              <p className="text-sm font-semibold text-muted">{loading ? "Loading users..." : `${filteredCustomers.length} user accounts shown`}</p>
            </div>

            {message ? <p className="m-5 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

            <div className="divide-y divide-border">
              {filteredCustomers.length ? filteredCustomers.map((customer) => {
                const assignment = assignmentByMobile.get(cleanMobile(customer.mobile));
                const currentRole = assignment?.role ?? "STAFF";
                const active = Boolean(assignment?.active);
                return (
                  <article key={customer.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black text-charcoal">{customer.name}</h3>
                        {active ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-2.5 py-1 text-[11px] font-black text-red">
                            <ShieldCheck size={13} /> {roleLabels[currentRole]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-cream px-2.5 py-1 text-[11px] font-black text-muted">
                            <ShieldOff size={13} /> No admin access
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-muted">{customer.mobile}{customer.email ? ` - ${customer.email}` : ""}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <select
                        value={currentRole}
                        onChange={(event) => updateAccess(customer, event.target.value as AdminRole, true)}
                        disabled={isPending}
                        className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal disabled:opacity-60"
                        aria-label={`Role for ${customer.name}`}
                      >
                        {adminRoles.map((role) => (
                          <option key={role} value={role}>{roleLabels[role]}</option>
                        ))}
                      </select>
                      {active ? (
                        <button
                          type="button"
                          onClick={() => updateAccess(customer, currentRole, false)}
                          disabled={isPending}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-red disabled:opacity-60"
                        >
                          <ShieldOff size={16} /> Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateAccess(customer, currentRole, true)}
                          disabled={isPending}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white disabled:opacity-60"
                        >
                          <UserCog size={16} /> Grant
                        </button>
                      )}
                    </div>
                  </article>
                );
              }) : (
                <div className="p-8 text-center">
                  <h2 className="text-xl font-black text-maroon">{loading ? "Loading users" : "No users found"}</h2>
                  <p className="mt-2 text-sm font-semibold text-muted">Ask staff to create a normal account first, then assign a role here.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
