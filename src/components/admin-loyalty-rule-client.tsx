"use client";

import { CheckCircle2, Edit3, Gift, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch, readAdminApiJson } from "@/lib/admin-client-auth";
import { formatRupees } from "@/lib/pricing";
import { defaultWahPointsRule, normalizeWahPointsRule, type WahPointsRule } from "@/lib/rewards";

type RuleDraft = Record<keyof WahPointsRule, string>;

export function AdminLoyaltyRuleClient({
  initialRule,
}: {
  initialRule: WahPointsRule;
}) {
  const adminAccess = useAdminAccess();
  const [rule, setRule] = useState(() => normalizeWahPointsRule(initialRule));
  const [draft, setDraft] = useState<RuleDraft>(() => toDraft(initialRule));
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextRule = useMemo(() => normalizeWahPointsRule(fromDraft(draft)), [draft]);
  const summary = editing ? buildRuleSummary(nextRule) : buildRuleSummary(rule);
  const dirty = JSON.stringify(rule) !== JSON.stringify(nextRule);
  const validationError = getRuleValidationError(nextRule);

  function updateField(key: keyof WahPointsRule, value: string) {
    setMessage("");
    setDraft((current) => ({ ...current, [key]: value.replace(/[^\d]/g, "") }));
  }

  function resetToSaved() {
    setDraft(toDraft(rule));
    setEditing(false);
    setConfirming(false);
    setMessage("Loyalty rule reset to saved values.");
  }

  function resetDefaults() {
    setDraft(toDraft(defaultWahPointsRule));
    setEditing(true);
    setConfirming(false);
    setMessage("Default Wah Points formula loaded. Review and save to apply it.");
  }

  function saveRule() {
    if (validationError) {
      setMessage(validationError);
      return;
    }

    startTransition(async () => {
      setMessage("");
      const response = await adminFetch(adminAccess?.session, "/api/admin/loyalty-rule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextRule),
      });
      const data = await readAdminApiJson(response);
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Loyalty rule save failed.");
        return;
      }
      const savedRule = readRule(data) ?? nextRule;
      setRule(savedRule);
      setDraft(toDraft(savedRule));
      setEditing(false);
      setConfirming(false);
      setMessage("Loyalty rule saved. New checkout orders will use this formula.");
    });
  }

  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <Gift className="text-red" /> Wah Points loyalty rule
          </h2>
          <p className="text-sm font-semibold text-muted">
            {editing ? "Editing formula. Save with confirmation to apply to future earning and redemption." : "Saved formula used for checkout loyalty calculations."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
            <Edit3 size={16} /> Edit
          </button>
          <button type="button" onClick={resetDefaults} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
            <RotateCcw size={16} /> Defaults
          </button>
        </div>
      </div>

      {message ? (
        <p className={`mt-4 rounded-lg border px-4 py-3 text-sm font-black ${/saved|reset|loaded/i.test(message) ? "border-[#bfe7ce] bg-[#f1fbf5] text-[#0f7a45]" : "border-[#ffd1d6] bg-[#fff4f5] text-red"}`} role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          [`1 / Rs ${nextRule.pointsPerSpendRupees}`, "Earn rate", "Food value after discounts"],
          [`${nextRule.redemptionPoints} = ${formatRupees(nextRule.redemptionDiscount)}`, "Redeem rate", `Minimum food order ${formatRupees(nextRule.minimumRedemptionOrderValue)}`],
          [`${nextRule.maxCombinedDiscountPercent}%`, "Margin cap", "Coupon plus points limit"],
        ].map(([value, label, detail]) => (
          <div key={label} className="rounded-xl border border-border bg-cream p-4">
            <p className="text-2xl font-black text-maroon">{value}</p>
            <p className="mt-1 text-sm font-black text-charcoal">{label}</p>
            <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="mt-5 grid gap-4 rounded-xl border border-border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Rs spend for 1 point" value={draft.pointsPerSpendRupees} onChange={(value) => updateField("pointsPerSpendRupees", value)} helper="Example: 10 means Rs 10 = 1 point." />
            <NumberField label="Redeem points" value={draft.redemptionPoints} onChange={(value) => updateField("redemptionPoints", value)} helper="Points needed for discount." />
            <NumberField label="Redeem discount" value={draft.redemptionDiscount} onChange={(value) => updateField("redemptionDiscount", value)} helper="Rupees off for those points." />
            <NumberField label="Minimum order" value={draft.minimumRedemptionOrderValue} onChange={(value) => updateField("minimumRedemptionOrderValue", value)} helper="Food subtotal needed to redeem." />
            <NumberField label="Points cap %" value={draft.maxRedemptionPercent} onChange={(value) => updateField("maxRedemptionPercent", value)} helper="Max discount from points only." />
            <NumberField label="Coupon + points cap %" value={draft.maxCombinedDiscountPercent} onChange={(value) => updateField("maxCombinedDiscountPercent", value)} helper="Total discount protection." />
            <NumberField label="First order multiplier" value={draft.firstOrderMultiplier} onChange={(value) => updateField("firstOrderMultiplier", value)} helper="2 means double base points." />
            <NumberField label="Reorder bonus points" value={draft.reorderBonusPoints} onChange={(value) => updateField("reorderBonusPoints", value)} helper="Extra points for repeat order." />
            <NumberField label="Reorder window days" value={draft.reorderBonusDays} onChange={(value) => updateField("reorderBonusDays", value)} helper="Days after last order." />
            <NumberField label="Regular expiry days" value={draft.pointsExpireDays} onChange={(value) => updateField("pointsExpireDays", value)} helper="Base and first-order points." />
            <NumberField label="Bonus expiry days" value={draft.bonusPointsExpireDays} onChange={(value) => updateField("bonusPointsExpireDays", value)} helper="Reorder bonus points." />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {summary.map((item) => (
              <div key={item} className="rounded-xl border border-border bg-cream px-3 py-2 text-xs font-bold leading-5 text-muted">
                {item}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={resetToSaved} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
              <X size={16} /> Cancel
            </button>
            <button
              type="button"
              onClick={() => validationError ? setMessage(validationError) : setConfirming(true)}
              disabled={!dirty || isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
            >
              <CheckCircle2 size={16} /> Review save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item} className="rounded-xl bg-white px-3 py-2 text-xs font-bold leading-5 text-muted ring-1 ring-border">
              {item}
            </div>
          ))}
        </div>
      )}

      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black text-maroon">Save loyalty formula?</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">
              This affects future checkout earning and redemption. Existing ledger entries stay unchanged.
            </p>
            <div className="mt-4 grid gap-2 rounded-xl bg-cream p-4 text-sm font-bold text-charcoal">
              <p>Earn: 1 point per Rs {nextRule.pointsPerSpendRupees}</p>
              <p>Redeem: {nextRule.redemptionPoints} points = {formatRupees(nextRule.redemptionDiscount)}</p>
              <p>Caps: points {nextRule.maxRedemptionPercent}%, coupon plus points {nextRule.maxCombinedDiscountPercent}%</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-border px-4 font-black">Go back</button>
              <button type="button" onClick={saveRule} disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
                <Save size={16} /> {isPending ? "Saving..." : "Confirm and save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NumberField({ label, value, helper, onChange }: { label: string; value: string; helper: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-charcoal">
      {label}
      <input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3 font-black text-charcoal" />
      <span className="text-xs font-bold leading-5 text-muted">{helper}</span>
    </label>
  );
}

function toDraft(rule: WahPointsRule): RuleDraft {
  return Object.fromEntries(Object.entries(normalizeWahPointsRule(rule)).map(([key, value]) => [key, String(value)])) as RuleDraft;
}

function fromDraft(draft: RuleDraft) {
  return Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value)]));
}

