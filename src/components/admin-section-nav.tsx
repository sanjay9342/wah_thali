"use client";

import { BarChart3, ClipboardList, LayoutDashboard, ListTree, PackageCheck, Percent, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAccess } from "@/components/admin-access-gate";
import { canPermissionsAccessAdminPath } from "@/lib/admin-access-shared";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/inventory", label: "Inventory", icon: PackageCheck },
  { href: "/admin/categories", label: "Categories", icon: ListTree },
  { href: "/admin/coupons", label: "Coupons", icon: Percent },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/access", label: "Staff Access", icon: ShieldCheck },
];

export function AdminSectionNav() {
  const pathname = usePathname();
  const adminAccess = useAdminAccess();
  const visibleLinks = adminAccess ? adminLinks.filter((link) => canPermissionsAccessAdminPath(adminAccess.permissions, link.href)) : adminLinks;

  return (
    <nav className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-[#fff9fa] p-2" aria-label="Admin sections">
      {visibleLinks.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-black transition ${
              active ? "bg-maroon text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]" : "text-charcoal hover:bg-white hover:text-maroon"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
