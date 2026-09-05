"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Search, ShieldCheck, ShieldOff, UserCog, X } from "lucide-react";
import { AdminFloatingMessage } from "@/components/admin-floating-message";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { useAdminAccess } from "@/components/admin-access-gate";
import {
  adminPermissions,
  adminRoles,
  getPermissionsForAssignment,
  permissionDescriptions,
  permissionLabels,
  roleLabels,
  rolePermissions,
  type AdminAccessAssignment,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-access-shared";

type AccessCustomer = {
  id?: string;
  name: string;
  mobile: string;
  email?: string | null;
};

type PendingAccessChange = {
  customer: AccessCustomer;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  previousRole?: AdminRole;
};

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function getAdminMessageTone(message: string) {
  return /failed|error|could not|invalid|required|permission/i.test(message) ? "error" : "success";
}

function assignmentKey(assignment: AdminAccessAssignment) {
  return assignment.customerId || cleanMobile(assignment.mobile) || assignment.email || assignment.name;
}

export function AdminAccessClient() {
  const adminAccess = useAdminAccess();
  const [customers, setCustomers] = useState<AccessCustomer[]>([]);
  const [assignments, setAssignments] = useState<AdminAccessAssignment[]>([]);
  const [query, setQuery] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AdminRole>>({});
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, AdminPermission[]>>({});
  const [pendingChange, setPendingChange] = useState<PendingAccessChange | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const actor = adminAccess?.session;
  const searchReady = query.trim().length >= 2;

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadAccess();
    }, query.trim() ? 260 : 0);

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
      if (query.trim()) params.set("q", query.trim());

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

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [actor, query]);

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

  const activeAssignments = useMemo(() => assignments.filter((assignment) => assignment.active), [assignments]);
  const visibleAssignments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return activeAssignments;
    return activeAssignments.filter((assignment) =>
      `${assignment.name} ${assignment.mobile} ${assignment.email ?? ""} ${assignment.role}`.toLowerCase().includes(needle),
    );
  }, [activeAssignments, query]);

  function getCustomerKey(customer: AccessCustomer) {
    return customer.id || cleanMobile(customer.mobile) || customer.email || customer.name;
  }

  function getDraftRole(customer: AccessCustomer, fallback: AdminRole) {
    return roleDrafts[getCustomerKey(customer)] ?? fallback;
  }

  function getDraftPermissions(customer: AccessCustomer, fallback: AdminPermission[]) {
    return permissionDrafts[getCustomerKey(customer)] ?? fallback;
  }

  function chooseRole(customer: AccessCustomer, role: AdminRole) {
    const key = getCustomerKey(customer);
    setRoleDrafts((current) => ({ ...current, [getCustomerKey(customer)]: role }));
    setPermissionDrafts((current) => ({ ...current, [key]: rolePermissions[role] }));
  }

  function togglePermission(customer: AccessCustomer, permission: AdminPermission, fallback: AdminPermission[]) {
    const key = getCustomerKey(customer);
    const currentPermissions = getDraftPermissions(customer, fallback);
    const nextPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((item) => item !== permission)
      : [...currentPermissions, permission];
    setPermissionDrafts((current) => ({ ...current, [key]: nextPermissions }));
  }

  function requestAccessChange(customer: AccessCustomer, role: AdminRole, active = true, previousRole?: AdminRole, permissions = rolePermissions[role]) {
    setPendingChange({ customer, role, permissions, active, previousRole });
  }

  function updateAccess(customer: AccessCustomer, role: AdminRole, permissions: AdminPermission[], active = true) {
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
          permissions,
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
      setRoleDrafts((current) => ({ ...current, [getCustomerKey(customer)]: role }));
      setPermissionDrafts((current) => ({ ...current, [getCustomerKey(customer)]: data.assignment.permissions ?? permissions }));
      setPendingChange(null);
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

        <section className="mt-6">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="grid gap-4 border-b border-border p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div>
                <h2 className="text-xl font-black text-maroon">Staff role assignments</h2>
                <p className="text-sm font-semibold text-muted">
                  {searchReady
                    ? loading ? "Searching customer accounts..." : `${filteredCustomers.length} matching customer account${filteredCustomers.length === 1 ? "" : "s"}`
                    : `${activeAssignments.length} active staff account${activeAssignments.length === 1 ? "" : "s"}. Search to grant a new role.`}
                </p>
              </div>
              <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-cream px-3">
                <Search size={17} className="text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold"
                  placeholder="Search name, mobile, email"
                />
              </label>
            </div>

            {message ? <AdminFloatingMessage message={message} tone={getAdminMessageTone(message)} /> : null}

            <div className="divide-y divide-border">
              {!searchReady && visibleAssignments.length ? visibleAssignments.map((assignment) => {
                const customer: AccessCustomer = {
                  id: assignment.customerId,
                  name: assignment.name,
                  mobile: assignment.mobile,
                  email: assignment.email,
                };
                const selectedRole = getDraftRole(customer, assignment.role);
                const savedPermissions = getPermissionsForAssignment(assignment);
                const selectedPermissions = getDraftPermissions(customer, savedPermissions);
                return (
                  <article key={assignmentKey(assignment)} className="grid gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black text-charcoal">{assignment.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-2.5 py-1 text-[11px] font-black text-red">
                          <ShieldCheck size={13} /> {roleLabels[assignment.role]}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-muted">{assignment.mobile}{assignment.email ? ` - ${assignment.email}` : ""}</p>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_auto] xl:items-start">
                      <select
                        value={selectedRole}
                        onChange={(event) => chooseRole(customer, event.target.value as AdminRole)}
                        disabled={isPending}
                        className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal disabled:opacity-60"
                        aria-label={`Role for ${assignment.name}`}
                      >
                        {adminRoles.map((role) => (
                          <option key={role} value={role}>{roleLabels[role]}</option>
                        ))}
                      </select>
                      <PermissionChecklist
                        selectedPermissions={selectedPermissions}
                        onToggle={(permission) => togglePermission(customer, permission, savedPermissions)}
                      />
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => requestAccessChange(customer, selectedRole, true, assignment.role, selectedPermissions)}
                          disabled={isPending || selectedPermissions.length === 0}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white disabled:opacity-60"
                        >
                          <UserCog size={16} /> Save access
                        </button>
                        <button
                          type="button"
                          onClick={() => requestAccessChange(customer, assignment.role, false, assignment.role, selectedPermissions)}
                          disabled={isPending}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-red disabled:opacity-60"
                        >
                          <ShieldOff size={16} /> Disable
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }) : null}

              {searchReady && filteredCustomers.length ? filteredCustomers.map((customer) => {
                const assignment = assignmentByMobile.get(cleanMobile(customer.mobile));
                const currentRole = assignment?.role ?? "STAFF";
                const active = Boolean(assignment?.active);
                const selectedRole = getDraftRole(customer, currentRole);
                const savedPermissions = assignment ? getPermissionsForAssignment(assignment) : rolePermissions[currentRole];
                const selectedPermissions = getDraftPermissions(customer, savedPermissions);
                return (
                  <article key={customer.id} className="grid gap-4 p-5">
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

                    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_auto] xl:items-start">
                      <select
                        value={selectedRole}
                        onChange={(event) => chooseRole(customer, event.target.value as AdminRole)}
                        disabled={isPending}
                        className="h-10 rounded-lg border border-border bg-cream px-3 text-sm font-black text-charcoal disabled:opacity-60"
                        aria-label={`Role for ${customer.name}`}
                      >
                        {adminRoles.map((role) => (
                          <option key={role} value={role}>{roleLabels[role]}</option>
                        ))}
                      </select>
                      <PermissionChecklist
                        selectedPermissions={selectedPermissions}
                        onToggle={(permission) => togglePermission(customer, permission, savedPermissions)}
                      />
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {active ? (
                          <>
                            <button
                              type="button"
                              onClick={() => requestAccessChange(customer, selectedRole, true, currentRole, selectedPermissions)}
                              disabled={isPending || selectedPermissions.length === 0}
                              className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white disabled:opacity-60"
                            >
                              <UserCog size={16} /> Save access
                            </button>
                            <button
                              type="button"
                              onClick={() => requestAccessChange(customer, currentRole, false, currentRole, selectedPermissions)}
                              disabled={isPending}
                              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-red disabled:opacity-60"
                            >
                              <ShieldOff size={16} /> Disable
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => requestAccessChange(customer, selectedRole, true, undefined, selectedPermissions)}
                            disabled={isPending || selectedPermissions.length === 0}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white disabled:opacity-60"
                          >
                            <UserCog size={16} /> Grant
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }) : searchReady ? (
                <div className="p-8 text-center">
                  <h2 className="text-xl font-black text-maroon">{loading ? "Loading users" : "No users found"}</h2>
                  <p className="mt-2 text-sm font-semibold text-muted">Ask staff to create or log into a normal account first, then search their mobile or email here.</p>
                </div>
              ) : !visibleAssignments.length ? (
                <div className="p-8 text-center">
                  <h2 className="text-xl font-black text-maroon">{loading ? "Loading access" : "No staff access yet"}</h2>
                  <p className="mt-2 text-sm font-semibold text-muted">Search a customer account by name, mobile, or email to grant the first role.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      {pendingChange ? (
        <AccessConfirmDialog
          change={pendingChange}
          isPending={isPending}
          onCancel={() => setPendingChange(null)}
          onConfirm={() => updateAccess(pendingChange.customer, pendingChange.role, pendingChange.permissions, pendingChange.active)}
        />
      ) : null}
    </main>
  );
}

function AccessConfirmDialog({
  change,
  isPending,
  onCancel,
  onConfirm,
}: {
  change: PendingAccessChange;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = change.active
    ? change.previousRole
      ? `Change ${change.customer.name} to ${roleLabels[change.role]}?`
      : `Grant ${roleLabels[change.role]} access?`
    : `Disable access for ${change.customer.name}?`;
  const detail = change.active
    ? `${change.customer.name} will be able to use the admin pages allowed for ${roleLabels[change.role]}.`
    : `${change.customer.name} will no longer be able to use admin pages.`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff4f5] text-red">
              <AlertTriangle size={21} />
            </span>
            <div>
              <h2 className="text-lg font-black text-maroon">{title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted">{detail}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border" aria-label="Cancel role change">
            <X size={17} />
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-xl bg-cream p-4 text-sm font-bold text-charcoal">
            <p>{change.customer.mobile}{change.customer.email ? ` - ${change.customer.email}` : ""}</p>
            <p className="mt-2 text-maroon">
              {change.active ? `Selected role: ${roleLabels[change.role]}` : "Selected action: Disable staff access"}
            </p>
            {change.active ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {change.permissions.map((permission) => (
                  <span key={permission} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-black text-[#0f7a45] ring-1 ring-border">
                    <Check size={13} /> {permissionLabels[permission]}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onCancel} disabled={isPending} className="h-10 rounded-lg border border-border px-4 font-black disabled:opacity-60">Cancel</button>
            <button type="button" onClick={onConfirm} disabled={isPending} className="h-10 rounded-lg bg-maroon px-4 font-black text-white disabled:opacity-60">
              {isPending ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionChecklist({
  selectedPermissions,
  onToggle,
}: {
  selectedPermissions: AdminPermission[];
  onToggle: (permission: AdminPermission) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
      {adminPermissions.map((permission) => {
        const checked = selectedPermissions.includes(permission);
        return (
          <label
            key={permission}
            className={`flex min-w-0 cursor-pointer gap-2 rounded-lg border px-3 py-2 ${checked ? "border-[#b7e4c7] bg-[#effaf4]" : "border-border bg-cream"}`}
            title={permissionDescriptions[permission]}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(permission)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0f7a45]"
            />
            <span className="min-w-0">
              <span className={`block truncate text-xs font-black ${checked ? "text-[#0f7a45]" : "text-charcoal"}`}>
                {permissionLabels[permission]}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-4 text-muted">
                {permissionDescriptions[permission]}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
