"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { loadCustomerSession, readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import {
  canAccessAdminPath,
  getPermissionsForRole,
  roleLabels,
  type AdminAccessResult,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-access-shared";

type AdminAccessContextValue = {
  session: CustomerSession;
  role: AdminRole;
  permissions: AdminPermission[];
};

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null | undefined>(undefined);
  const [access, setAccess] = useState<AdminAccessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    function refreshSession() {
      if (cancelled) return;
      setSession(readCustomerSession());
    }

    const unsubscribe = subscribeCustomerSession(refreshSession);
    void loadCustomerSession().then((nextSession) => {
      if (!cancelled) setSession(nextSession);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (session === undefined) return;

      if (!session) {
        setLoading(false);
        setAccess(null);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/admin/access/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(session),
        });
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setMessage(data.error ?? "Could not check admin access.");
          setAccess(null);
          return;
        }

        setAccess(data.access);
      } catch {
        if (!cancelled) {
          setMessage("Could not connect to admin access service.");
          setAccess(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, session]);

  const contextValue = useMemo<AdminAccessContextValue | null>(() => {
    if (!session || !access?.role || !access.allowed) return null;
    return {
      session,
      role: access.role,
      permissions: getPermissionsForRole(access.role),
    };
  }, [access, session]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fb] px-4 py-8 text-charcoal">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl items-center">
          <section className="grid w-full overflow-hidden rounded-[24px] border border-[#e6e9ef] bg-white shadow-[0_24px_70px_rgba(17,24,39,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative hidden min-h-[420px] overflow-hidden bg-maroon px-8 py-9 text-white lg:block">
              <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.14))]" />
              <div className="relative z-10">
                <div className="relative h-14 w-44 overflow-hidden">
                  <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill sizes="176px" className="object-contain object-left brightness-0 invert" />
                </div>
                <div className="mt-16">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Admin workspace</p>
                  <h1 className="mt-4 max-w-[330px] text-[38px] font-black leading-[1.05]">Securing kitchen operations</h1>
                  <p className="mt-4 max-w-[330px] text-sm font-semibold leading-6 text-white/76">
                    Orders, inventory, staff roles, and live settings are protected behind account permissions.
                  </p>
                </div>
              </div>
              <div className="absolute bottom-8 left-8 right-8 z-10 grid gap-3">
                {["Session active", "Role lookup", "Permission match"].map((item, index) => (
                  <div key={item} className="grid h-11 grid-cols-[28px_1fr] items-center gap-3 rounded-xl bg-white/10 px-3 ring-1 ring-white/16">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/14 text-white">
                      {index === 2 ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}
                    </span>
                    <span className="text-sm font-black text-white/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-8 sm:px-10 lg:px-12 lg:py-14">
              <div className="mx-auto max-w-md">
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#fff4f5] text-maroon ring-1 ring-[#efd8de]">
                  <ShieldCheck size={31} strokeWidth={2.7} />
                  <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#16a34a] ring-4 ring-white" />
                </div>
                <h1 className="mt-7 text-center text-[28px] font-black leading-tight text-maroon">Checking admin access</h1>
                <p className="mx-auto mt-3 max-w-[330px] text-center text-sm font-semibold leading-6 text-muted">
                  Verifying your account role and permissions for this admin page.
                </p>
                <div className="mt-8 overflow-hidden rounded-full bg-[#eef1f6]">
                  <div className="h-2 w-2/3 rounded-full bg-maroon motion-safe:animate-pulse" />
                </div>
                <div className="mt-6 grid gap-2">
                  {["Checking signed-in account", "Reading admin role", "Opening secure dashboard"].map((item) => (
                    <div key={item} className="grid min-h-11 grid-cols-[28px_1fr] items-center gap-3 rounded-xl border border-[#e8edf3] bg-[#fafbfc] px-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-maroon ring-1 ring-[#e8edf3]">
                        <span className="h-2.5 w-2.5 rounded-full bg-maroon motion-safe:animate-pulse" />
                      </span>
                      <span className="text-sm font-black text-[#374151]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!contextValue) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-[#fff9fa] p-6 text-center shadow-[0_14px_34px_rgba(34,31,32,0.06)]">
          <ShieldAlert className="mx-auto text-red" size={36} />
          <h1 className="mt-4 text-2xl font-black text-maroon">Admin access required</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            {message || "Your logged-in account does not have an admin, manager, or staff role yet. Ask an admin to grant access from Staff Access."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/" className="inline-flex h-11 items-center rounded-lg border border-border bg-white px-4 text-sm font-black text-charcoal">
              Home
            </Link>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="inline-flex h-11 items-center rounded-lg bg-maroon px-4 text-sm font-black text-white">
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccessAdminPath(contextValue.role, pathname)) {
    return (
      <AdminAccessContext.Provider value={contextValue}>
        <main className="grid min-h-screen place-items-center bg-white px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#fff9fa] p-6 text-center shadow-[0_14px_34px_rgba(34,31,32,0.06)]">
            <ShieldAlert className="mx-auto text-red" size={36} />
            <h1 className="mt-4 text-2xl font-black text-maroon">This page needs admin access</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              You are signed in as {roleLabels[contextValue.role]}. Ask an admin to change your role if you need this page.
            </p>
            <Link href="/admin" className="mt-5 inline-flex h-11 items-center rounded-lg bg-maroon px-4 text-sm font-black text-white">
              Go to dashboard
            </Link>
          </div>
        </main>
      </AdminAccessContext.Provider>
    );
  }

  return (
    <AdminAccessContext.Provider value={contextValue}>
      {children}
    </AdminAccessContext.Provider>
  );
}