function getRuleValidationError(rule: WahPointsRule) {
  if (rule.maxCombinedDiscountPercent < rule.maxRedemptionPercent) return "Coupon plus points cap must be equal to or higher than points cap.";
  if (rule.redemptionDiscount <= 0 || rule.redemptionPoints <= 0 || rule.pointsPerSpendRupees <= 0) return "Earn and redeem numbers must be greater than 0.";
  return "";
}

function buildRuleSummary(rule: WahPointsRule) {
  return [
    `Earn 1 Wah Point for every Rs ${rule.pointsPerSpendRupees} eligible food spend after discounts.`,
    `First order earns ${rule.firstOrderMultiplier}x points.`,
    `Order again within ${rule.reorderBonusDays} days to get ${rule.reorderBonusPoints} bonus points.`,
    `${rule.redemptionPoints} points gives ${formatRupees(rule.redemptionDiscount)} off above ${formatRupees(rule.minimumRedemptionOrderValue)}.`,
    `Point redemption is capped at ${rule.maxRedemptionPercent}% of food value, and coupon plus points cannot exceed ${rule.maxCombinedDiscountPercent}%.`,
    `Regular points expire in ${rule.pointsExpireDays} days; bonus points expire in ${rule.bonusPointsExpireDays} days.`,
  ];
}

function readRule(data: unknown) {
  if (!data || typeof data !== "object" || !("rule" in data)) return null;
  return normalizeWahPointsRule(data.rule);
}
