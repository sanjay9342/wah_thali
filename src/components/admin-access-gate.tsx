"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
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
    function refreshSession() {
      setSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
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
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-[#fff9fa] p-6 text-center shadow-[0_14px_34px_rgba(34,31,32,0.06)]">
          <ShieldCheck className="mx-auto text-red" size={34} />
          <h1 className="mt-4 text-xl font-black text-maroon">Checking admin access</h1>
          <p className="mt-2 text-sm font-semibold text-muted">Please wait while we verify your account role.</p>
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
