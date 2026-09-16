import "server-only";

import { readServerEnv } from "@/lib/server-env";
import type { OrderStatus } from "@/lib/types";

type CrmLeadInput = {
  name: string;
  phone: string;
  email?: string | null;
  companyName?: string | null;
  source: string;
  remarks: string;
};

type OrderForCrm = {
  orderNumber: string;
  status: string;
  grandTotal: number;
  fulfillmentMethod?: string | null;
  couponCode?: string | null;
  customer: {
    name: string;
    mobile: string;
    email?: string | null;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  payments?: {
    provider: string;
    status: string;
    amount: number;
    providerPaymentId?: string | null;
  }[];
};

type CrmSendResult =
  | { ok: true; skipped?: false; status: number; body: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; status?: number; message: string; body?: string };

function isCrmEnabled() {
  const enabled = readServerEnv("BOTFLO_CRM_ENABLED", ["CRM_ENABLED"]).toLowerCase();
  return ["1", "true", "yes", "on"].includes(enabled);
}

function getCrmEndpoint() {
  const baseUrl = readServerEnv("BOTFLO_CRM_API_URL", ["CRM_API_URL"]) || "https://erp.botflo.in/api/public_api.php";
  const url = new URL(baseUrl);
  if (!url.searchParams.has("action")) {
    url.searchParams.set("action", "create_lead");
  }
  return url.toString();
}

function getCrmToken() {
  return readServerEnv("BOTFLO_CRM_BEARER_TOKEN", ["CRM_BEARER_TOKEN"]);
}

export async function sendCrmLead(input: CrmLeadInput): Promise<CrmSendResult> {
  if (!isCrmEnabled()) {
    return { ok: true, skipped: true, reason: "BotFlo CRM integration is disabled." };
  }

  const token = getCrmToken();
  if (!token) {
    return { ok: true, skipped: true, reason: "BotFlo CRM bearer token is not configured." };
  }

  const body = new URLSearchParams({
    name: input.name,
    phone: input.phone,
    email: input.email?.trim() || "",
    company_name: input.companyName?.trim() || "",
    source: input.source,
    remarks: input.remarks,
  });

  const response = await fetch(getCrmEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const responseBody = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: `BotFlo CRM request failed with status ${response.status}.`,
      body: responseBody,
    };
  }

  return { ok: true, status: response.status, body: responseBody };
}

export function formatOrderCrmRemarks(order: OrderForCrm, event: string, note?: string) {
  const itemSummary = order.items.map((item) => `${item.quantity} x ${item.name}`).join(", ");
  const paymentSummary = order.payments?.length
    ? order.payments.map((payment) => `${payment.provider} ${payment.status} Rs ${payment.amount}`).join(", ")
    : "Payment details not available";

  return [
    `Event: ${event}`,
    `Order: ${order.orderNumber}`,
    `Status: ${order.status}`,
    `Customer: ${order.customer.name}`,
    `Mobile: ${order.customer.mobile}`,
    order.customer.email ? `Email: ${order.customer.email}` : "",
    `Total: Rs ${order.grandTotal}`,
    order.fulfillmentMethod ? `Fulfillment: ${order.fulfillmentMethod}` : "",
    order.couponCode ? `Coupon: ${order.couponCode}` : "",
    `Items: ${itemSummary || "-"}`,
    `Payment: ${paymentSummary}`,
    note ? `Note: ${note}` : "",
  ].filter(Boolean).join("\n");
}

export async function sendCrmOrderCreated(order: OrderForCrm, note?: string) {
  return sendCrmLead({
    name: order.customer.name,
    phone: order.customer.mobile,
    email: order.customer.email,
    companyName: "Wah Thali Website Order",
    source: "Website New Order",
    remarks: formatOrderCrmRemarks(order, "New order", note),
  });
}

export async function sendCrmOrderStatus(order: OrderForCrm, status: OrderStatus, note?: string) {
  return sendCrmLead({
    name: order.customer.name,
    phone: order.customer.mobile,
    email: order.customer.email,
    companyName: "Wah Thali Order Status",
    source: `Order Status - ${status}`,
    remarks: formatOrderCrmRemarks({ ...order, status }, "Order status update", note),
  });
}
