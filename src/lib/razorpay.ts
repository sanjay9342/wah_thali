import "server-only";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

export type RazorpayOrderResult =
  | { ok: true; order: RazorpayOrder; keyId: string }
  | { ok: false; message: string; status?: number };

function readEnv(key: string) {
  const raw = process.env[key]?.trim();
  return raw?.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1") ?? "";
}

export function getRazorpayConfigStatus() {
  const required = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  const missing = required.filter((key) => !readEnv(key));
  return { configured: missing.length === 0, missing };
}

export async function createRazorpayOrder(input: {
  amountRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  const status = getRazorpayConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      message: `Razorpay is not configured. Missing: ${status.missing.join(", ")}`,
    };
  }

  const keyId = readEnv("RAZORPAY_KEY_ID");
  const keySecret = readEnv("RAZORPAY_KEY_SECRET");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountRupees * 100,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      partial_payment: false,
      notes: input.notes,
    }),
  });

  const data = await response.json().catch(() => null) as (RazorpayOrder & {
    error?: { description?: string; reason?: string };
  }) | null;

  if (!response.ok || !data?.id) {
    return {
      ok: false,
      status: response.status,
      message: data?.error?.description || data?.error?.reason || "Razorpay order creation failed.",
    };
  }

  return { ok: true, order: data, keyId };
}
