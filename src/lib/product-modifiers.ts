import type { Product } from "@/lib/types";

export type ModifierGroupKind = "single" | "multi";

export type ProductModifierOption = {
  id: string;
  name: string;
  price: number;
  dietaryType?: Product["dietaryType"];
};

export type ProductModifierGroup = {
  id: string;
  title: string;
  kind: ModifierGroupKind;
  required: boolean;
  min: number;
  max: number;
  options: ProductModifierOption[];
};

type ParsedModifierOptionName = {
  optionName: string;
  groupTitle: string;
  kind: ModifierGroupKind;
  required: boolean;
  min: number;
  max: number;
  dietaryType?: Product["dietaryType"];
  structured: boolean;
};

const modifierPrefix = "[wtmod:";
const fallbackGroupTitle = "Add Extras";

export function formatModifierOptionName(input: {
  groupTitle: string;
  kind: ModifierGroupKind;
  required: boolean;
  min?: number;
  max?: number;
  optionName: string;
  dietaryType?: Product["dietaryType"];
}) {
  const title = sanitizeToken(input.groupTitle || fallbackGroupTitle);
  const optionName = input.optionName.trim();
  const kind = input.kind === "single" ? "single" : "multi";
  const min = Math.max(0, Math.round(Number(input.min ?? (input.required ? 1 : 0))));
  const max = Math.max(kind === "single" ? 1 : 0, Math.round(Number(input.max ?? (kind === "single" ? 1 : 0))));
  const required = input.required || min > 0 ? "1" : "0";
  const dietaryType = isDietaryType(input.dietaryType) ? `;d=${input.dietaryType}` : "";

  return `${modifierPrefix}g=${encodeURIComponent(title)};k=${kind};r=${required};min=${min};max=${max}${dietaryType}] ${optionName}`;
}

export function parseModifierOptionName(name: string): ParsedModifierOptionName {
  if (!name.startsWith(modifierPrefix)) {
    return {
      optionName: name,
      groupTitle: fallbackGroupTitle,
      kind: "multi" as const,
      required: false,
      min: 0,
      max: 0,
      dietaryType: undefined,
      structured: false,
    };
  }

  const endIndex = name.indexOf("]");
  if (endIndex < 0) {
    return {
      optionName: name,
      groupTitle: fallbackGroupTitle,
      kind: "multi" as const,
      required: false,
      min: 0,
      max: 0,
      dietaryType: undefined,
      structured: false,
    };
  }

  const rawMeta = name.slice(modifierPrefix.length, endIndex);
  const optionName = name.slice(endIndex + 1).trim();
  const meta = Object.fromEntries(
    rawMeta
      .split(";")
      .map((part) => part.split("="))
      .filter(([key]) => Boolean(key)),
  );
  const kind = meta.k === "single" ? "single" : "multi";
  const min = clampCount(meta.min, kind === "single" ? 1 : 0);
  const max = clampCount(meta.max, kind === "single" ? 1 : 0);

  return {
    optionName: optionName || name,
    groupTitle: decodeToken(meta.g) || fallbackGroupTitle,
    kind,
    required: meta.r === "1" || min > 0,
    min,
    max,
    dietaryType: isDietaryType(meta.d) ? meta.d : undefined,
    structured: true,
  };
}

export function getModifierOptionLabel(name: string) {
  return parseModifierOptionName(name).optionName;
}

export function getProductModifierGroups(product: Pick<Product, "addons">): ProductModifierGroup[] {
  const groups = new Map<string, ProductModifierGroup>();

  for (const addon of product.addons) {
    const parsed = parseModifierOptionName(addon.name);
    const id = slugify(`${parsed.groupTitle}-${parsed.kind}-${parsed.required}-${parsed.min}-${parsed.max}`);
    const current = groups.get(id);
    const group: ProductModifierGroup = current ?? {
      id,
      title: parsed.groupTitle,
      kind: parsed.kind as ModifierGroupKind,
      required: parsed.required,
      min: parsed.min,
      max: parsed.max,
      options: [] as ProductModifierOption[],
    };

    const duplicateOption = group.options.some((option) =>
      option.name.trim().toLowerCase() === parsed.optionName.trim().toLowerCase() &&
      option.price === addon.price &&
      option.dietaryType === parsed.dietaryType,
    );
    if (duplicateOption) continue;

    group.options.push({
      id: addon.id,
      name: parsed.optionName,
      price: addon.price,
      dietaryType: parsed.dietaryType,
    });
    groups.set(id, group);
  }

  return Array.from(groups.values());
}

export function getModifierSelectionIssue(groups: ProductModifierGroup[], quantities: Record<string, number>) {
  for (const group of groups) {
    const count = group.options.reduce((total, option) => total + (quantities[option.id] ?? 0), 0);
    const requiredCount = group.required ? Math.max(1, group.min) : group.min;
    if (requiredCount > 0 && count < requiredCount) {
      return `Select ${requiredCount === 1 ? "1 option" : `${requiredCount} options`} from ${group.title}.`;
    }
    if (group.max > 0 && count > group.max) {
      return `Select up to ${group.max} ${group.max === 1 ? "option" : "options"} from ${group.title}.`;
    }
  }

  return "";
}

function sanitizeToken(value: string) {
  return value.replace(/\]/g, "").trim();
}

function decodeToken(value?: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clampCount(value: string | undefined, fallback: number) {
  const count = Number(value);
  if (!Number.isFinite(count)) return fallback;
  return Math.max(0, Math.round(count));
}

function isDietaryType(value: unknown): value is Product["dietaryType"] {
  return value === "VEG" || value === "NON_VEG" || value === "JAIN";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "addons";
}
